// Vice Frame panel layouts. A layout is a set of polygons that tile the cover exactly,
// edge to edge, so the white keylines drawn between them land on shared seams. Collage is
// the GTA-style one: a tall hero panel with a diagonal right edge, and a column of three
// smaller panels stacked against it, their dividers slanted like cut photographs.

function panel(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let cx = 0, cy = 0;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    cx += x; cy += y;
  }
  return {
    pts,
    bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    cx: cx / pts.length,
    cy: cy / pts.length,
  };
}

/** Hero left with a diagonal edge; three stacked panels on the right. */
function collage(w, h) {
  const slant = w * 0.055;
  const hx = w * 0.635; // hero's top-right corner
  const hero = panel([[0, 0], [hx, 0], [hx - slant, h], [0, h]]);
  // Boundaries of the right-hand column: left points ride the hero's diagonal,
  // right points sit a little higher or lower so the dividers slant like cuts.
  const v = [0, 0.36, 0.68, 1];
  const r = [0, 0.325, 0.705, 1];
  const left = v.map((t) => [hx - slant * t, h * t]);
  const right = r.map((t) => [w, h * t]);
  const panels = [hero];
  for (let i = 0; i < 3; i++) {
    panels.push(panel([left[i], right[i], right[i + 1], left[i + 1]]));
  }
  return panels;
}

/** Two panels split by one long diagonal. */
function duo(w, h) {
  const top = w * 0.56;
  const bottom = w * 0.44;
  return [
    panel([[0, 0], [top, 0], [bottom, h], [0, h]]),
    panel([[top, 0], [w, 0], [w, h], [bottom, h]]),
  ];
}

/** Three standing panels, dividers leaning like a fan of photographs. */
function trio(w, h) {
  const x1t = w * 0.365, x1b = w * 0.315;
  const x2t = w * 0.685, x2b = w * 0.635;
  return [
    panel([[0, 0], [x1t, 0], [x1b, h], [0, h]]),
    panel([[x1t, 0], [x2t, 0], [x2b, h], [x1b, h]]),
    panel([[x2t, 0], [w, 0], [w, h], [x2b, h]]),
  ];
}

/** One full-bleed photograph under the masthead. */
function solo(w, h) {
  return [panel([[0, 0], [w, 0], [w, h], [0, h]])];
}

export const LAYOUTS = {
  collage: { label: 'Collage', blurb: 'Hero panel + three cuts', build: collage },
  duo: { label: 'Duo', blurb: 'Two-panel diagonal split', build: duo },
  trio: { label: 'Trio', blurb: 'Three standing panels', build: trio },
  solo: { label: 'Solo', blurb: 'Full-bleed single panel', build: solo },
};

export const LAYOUT_ORDER = ['collage', 'duo', 'trio', 'solo'];

/** The panels of `layoutName` for a cover of w x h, hero first. */
export function layoutPanels(layoutName, w, h) {
  return (LAYOUTS[layoutName] ?? LAYOUTS.collage).build(w, h);
}

/**
 * Default crops when one photo fills every panel: the hero sits centred, the smaller
 * panels lean into different corners of the frame so the collage reads as several
 * photographs, not one picture behind a grid.
 */
export const PANEL_PRESETS = [
  { panX: 0, panY: 0, zoom: 1.02 },
  { panX: -0.3, panY: -0.62, zoom: 1.16 },
  { panX: 0.45, panY: -0.32, zoom: 1.18 },
  { panX: -0.05, panY: 0.5, zoom: 1.24 },
  { panX: 0.25, panY: 0.3, zoom: 1.15 },
];

/** Point-in-polygon hit test, for clicking a panel in the editor. */
export function pointInPanel(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
