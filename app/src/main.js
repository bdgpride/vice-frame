// Vice Frame's editor: wires the page to the one render path in ./render.js.
// A photo (uploaded, dropped in, or a bundled sample) is graded once per grade into an
// offscreen canvas; each panel holds a photo plus a crop (pan and zoom), and the canvas
// preview is the cover itself at export size, so export is the same render again.
import { GRADES, GRADE_ORDER, gradePhoto } from './grades.js';
import { LAYOUTS, LAYOUT_ORDER, PANEL_PRESETS, layoutPanels, pointInPanel } from './layouts.js';
import { coverFit, renderCover } from './render.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const zoomSlider = document.getElementById('zoom');
const zoomValue = document.getElementById('zoomValue');

const state = {
  layout: 'collage',
  grade: 'vice',
  size: [1080, 1080],
  title: 'Sunset Heist',
  subtitle: 'Vice City Vibes',
  grain: true,
  halftone: true,
  photos: [], // { id, img, label }
  panels: [], // { photoId, panX, panY, zoom }
  selected: 0,
  currentPhotoId: null,
};

const gradedCache = new Map(); // `${photoId}|${grade}` -> graded canvas
const sampleCache = new Map(); // sample name -> photo id
let photoSeq = 0;

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function gradedFor(photoId) {
  const key = `${photoId}|${state.grade}`;
  if (!gradedCache.has(key)) {
    const photo = state.photos.find((p) => p.id === photoId);
    if (!photo) return null;
    gradedCache.set(key, gradePhoto(photo.img, state.grade));
  }
  return gradedCache.get(key);
}

/** Resizes the panel list to the current layout, keeping crops where panels survive. */
function syncPanels() {
  const count = layoutPanels(state.layout, state.size[0], state.size[1]).length;
  while (state.panels.length < count) {
    const preset = PANEL_PRESETS[state.panels.length % PANEL_PRESETS.length];
    state.panels.push({ photoId: state.currentPhotoId, ...preset });
  }
  state.panels.length = count;
  state.selected = Math.min(state.selected, count - 1);
}

function currentView() {
  return {
    layout: state.layout,
    title: state.title,
    subtitle: state.subtitle,
    grain: state.grain,
    halftone: state.halftone,
    panels: state.panels.map((p) => ({
      img: p.photoId ? gradedFor(p.photoId) : null,
      panX: p.panX,
      panY: p.panY,
      zoom: p.zoom,
    })),
  };
}

let frameQueued = false;
function redraw() {
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(() => {
    frameQueued = false;
    canvas.width = state.size[0];
    canvas.height = state.size[1];
    renderCover(ctx, state.size[0], state.size[1], currentView());
    drawSelection();
  });
}

/** A dashed amber outline on the selected panel, editor-only: never in an export. */
function drawSelection() {
  if (document.body.classList.contains('shot-cover')) return;
  const panels = layoutPanels(state.layout, state.size[0], state.size[1]);
  const p = panels[state.selected];
  if (!p) return;
  ctx.save();
  ctx.beginPath();
  p.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.setLineDash([14, 10]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 179, 92, 0.95)';
  ctx.stroke();
  ctx.restore();
}

/** Registers a loaded image as a photo and makes it the current one. */
function addPhoto(img, label) {
  const id = `photo-${++photoSeq}`;
  state.photos.push({ id, img, label });
  state.currentPhotoId = id;
  return id;
}

/** Puts the current photo into the selected panel, with that panel's preset crop. */
function assignCurrentToSelected() {
  const panel = state.panels[state.selected];
  if (!panel || !state.currentPhotoId) return;
  const preset = PANEL_PRESETS[state.selected % PANEL_PRESETS.length];
  Object.assign(panel, { photoId: state.currentPhotoId, ...preset });
  syncZoomUI();
}

/** Spreads the current photo across every panel, each in its own crop. */
function fillAllPanels() {
  if (!state.currentPhotoId) return;
  state.panels.forEach((p, i) => {
    const preset = PANEL_PRESETS[i % PANEL_PRESETS.length];
    Object.assign(p, { photoId: state.currentPhotoId, ...preset });
  });
  syncZoomUI();
}

async function chooseSample(name) {
  if (!sampleCache.has(name)) {
    const img = await loadImage(`samples/${name}.jpg`);
    sampleCache.set(name, addPhoto(img, name));
  }
  state.currentPhotoId = sampleCache.get(name);
  assignCurrentToSelected();
  redraw();
  status.textContent = `Sample “${name}” is in panel ${state.selected + 1}.`;
}

async function chooseFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  addPhoto(img, file.name);
  assignCurrentToSelected();
  redraw();
  status.textContent = `Your photo is in panel ${state.selected + 1} — drag it to reposition.`;
}

/* ---------------- controls ---------------- */

function chip(parent, value, label, blurb, group) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.dataset.value = value;
  b.setAttribute('role', 'radio');
  b.innerHTML = blurb ? `${label}<small>${blurb}</small>` : label;
  b.addEventListener('click', () => {
    parent.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c === b));
    group(value);
  });
  parent.appendChild(b);
  return b;
}

const layoutChips = document.getElementById('layouts');
for (const name of LAYOUT_ORDER) {
  chip(layoutChips, name, LAYOUTS[name].label, LAYOUTS[name].blurb, (value) => {
    state.layout = value;
    syncPanels();
    redraw();
  });
}
const gradeChips = document.getElementById('grades');
for (const name of GRADE_ORDER) {
  chip(gradeChips, name, GRADES[name].label, GRADES[name].blurb, (value) => {
    state.grade = value;
    redraw();
  });
}

