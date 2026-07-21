'use strict';
// ============================== shared mutable state ==============================
let state = 'menu';           // 'menu' | 'run' | 'over'
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
const maxNpc = () => calm > 0 ? Math.ceil((12 + 14 * intensity()) * 0.35) : 12 + Math.floor(14 * intensity());
const liveNpc = () => moshers.reduce((n, m) => n + (!m.isPlayer && !m.dead && !m.ko && !m.boss ? 1 : 0), 0);
let nextBossT = 90;           // run time of the next boss entrance
const BOSS_ROTATION = ['gene', 'shawn'];
let bossIdx = 0;
