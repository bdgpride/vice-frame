// Vice Frame's one render path: preview, PNG export and screenshot mode all call
// renderCover, so what the editor shows is byte-for-byte what leaves the app.
// The composition, back to front: graded panels clipped to their polygons, a shade
// band where the lettering sits, white keylines on every seam, a poster frame, the
// masthead strip, the two-line caption with its hard offset shadow, then the finish —
// vignette, halftone and a seeded film grain (deterministic: no Math.random anywhere).

import { layoutPanels } from './layouts.js';

export const INK = '#0d0a14';
export const PAPER = '#f7f3ea';

/** Small deterministic PRNG (mulberry32) so the grain is identical on every render. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainTile = null;
/** A 512px tile of mid-grey noise; laid over the cover with 'overlay' it reads as film grain. */
function getGrainTile() {
  if (grainTile) return grainTile;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const data = ctx.createImageData(size, size);
  const rng = mulberry32(0x71ce5eed);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 96 + Math.floor(rng() * 64);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  grainTile = canvas;
  return canvas;
}

let halftoneTile = null;
/** A small dot grid; at a whisper of alpha it gives flat colour a printed feel. */
function getHalftoneTile() {
  if (halftoneTile) return halftoneTile;
  const canvas = document.createElement('canvas');
  canvas.width = 14;
  canvas.height = 14;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(3.5, 3.5, 2.6, 0, Math.PI * 2);
  ctx.arc(10.5, 10.5, 2.6, 0, Math.PI * 2);
  ctx.fill();
  halftoneTile = canvas;
  return canvas;
}

/** Cover-fit for one panel: the drawn rect of `img` inside the panel's box at this crop. */
export function coverFit(panel, img, view) {
  const { bbox } = panel;
  const scale = Math.max(bbox.w / img.width, bbox.h / img.height) * (view?.zoom ?? 1);
  const dw = img.width * scale;
  const dh = img.height * scale;
  return {
    dw,
    dh,
    dx: bbox.x - ((dw - bbox.w) * (1 + (view?.panX ?? 0))) / 2,
    dy: bbox.y - ((dh - bbox.h) * (1 + (view?.panY ?? 0))) / 2,
  };
}

/** Draws one panel's graded photo, cover-fitted into the panel's box and clipped to its polygon. */
function drawPanelPhoto(ctx, panel, view) {
  const { bbox } = panel;
  ctx.save();
  ctx.beginPath();
  panel.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.clip();
  if (view && view.img) {
    const { dx, dy, dw, dh } = coverFit(panel, view.img, view);
    ctx.drawImage(view.img, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = '#241a33';
    ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
  }
  // A whisper of shade top and bottom so seams and lettering sit on the photograph.
  const shade = ctx.createLinearGradient(0, bbox.y, 0, bbox.y + bbox.h);
  shade.addColorStop(0, 'rgba(8, 5, 16, 0.13)');
  shade.addColorStop(0.22, 'rgba(8, 5, 16, 0)');
  shade.addColorStop(0.78, 'rgba(8, 5, 16, 0)');
  shade.addColorStop(1, 'rgba(8, 5, 16, 0.2)');
  ctx.fillStyle = shade;
  ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
  ctx.restore();
}

/** Letter-spaced text drawn by hand (canvas letterSpacing is not everywhere yet). */
function drawSpacedText(ctx, text, cx, y, spacing, align = 'center') {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = align === 'center' ? cx - total / 2 : cx;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + spacing;
  });
  ctx.textAlign = prevAlign;
  return total;
}

/** Shrinks Anton from `start` until `text` fits `maxWidth`; returns the size used. */
function fitAnton(ctx, text, start, maxWidth) {
  let size = start;
  ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size *= 0.94;
    ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  }
  return size;
}

/**
 * The caption: line one in Anton — white with a warm fall-off, a near-black outline and
 * a hard offset shadow, leaning a few degrees — and line two in letterspaced Oswald
 * under a teal-to-magenta rule. Drawn with its baseline block anchored at (x, bottomY),
 * growing upward; `align` is 'left' or 'center'.
 */
