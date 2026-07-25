'use strict';
// ============================== input ==============================
// Punching is AUTOMATIC (see the player branch in sim.js). Input is movement
// plus up to four equipped abilities on SPACE / Q / E / R (touch: the four
// round buttons; the big 🤘 button is slot 1).
const kb = {};
let stickVec = { x: 0, z: 0 }, stickId = null, stickOrigin = null;

window.addEventListener('keydown', e => {
  audioInit();
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  kb[e.code] = true;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  if ((e.code === 'Space' || e.code === 'Enter') && state === 'menu' && $('boardOv').style.display === 'none') { startRun(); return; }
  if (state === 'run') {
    const slot = SLOT_CODES.indexOf(e.code);
    if (slot >= 0) useSlot(slot);
    if (e.code === 'KeyF') itemAction();   // use held item / order at the bar
  }
});
window.addEventListener('keyup', e => { kb[e.code] = false; });

canvas.addEventListener('pointerdown', e => {
  audioInit();
  if (state !== 'run') return;
  if (isTouch) {
    if (e.clientX < W * 0.55 && stickId === null) {
      stickId = e.pointerId;
      stickOrigin = { x: e.clientX, y: e.clientY };
      const st = $('stick');
      st.style.left = (e.clientX - 48) + 'px'; st.style.top = (e.clientY - 48) + 'px';
      st.style.display = 'block';
    }
  } else {
    useSlot(0);   // click = slot 1, same as SPACE
  }
});
window.addEventListener('pointermove', e => {
  if (e.pointerId === stickId && stickOrigin) {
    let dx = e.clientX - stickOrigin.x, dy = e.clientY - stickOrigin.y;
    const d = hyp(dx, dy);
    if (d > 48) { dx = dx / d * 48; dy = dy / d * 48; }
    $('nub').style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    stickVec = { x: dx / 48, z: -dy / 48 };
  }
});
function stickEnd(e) {
  if (e.pointerId === stickId) {
    stickId = null; stickVec = { x: 0, z: 0 };
    $('stick').style.display = isTouch ? 'none' : '';
    $('nub').style.transform = 'translate(-50%,-50%)';
  }
}
window.addEventListener('pointerup', stickEnd);
window.addEventListener('pointercancel', stickEnd);

// touch: big button = slot 1, the three small ones = slots 2-4
const SLOT_BTN = ['swingBtn', 'abKick', 'abWind', 'abBerserk'];
SLOT_BTN.forEach((btnId, i) => {
  $(btnId).addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); audioInit(); useSlot(i);
  });
});
// the contextual item button: chug / smash / order — whatever F would do
$('itemBtn').addEventListener('pointerdown', e => {
  e.preventDefault(); e.stopPropagation(); audioInit(); itemAction();
});
function updateAbBtns() {
  SLOT_BTN.forEach((btnId, i) => {
    const el = $(btnId);
    if (!el) return;
    const id = save.loadout[i];
    el.style.display = isTouch && id && state === 'run' ? 'block' : 'none';
    if (id) {
      const a = ABILITIES.find(x => x.id === id);
      el.textContent = a.icon;
      el.style.opacity = abState[id].cd > 0 ? 0.35 : 1;
    }
  });
}
window.addEventListener('contextmenu', e => e.preventDefault());