function markChip(parent, value) {
  parent.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c.dataset.value === value));
}

document.querySelectorAll('.sample').forEach((b) => {
  b.addEventListener('click', () => chooseSample(b.dataset.sample));
});
document.getElementById('photo').addEventListener('change', (e) => chooseFile(e.target.files[0]));
document.getElementById('caption1').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
document.getElementById('caption2').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
document.getElementById('fillAll').addEventListener('click', () => { fillAllPanels(); redraw(); });
document.getElementById('resetCrop').addEventListener('click', () => {
  const preset = PANEL_PRESETS[state.selected % PANEL_PRESETS.length];
  Object.assign(state.panels[state.selected], preset);
  syncZoomUI();
  redraw();
});
document.getElementById('grain').addEventListener('change', (e) => { state.grain = e.target.checked; redraw(); });
document.getElementById('halftone').addEventListener('change', (e) => { state.halftone = e.target.checked; redraw(); });

const sizeChips = document.getElementById('sizes');
sizeChips.querySelectorAll('.chip').forEach((b) => {
  b.addEventListener('click', () => {
    sizeChips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c === b));
    const [w, h] = b.dataset.size.split('x').map(Number);
    setSize(w, h);
  });
});

function setSize(w, h) {
  state.size = [w, h];
  syncPanels();
  redraw();
}

function syncZoomUI() {
  const panel = state.panels[state.selected];
  const zoom = panel ? panel.zoom : 1;
  zoomSlider.value = zoom;
  zoomValue.textContent = `${zoom.toFixed(2)}×`;
}
zoomSlider.addEventListener('input', () => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.zoom = Number(zoomSlider.value);
  zoomValue.textContent = `${panel.zoom.toFixed(2)}×`;
  redraw();
});

/* ---------------- canvas: select and drag ---------------- */

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return [
    ((e.clientX - rect.left) / rect.width) * canvas.width,
    ((e.clientY - rect.top) / rect.height) * canvas.height,
  ];
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const [x, y] = canvasPoint(e);
  const panels = layoutPanels(state.layout, state.size[0], state.size[1]);
  const hit = panels.findIndex((p) => pointInPanel(x, y, p.pts));
  if (hit >= 0) {
    state.selected = hit;
    syncZoomUI();
  }
  drag = { x, y, moved: false };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const [x, y] = canvasPoint(e);
  const panel = state.panels[state.selected];
  const view = currentView().panels[state.selected];
  if (!panel || !view || !view.img) return;
  const layoutPanel = layoutPanels(state.layout, state.size[0], state.size[1])[state.selected];
  const fit = coverFit(layoutPanel, view.img, view);
  const overflowX = Math.max(1, fit.dw - layoutPanel.bbox.w);
  const overflowY = Math.max(1, fit.dh - layoutPanel.bbox.h);
  panel.panX = Math.max(-1, Math.min(1, panel.panX - (2 * (x - drag.x)) / overflowX));
  panel.panY = Math.max(-1, Math.min(1, panel.panY - (2 * (y - drag.y)) / overflowY));
  drag = { x, y, moved: true };
  canvas.classList.add('dragging');
  redraw();
});
canvas.addEventListener('pointerup', () => {
  drag = null;
  canvas.classList.remove('dragging');
});

/* Drag-and-drop a photo anywhere on the window. */
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('drag-over');
});
window.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) document.body.classList.remove('drag-over');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('drag-over');
  chooseFile(e.dataTransfer.files[0]);
});

/* ---------------- export ---------------- */

document.getElementById('export').addEventListener('click', () => {
  const [w, h] = state.size;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  renderCover(out.getContext('2d'), w, h, currentView());
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-frame-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = `Saved vice-frame-${w}x${h}.png`;
  }, 'image/png');
});

/* ---------------- scenes: shot mode, or the editor's first paint ---------------- */

/** Applies a screenshot scene: sample photo in every panel, given words and look. */
async function applyScene(scene) {
  if (scene.layout && LAYOUTS[scene.layout]) {
    state.layout = scene.layout;
    markChip(layoutChips, scene.layout);
  }
  if (scene.grade && GRADES[scene.grade]) {
    state.grade = scene.grade;
    markChip(gradeChips, scene.grade);
  }
  if (scene.size) {
    const [w, h] = scene.size.split('x').map(Number);
    if (w > 0 && h > 0) {
      state.size = [w, h];
      sizeChips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c.dataset.size === scene.size));
    }
  }
  state.title = scene.caption;
  document.getElementById('caption1').value = scene.caption;
  if (scene.caption2 != null) {
    state.subtitle = scene.caption2;
    document.getElementById('caption2').value = scene.caption2;
  }
  const img = await loadImage(`samples/${scene.photo}.jpg`);
  addPhoto(img, scene.photo);
  syncPanels();
  fillAllPanels();
  redraw();
}

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, applyScene);
} else {
  // First paint: the pier sample already in the collage, so a first-time user is one
  // click from an export. Fonts first, so the lettering is right on the first frame.
  (async () => {
    try {
      await Promise.race([
        Promise.all([document.fonts.load('100px Anton'), document.fonts.load('600 40px Oswald')]),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch { /* fallbacks still paint */ }
    markChip(layoutChips, state.layout);
    markChip(gradeChips, state.grade);
    const img = await loadImage('samples/pier.jpg');
    addPhoto(img, 'pier');
    sampleCache.set('pier', state.currentPhotoId);
    syncPanels();
    fillAllPanels();
    redraw();
  })();
}