function drawCaption(ctx, w, h, title, subtitle, align, bottomY) {
  const text1 = (title ?? '').trim().toUpperCase();
  const text2 = (subtitle ?? '').trim().toUpperCase();
  const marginX = w * 0.055;
  const maxW = align === 'center' ? w * 0.9 : w - marginX * 2;
  const anchorX = align === 'center' ? w / 2 : marginX;
  let cursor = bottomY;
  if (text2) {
    const subSize = Math.max(13, h * 0.031);
    ctx.font = `600 ${subSize}px Oswald, sans-serif`;
    const spacing = subSize * 0.34;
    const subWidth = [...text2].reduce((a, ch) => a + ctx.measureText(ch).width, 0) + spacing * (text2.length - 1);
    ctx.fillStyle = PAPER;
    ctx.shadowColor = 'rgba(5, 3, 10, 0.55)';
    ctx.shadowBlur = subSize * 0.18;
    ctx.shadowOffsetY = subSize * 0.06;
    if (align === 'center') drawSpacedText(ctx, text2, anchorX, cursor, spacing);
    else drawSpacedText(ctx, text2, anchorX, cursor, spacing, 'left');
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // The gradient rule above the subtitle.
    const barH = Math.max(3, h * 0.0062);
    const barY = cursor - subSize - barH * 2.1;
    const grad = ctx.createLinearGradient(anchorX, 0, anchorX + subWidth, 0);
    grad.addColorStop(0, '#17e6c8');
    grad.addColorStop(0.55, '#ffb35c');
    grad.addColorStop(1, '#ff4d8d');
    ctx.fillStyle = grad;
    const barX = align === 'center' ? anchorX - subWidth / 2 : anchorX;
    ctx.fillRect(barX, barY, Math.min(subWidth, maxW), barH);
    cursor = barY - h * 0.018;
  }
  if (text1) {
    const size = fitAnton(ctx, text1, h * 0.118, maxW);
    ctx.save();
    ctx.translate(anchorX, cursor);
    ctx.transform(1, 0, -0.055, 1, 0, 0); // the poster's lean
    ctx.textAlign = align === 'center' ? 'center' : 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    // Hard offset shadow first — no blur, it is printed ink, not a glow.
    ctx.fillStyle = INK;
    ctx.fillText(text1, size * 0.052, size * 0.058);
    ctx.lineWidth = size * 0.15;
    ctx.strokeStyle = INK;
    ctx.strokeText(text1, 0, 0);
    const fill = ctx.createLinearGradient(0, -size, 0, size * 0.25);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(1, '#ffd9a8');
    ctx.fillStyle = fill;
    ctx.fillText(text1, 0, 0);
    ctx.restore();
  }
}

/**
 * Renders the whole cover onto `ctx` at w x h.
 * view = { layout, panels: [{img, panX, panY, zoom}], title, subtitle, grain, halftone }
 * where each panel's img is an already-graded canvas (see grades.js).
 */
