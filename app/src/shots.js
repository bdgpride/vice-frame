// Fixed scenes for screenshots: ?shot=cover shows the finished cover alone, filling the
// window; ?shot=editor shows the whole editor. `photo` picks the sample
// (samples/<photo>.jpg) and `caption` the title line; caption2, layout, grade and size
// (such as size=1080x1350) may refine the scene. Deterministic: the scene is fully
// applied and the fonts are in before window.__shotReady is set.

export async function runShot(shot, query, apply) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await apply({
    photo: query.get('photo') ?? 'pier',
    caption: query.get('caption') ?? 'Sunset Heist',
    caption2: query.get('caption2'),
    layout: query.get('layout'),
    grade: query.get('grade'),
    size: query.get('size'),
  });
  try {
    await Promise.race([
      Promise.all([document.fonts.load('100px Anton'), document.fonts.load('600 40px Oswald')]),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    /* fonts are local files; if one fails the fallbacks still paint */
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
