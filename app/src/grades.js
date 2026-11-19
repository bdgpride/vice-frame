// Vice Frame colour grades: real per-pixel work on an offscreen canvas, baked into every
// preview and export. Each grade is a small recipe — saturation, an S-curve for contrast,
// black crush or lift, a split tone (one tint for the shadows, another for the highlights)
// and, for Poster Ink, a hard posterize that gives the photo an illustrated feel.

export const GRADES = {
  vice: {
    label: 'Vice Sunset',
    blurb: 'Teal shadows, sun-warmed highlights',
    saturation: 1.3,
    contrast: 0.34,
    crush: 0.0,
    lift: 0.0,
    shadowTint: [0.0, 0.055, 0.065],
    highlightTint: [0.07, 0.028, -0.02],
    posterize: 0,
  },
  neon: {
    label: 'Neon Nights',
    blurb: 'Magenta darks, cyan glare, deep shadows',
    saturation: 1.3,
    contrast: 0.46,
    crush: 0.055,
    lift: 0.0,
    shadowTint: [0.07, -0.03, 0.1],
    highlightTint: [-0.045, 0.06, 0.09],
    posterize: 0,
  },
  poster: {
    label: 'Poster Ink',
    blurb: 'Five hard levels — an illustrated cover',
    saturation: 1.38,
    contrast: 0.26,
    crush: 0.01,
    lift: 0.0,
    shadowTint: [0.01, 0.02, 0.045],
    highlightTint: [0.06, 0.03, -0.015],
    posterize: 5,
  },
  golden: {
    label: 'Golden Hour',
    blurb: 'Warm glow, soft contrast, lifted darks',
    saturation: 1.16,
    contrast: 0.17,
    crush: 0.0,
    lift: 0.045,
    shadowTint: [0.045, 0.018, -0.03],
    highlightTint: [0.085, 0.042, -0.02],
    posterize: 0,
  },
};

export const GRADE_ORDER = ['vice', 'neon', 'poster', 'golden'];

const MAX_SIDE = 1440; // working resolution cap: grading stays fast on any photo

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The gentle S-curve every grade shares: `amount` 0 is a straight line. */
function sCurve(x, amount) {
  return clamp01(x + amount * x * (1 - x) * (x - 0.5) * 4);
}

/**
 * Returns a canvas holding `img` with grade `gradeName` applied, at the photo's own
 * size capped to MAX_SIDE on the long edge. The caller caches the result per photo+grade.
 */
export function gradePhoto(img, gradeName) {
  const grade = GRADES[gradeName] ?? GRADES.vice;
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const { saturation, contrast, crush, lift, shadowTint, highlightTint, posterize } = grade;
  const steps = posterize > 1 ? posterize - 1 : 0;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i] / 255;
    let g = px[i + 1] / 255;
    let b = px[i + 2] / 255;
    // Saturation around the pixel's own luminance.
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = lum + (r - lum) * saturation;
    g = lum + (g - lum) * saturation;
    b = lum + (b - lum) * saturation;
    // Contrast.
    r = sCurve(r, contrast);
    g = sCurve(g, contrast);
    b = sCurve(b, contrast);
    // Split tone, weighted by the graded luminance so the two tints meet mid-frame.
    const l2 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sw = (1 - l2) * (1 - l2);
    const hw = l2 * l2;
    r += shadowTint[0] * sw + highlightTint[0] * hw;
    g += shadowTint[1] * sw + highlightTint[1] * hw;
    b += shadowTint[2] * sw + highlightTint[2] * hw;
    // Black point: crush the darks down, or lift them toward a warm floor.
    if (crush > 0) {
      r = Math.max(0, (r - crush) / (1 - crush));
      g = Math.max(0, (g - crush) / (1 - crush));
      b = Math.max(0, (b - crush) / (1 - crush));
    }
    if (lift > 0) {
      r = r * (1 - lift) + lift;
      g = g * (1 - lift) + lift * 0.92;
      b = b * (1 - lift) + lift * 0.7;
    }
    // Poster Ink: snap to a few hard levels last, so the bands stay clean.
    if (steps > 0) {
      r = Math.round(clamp01(r) * steps) / steps;
      g = Math.round(clamp01(g) * steps) / steps;
      b = Math.round(clamp01(b) * steps) / steps;
    }
    px[i] = clamp01(r) * 255;
    px[i + 1] = clamp01(g) * 255;
    px[i + 2] = clamp01(b) * 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}