export function renderCover(ctx, w, h, view) {
  const panels = layoutPanels(view.layout, w, h);
  const minSide = Math.min(w, h);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);

  panels.forEach((p, i) => drawPanelPhoto(ctx, p, view.panels[i]));

  const solo = view.layout === 'solo';
  // Shade bands where the lettering will sit, so type holds over any photograph.
  if (solo) {
    const band = ctx.createLinearGradient(0, 0, 0, h * 0.46);
    band.addColorStop(0, 'rgba(7, 4, 13, 0.6)');
    band.addColorStop(1, 'rgba(7, 4, 13, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, w, h * 0.46);
  } else {
    const band = ctx.createLinearGradient(0, h * 0.52, 0, h);
    band.addColorStop(0, 'rgba(7, 4, 13, 0)');
    band.addColorStop(1, 'rgba(7, 4, 13, 0.68)');
    ctx.fillStyle = band;
    ctx.fillRect(0, h * 0.52, w, h * 0.48);
  }

  // Keylines: a white seam with a dark edge on both sides, on every panel border.
  const kw = Math.max(3, minSide * 0.0068);
  for (const p of panels) {
    ctx.beginPath();
    p.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.lineWidth = kw * 2.1;
    ctx.strokeStyle = 'rgba(9, 6, 16, 0.85)';
    ctx.stroke();
    ctx.lineWidth = kw;
    ctx.strokeStyle = PAPER;
    ctx.stroke();
  }

  // The poster frame: a heavy ink border and a hairline of paper just inside it.
  const fw = Math.max(8, minSide * 0.017);
  ctx.lineWidth = fw;
  ctx.strokeStyle = INK;
  ctx.strokeRect(fw / 2, fw / 2, w - fw, h - fw);
  ctx.lineWidth = Math.max(2, minSide * 0.0032);
  ctx.strokeStyle = 'rgba(247, 243, 234, 0.9)';
  ctx.strokeRect(fw + ctx.lineWidth, fw + ctx.lineWidth, w - 2 * (fw + ctx.lineWidth), h - 2 * (fw + ctx.lineWidth));

  // Masthead: a slim ink strip carrying the maker's name in letterspaced Oswald,
  // ruled lines running out to the frame on both sides.
  const mh = h * 0.05;
  const mastY = fw + 2;
  ctx.fillStyle = INK;
  ctx.fillRect(fw + 2, mastY, w - 2 * fw - 4, mh);
  const mastSize = mh * 0.46;
  ctx.font = `600 ${mastSize}px Oswald, sans-serif`;
  ctx.fillStyle = PAPER;
  ctx.textBaseline = 'middle';
  const mastText = 'VICE FRAME';
  const mastSpacing = mastSize * 0.52;
  const mastWidth = drawSpacedText(ctx, mastText, w / 2, mastY + mh / 2 + 1, mastSpacing);
  ctx.strokeStyle = 'rgba(247, 243, 234, 0.55)';
  ctx.lineWidth = Math.max(1.5, minSide * 0.0022);
  for (const dir of [-1, 1]) {
    const from = w / 2 + dir * (mastWidth / 2 + w * 0.022);
    const to = w / 2 + dir * (w / 2 - fw - w * 0.028);
    ctx.beginPath();
    ctx.moveTo(from, mastY + mh / 2);
    ctx.lineTo(to, mastY + mh / 2);
    ctx.stroke();
    // A small diamond where the rule meets the text.
    ctx.save();
    ctx.translate(w / 2 + dir * (mastWidth / 2 + w * 0.013), mastY + mh / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ff4d8d';
    const d = mastSize * 0.16;
    ctx.fillRect(-d / 2, -d / 2, d, d);
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';

  // Caption: top-centred on Solo, bottom-left on the panelled layouts.
  if (solo) {
    drawCaption(ctx, w, h, view.title, view.subtitle, 'center', mastY + mh + h * 0.185);
  } else {
    drawCaption(ctx, w, h, view.title, view.subtitle, 'left', h - fw - h * 0.052);
  }

  // Microtext, bottom right: the colophon every poster carries.
  const micro = 'EST. 2026 • VICE CITY VIBES';
  const microSize = Math.max(10, h * 0.0155);
  ctx.font = `500 ${microSize}px Oswald, sans-serif`;
  ctx.fillStyle = 'rgba(247, 243, 234, 0.88)';
  ctx.shadowColor = 'rgba(5, 3, 10, 0.6)';
  ctx.shadowBlur = microSize * 0.3;
  const microWidth = [...micro].reduce((a, ch) => a + ctx.measureText(ch).width, 0) + microSize * 0.3 * (micro.length - 1);
  const microRight = w - fw - w * 0.028;
  drawSpacedText(ctx, micro, microRight - microWidth / 2, h - fw - h * 0.018, microSize * 0.3);
  ctx.shadowBlur = 0;

  // Finish: vignette, then halftone, then grain — all gentle, all baked in.
  const vig = ctx.createRadialGradient(w / 2, h * 0.44, minSide * 0.5, w / 2, h * 0.5, Math.max(w, h) * 0.76);
  vig.addColorStop(0, 'rgba(7, 4, 13, 0)');
  vig.addColorStop(1, 'rgba(7, 4, 13, 0.4)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  if (view.halftone) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = ctx.createPattern(getHalftoneTile(), 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (view.grain) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = ctx.createPattern(getGrainTile(), 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
