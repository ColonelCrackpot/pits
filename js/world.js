'use strict';
// ============================== canvas & projection ==============================
// screenY(z) = A + B/(z+CD); px-per-world-unit at depth z: xu(z) = XF/(z+CD).
const canvas = $('c'), ctx = canvas.getContext('2d');
let W = 0, H = 0, dpr = 1;
let A = 0, B = 0, XF = 0;
function relayout() {
  W = innerWidth; H = innerHeight;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const effW = Math.max(W, H * 0.62);
  B = 0.57 * H / (1 / CD - 1 / (D + CD));
  A = 0.97 * H - B / CD;
  XF = 0.94 * effW * (D + CD) / (2 * HALFW);
}
relayout();
window.addEventListener('resize', relayout);
const xu = z => XF / (z + CD);
const syAt = z => A + B / (z + CD);
function bound(z) {
  const lim = 0.49 * W * (z + CD) / XF;
  return (isFinite(lim) ? Math.min(HALFW, lim) : HALFW) - 14;
}
function proj(x, z, y) { const s = xu(z); return { x: W / 2 + x * s, y: syAt(z) - (y || 0) * s, s }; }
function screenToWorld(mx, my) {
  let z = B / Math.max(1, my - A) - CD;
  z = Math.max(0, Math.min(D, z));
  return { x: (mx - W / 2) / xu(z), z };
}
