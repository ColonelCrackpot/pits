'use strict';
// ============================== shared mutable state ==============================
let state = 'menu';           // 'menu' | 'run' | 'over'
let paused = false;           // mid-run pause: sim frozen, panel open
let moshers = [], particles = [], floats = [], coins = [];
let player = null, god = false;
let runT = 0, runCred = 0, runScore = 0, runKos = 0, combo = 0, comboT = 0, doubled = false;
let shake = 0, redFlash = 0, freezeT = 0, whiteFlash = 0;
let banner = null;            // {txt, sub, t, dur, color}
let ev = null;                // {type, phase, t, ...}
let evTimer = 18;             // seconds until next pit event
let diver = null;
let calm = 0;                 // between-song lull: crowd thins out and stops brawling
let songToast = null;         // {title, t} — shown by the stage when a track starts
let windUsed = 0;             // Second Wind revives used this set
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');

const intensity = () => state === 'run' ? Math.min(1, runT / 150) : 0.25;
// the pit KEEPS filling long after stats plateau: 12 at the door, ~26 by 2:30,
// then a steady stream of walk-ins toward a ~96-body cap around the 8-minute mark
const maxNpc = () => {
  if (calm > 0) return Math.ceil((12 + 14 * intensity()) * 0.35);
  const late = state === 'run' ? Math.min(70, Math.max(0, (runT - 150) * 0.2)) : 0;
  return 12 + Math.floor(14 * intensity() + late);
};
const liveNpc = () => moshers.reduce((n, m) => n + (!m.isPlayer && !m.dead && !m.ko && !m.boss && !m.minion ? 1 : 0), 0);
let nextBossT = 90;           // run time of the next boss entrance
const BOSS_ROTATION = ['jarrad', 'shane', 'luke', 'kylegym', 'gothtwins', 'adrian', 'reno', 'andre', 'barry'];
let bossIdx = 0;
let bossProjs = [];           // thrown boss projectiles (idle right now — infra stays)
