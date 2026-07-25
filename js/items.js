'use strict';
// ============================== pickups, the bar & the drunk meter ==============================
// PICKUP FRAMEWORK: loot lands on the floor, you walk over it to pick it up
// (one item in hand at a time), and the USE key — F on keyboard, the 🎒 touch
// button — actually fires it. New items slot in HERE without touching anything
// else: add an ITEM_TYPES entry with —
//   name/icon      — HUD + floor rendering (icon is also the floor sprite)
//   uses           — how many uses before it's gone
//   prop           — optional look-prop drawn on the body while held ('vguitar')
//   use()          — fired on the USE key (player is alive & not channeling)
//   arm(m,arm,sgn,shY) — optional per-frame arm choreography while held
//   drawHeld(m,px2,s,arm) — optional extra rendering (bottle in the fist…)
//   breakFx()      — optional send-off when the last use is spent
//   linger         — true: on last use keep it in hand until the anim ends
// Spawn one anywhere with spawnItem(type, x, z).
let items = [];        // loot on the floor: {type, x, z, y, vx, vz, vy, t, full?}
let held = null;       // what the player is carrying: {type, uses, full?}
let drunk = 0;         // 0..100 — liquid confidence, decays over time
let barFlashT = 0;     // the counter glows when you buy
let thrown = [];       // airborne player projectiles: {kind, x, z, y, vx, vz, vy, t, dmg, stun}
let zaps = [];         // chain-lightning arcs: {pts: [{x,z,y}…], t}
let mellowT = 0;       // acoustic aftermath: while > 0, nobody wants to fight you

const beerCost = () => Math.max(1, Math.round(BEER.cost * venueMult('gold')));
// the whole point of drinking: more drunk = more damage (Beer Muscles helps)
const drunkMult = () => 1 + (drunk / 100) * 0.5 * (1 + 0.15 * lvl('buzz'));
// empty bottles read as empty
const heldIcon = () => held.type === 'beer' && !held.full ? '🍾' : ITEM_TYPES[held.type].icon;

// aim a throw: best target in front within range, else just chuck it forward
function throwAim() {
  let best = null, bs = -2;
  for (const m of moshers) {
    if (m.isPlayer || m.ko || m.dead) continue;
    const dx = m.x - player.x, dz = m.z - player.z, d = hyp(dx, dz);
    if (d > 340) continue;
    const dot = (dx * player.face.x + dz * player.face.z) / (d || 1);
    if (dot > bs) { bs = dot; best = { x: dx / d, z: dz / d }; }
  }
  return best || { ...player.face };
}
function throwHeld(kind, dmg, stun) {
  const dir = throwAim();
  player.face = { ...dir };
  thrown.push({
    kind, x: player.x + dir.x * 12, z: player.z + dir.z * 12, y: 44,
    vx: dir.x * 520, vz: dir.z * 520, vy: 70, t: 0, dmg, stun: stun || 0,
  });
  const arm = dir.x >= 0 ? player.armR : player.armL;   // the arm snaps forward
  arm.hpx = arm.hx + dir.x * 14; arm.hpy = arm.hy - 10;
  sfx.whoosh();
}

// mid-chug bottle choreography, shared by anything drinkable
function bottleArm(m, arm, sgn) {
  if ((m.face.x >= 0) !== (sgn > 0)) return;
  if ((m.chugT || 0) > 0) {
    arm.hx += (m.face.x * 3 + (m.headU || 0) - arm.hx) * 0.6;
    arm.hy += ((m.headY || m.h) - 2 - arm.hy) * 0.6;
  } else {
    arm.hx += (m.face.x * 10 - arm.hx) * 0.25;
    arm.hy += (m.h * 0.52 - arm.hy) * 0.25;
  }
}
function guitarBreak(txt) {
  floats.push({ x: player.x, z: player.z, y: player.h + 18, txt, t: 0, color: '#ff8f6b' });
  for (let i = 0; i < 10; i++) particles.push({
    x: player.x, z: player.z, y: 40,
    vx: rnd(-160, 160), vz: rnd(-120, 120), vy: rnd(60, 220),
    t: 0, dur: rnd(0.4, 0.8), size: rnd(1.5, 3), color: pick(['#efe8dc', '#efe8dc', '#2a2018']),
  });
  boom(0.25, 0.5, 500);
}

const ITEM_TYPES = {
  // ---- the guitar family: same swing, very different amps ----
  eguitar: {   // Luke's white V — chain lightning between bodies
    name: 'THE V', icon: '🎸', uses: 3, prop: 'vguitar',
    use() {
      player.smashT = 0.38;
      const s = pStats();
      let src = { x: player.x, z: player.z }, dmg = s.dmg * 1.8;
      const chain = [{ x: player.x, z: player.z, y: 46 }];
      const zapped = new Set();
      for (let b = 0; b < 5; b++) {          // arcs to the nearest, then keeps arcing
        let best = null, bd = b === 0 ? 220 : 150;
        for (const m of moshers) {
          if (m.isPlayer || m.ko || m.dead || zapped.has(m)) continue;
          const d = hyp(m.x - src.x, m.z - src.z);
          if (d < bd) { bd = d; best = m; }
        }
        if (!best) break;
        zapped.add(best);
        const dx = best.x - src.x, dz = best.z - src.z, d = hyp(dx, dz) || 1;
        hit(best, dmg, { x: dx / d, z: dz / d }, player, 1.2);
        chain.push({ x: best.x, z: best.z, y: best.h * 0.6 });
        src = { x: best.x, z: best.z };
        dmg *= 0.75;
      }
      if (chain.length > 1) {
        zaps.push({ pts: chain, t: 0 });
        whiteFlash = Math.max(whiteFlash, 0.15);
        shake = Math.min(18, shake + 8);
      }
      beep(1800, 90, 0.22, 'sawtooth', 0.2);
      boom(0.22, 0.5, 700);
    },
    breakFx() { guitarBreak('THE V IS DEAD 💔'); },
  },
  bass: {      // all bottom end: the huge 170° smash
    name: 'BASS', icon: '🎻', uses: 3, prop: 'bassg',
    use() {
      const s = pStats();
      const dir = kickAim();
      player.face = { ...dir };
      player.smashT = 0.38;
      let landed = false;
      for (const m of moshers) {
        if (m.isPlayer || m.ko || m.dead) continue;
        const dx = m.x - player.x, dz = m.z - player.z, d = hyp(dx, dz) || 1;
        if (d > s.reach * 2 + m.r) continue;
        if ((dx * dir.x + dz * dir.z) / d < 0.05) continue;
        hit(m, s.dmg * 2.6, { x: dx / d, z: dz / d }, player, 3);
        landed = true;
      }
      beep(65, 40, 0.6, 'sawtooth', 0.26);   // the drop
      boom(0.35, 0.7, 160);
      if (landed) { shake = Math.min(20, shake + 10); freezeT = Math.max(freezeT, 0.05); }
    },
    breakFx() { guitarBreak('THE BASS BOTTOMED OUT 💔'); },
  },
  acoustic: {  // one strum and the whole pit remembers it has feelings
    name: 'ACOUSTIC', icon: '🪕', uses: 2, prop: 'acg',
    use() {
      player.smashT = 0.3;
      mellowT = 6;
      for (const m of moshers) {   // everyone hunting you loses the thread
        if (m.isPlayer || m.minion) continue;
        if (m.target === player) {
          m.target = null; m.mode = 'goal';
          m.goal = { x: rnd(-0.6, 0.6) * bound(m.z), z: clamp(m.z + rnd(-80, 80), D * 0.2, D * 0.85) };
        }
      }
      for (let i = 0; i < 8; i++) particles.push({
        x: player.x + rnd(-14, 14), z: player.z + rnd(-10, 10), y: rnd(40, 60),
        vx: rnd(-24, 24), vz: rnd(-16, 16), vy: rnd(30, 60),
        t: 0, dur: rnd(0.9, 1.4), size: 4, char: '♪', color: '#7bff9e',
      });
      banner = { txt: 'KUMBAYA', sub: 'the pit chills out (mostly)', t: 0, dur: 1.4, color: '#7bff9e' };
      beep(220, 220, 0.5, 'triangle', 0.16);   // an honest A major
      beep(277, 277, 0.5, 'triangle', 0.14);
      beep(330, 330, 0.5, 'triangle', 0.14);
    },
    breakFx() { guitarBreak('CAMPFIRE\'S OVER 💔'); },
  },
  // ---- drinkables & throwables ----
  beer: {      // bought: full. found on the floor: 1-in-4 it's your lucky day.
    name: 'BOTTLE', icon: '🍺', uses: 1, manual: true,
    onSpawn(it) { it.full = Math.random() < 0.25; },
    use(item) {
      if (item.full) {
        item.full = false;   // chug now, keep the empty for throwing
        player.chugT = 0.9;
        drunk = Math.min(100, drunk + BEER.drunk * (1 + 0.15 * lvl('liver')));
        floats.push({ x: player.x, z: player.z, y: player.h + 16, txt: '+BUZZ 🍺', t: 0, color: '#ffb84d' });
      } else {
        throwHeld('bottle', 16, 0.2);
        held = null;
      }
    },
    arm(m, arm, sgn) { bottleArm(m, arm, sgn); },
    drawHeld(m, px2, s, arm) {
      const hn = px2(arm.hx, arm.hy);
      const fx = m.face.x >= 0 ? 1 : -1;
      const lift = (m.chugT || 0) > 0 ? Math.sin(Math.min(1, (0.9 - m.chugT) / 0.45) * Math.PI / 2) : 0;
      ctx.save();
      ctx.translate(hn.x, hn.y);
      ctx.rotate(fx * (0.18 - 2 * lift));
      ctx.globalAlpha = held && held.full ? 1 : 0.75;              // drained glass
      ctx.fillStyle = '#7a4a12';                                   // amber glass
      ctx.fillRect(-1.9 * s, -8.5 * s, 3.8 * s, 8.5 * s);
      ctx.fillRect(-0.95 * s, -12 * s, 1.9 * s, 3.5 * s);          // neck
      if (held && held.full) {
        ctx.fillStyle = '#e8d9a0';                                 // label
        ctx.fillRect(-1.9 * s, -6.5 * s, 3.8 * s, 2.6 * s);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },
  },
  glass: {     // a pint glass. it wants to fly.
    name: 'PINT GLASS', icon: '🥃', uses: 1,
    use() { throwHeld('glass', 24, 0.5); },
    arm(m, arm, sgn) { bottleArm(m, arm, sgn); },
    drawHeld(m, px2, s, arm) {
      const hn = px2(arm.hx, arm.hy);
      const fx = m.face.x >= 0 ? 1 : -1;
      ctx.save();
      ctx.translate(hn.x, hn.y);
      ctx.rotate(fx * 0.12);
      ctx.fillStyle = 'rgba(208,226,238,.85)';                     // the glass
      ctx.beginPath();
      ctx.moveTo(-2.6 * s, -8 * s); ctx.lineTo(2.6 * s, -8 * s);   // slight taper
      ctx.lineTo(2 * s, 0); ctx.lineTo(-2 * s, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)';                     // shine
      ctx.fillRect(-0.7 * s, -7.5 * s, 1.2 * s, 7 * s);
      ctx.strokeStyle = 'rgba(235,246,255,.9)';
      ctx.lineWidth = Math.max(1, 0.8 * s);
      ctx.beginPath(); ctx.moveTo(-2.6 * s, -8 * s); ctx.lineTo(2.6 * s, -8 * s); ctx.stroke();
      ctx.restore();
    },
  },
  pick: {      // flicked off the stage — mostly sentimental value
    name: 'GUITAR PICK', icon: '🔻', uses: 1,
    use() {
      throwHeld('pick', 6, 0);
      floats.push({ x: player.x, z: player.z, y: player.h + 14, txt: 'plink', t: 0, color: '#ffd166' });
    },
    arm(m, arm, sgn) { bottleArm(m, arm, sgn); },
    drawHeld(m, px2, s, arm) {   // pinched proudly between two fingers
      const hn = px2(arm.hx, arm.hy);
      const fx = m.face.x >= 0 ? 1 : -1;
      ctx.save();
      ctx.translate(hn.x, hn.y);
      ctx.rotate(fx * 0.25);
      ctx.fillStyle = '#ff9d3a';
      ctx.beginPath();
      ctx.moveTo(0, -6.5 * s); ctx.lineTo(3.4 * s, -1.2 * s);
      ctx.quadraticCurveTo(0, 1.6 * s, -3.4 * s, -1.2 * s);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c46a1a';
      ctx.lineWidth = Math.max(1, 0.7 * s);
      ctx.stroke();
      ctx.restore();
    },
  },
};

function spawnItem(type, x, z, opts) {
  const it = {
    type, x, z: clamp(z, 30, D - 20), y: 26,
    vx: rnd(-60, 60), vz: rnd(-50, 50), vy: rnd(60, 150), t: 0,
  };
  Object.assign(it, opts || {});
  const def = ITEM_TYPES[type];
  if (def.onSpawn) def.onSpawn(it);
  items.push(it);
}
function resetItems() {
  items = []; held = null; drunk = 0; barFlashT = 0;
  thrown = []; zaps = []; mellowT = 0;
  if (player) { player.smashT = 0; player.chugT = 0; }
}

// ---- the bar: a counter along the front-left edge of the pit ----
// Wander down-left, stand at the counter, F buys a beer straight into your hand.
const BAR = { zone: 100, u: 0.32 };   // reachable when z < zone and x left of -u·bound
const atBar = () =>
  player && !player.ko && !player.dead && state === 'run' &&
  player.z < BAR.zone && player.x < -bound(player.z) * BAR.u;

function buyBeer() {
  const cost = beerCost();
  if (runCred < cost) {
    floats.push({ x: player.x, z: player.z, y: 70, txt: 'need ' + cost + ' 🤘', t: 0, color: '#ff8f6b' });
    beep(200, 120, 0.15, 'square', 0.1);
    return;
  }
  runCred -= cost;
  held = { type: 'beer', uses: 1, full: true };   // you paid — it's full
  barFlashT = 0.5;
  floats.push({ x: player.x, z: player.z, y: 76, txt: '🍺', t: 0, color: '#ffd166' });
  sfx.coin();
}

// the USE key: fire what's in your hand — or, empty-handed at the bar, order
function itemAction() {
  if (state !== 'run' || paused || !player || player.ko || player.dead || player.stun > 0) return;
  if (held) {
    if (abChanneling() || (player.chugT || 0) > 0 || (player.smashT || 0) > 0) return;
    const def = ITEM_TYPES[held.type];
    if (def.manual) { def.use(held); return; }   // the item runs its own lifecycle
    def.use(held);
    if (held && --held.uses <= 0) {
      if (def.breakFx) def.breakFx();
      held = null;
    }
  } else if (atBar()) buyBeer();
}

function updateItems(dt) {
  barFlashT = Math.max(0, barFlashT - dt);
  mellowT = Math.max(0, mellowT - dt);
  if (state === 'run') drunk = Math.max(0, drunk - BEER.decay * dt);
  if (player) {
    player.smashT = Math.max(0, (player.smashT || 0) - dt);
    if ((player.chugT || 0) > 0) {
      const prev = player.chugT;
      player.chugT -= dt;
      // glug. glug. glug.
      if (Math.floor(prev / 0.22) !== Math.floor(Math.max(0, player.chugT) / 0.22) && player.chugT > 0)
        beep(170 + rnd(0, 50), 120, 0.07, 'square', 0.12);
    }
  }
  for (const it of items) {
    it.t += dt;
    it.x += it.vx * dt; it.z += it.vz * dt; it.y += it.vy * dt;
    it.vy -= 420 * dt;
    if (it.y <= 0) { it.y = 0; it.vy *= -0.35; it.vx *= 0.6; it.vz *= 0.6; }
    it.z = clamp(it.z, 28, D - 16);
    // walk-over pickup — but only with a free hand
    if (!held && player && !player.ko && !player.dead && state === 'run' &&
        it.t > 0.4 && hyp(it.x - player.x, it.z - player.z) < 30) {
      const def = ITEM_TYPES[it.type];
      held = { type: it.type, uses: def.uses, full: it.full };
      floats.push({ x: it.x, z: it.z, y: 40, txt: def.icon + ' ' + def.name, t: 0, color: '#7bff9e' });
      sfx.buy();
      it.t = 999;
    }
  }
  items = items.filter(it => it.t < 25);
  // airborne throwables: fly, connect, or smash on the floor
  for (const p of thrown) {
    p.t += dt;
    p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
    p.vy -= 260 * dt;
    for (const m of moshers) {
      if (m.isPlayer || m.ko || m.dead) continue;
      if (p.y < m.h && hyp(p.x - m.x, p.z - m.z) < m.r + 9) {
        const d = hyp(p.vx, p.vz) || 1;
        if (p.stun > 0 && !m.boss) m.stun = Math.max(m.stun, p.stun);
        hit(m, p.dmg, { x: p.vx / d, z: p.vz / d }, player, p.kind === 'pick' ? 0.3 : 1.4);
        if (p.kind !== 'pick') smashFx(p.x, p.z, m.h * 0.6);
        else beep(2400, 1800, 0.05, 'square', 0.08);   // plink.
        p.t = 99;
        break;
      }
    }
    if (p.t < 90 && p.y <= 0) {   // floor: glass answers to gravity
      if (p.kind === 'pick') beep(2200, 1600, 0.05, 'square', 0.06);
      else smashFx(p.x, p.z, 4);
      p.t = 99;
    }
  }
  thrown = thrown.filter(p => p.t < 1.4);
  for (const zp of zaps) zp.t += dt;
  zaps = zaps.filter(zp => zp.t < 0.2);
}
function smashFx(x, z, y) {
  for (let i = 0; i < 8; i++) particles.push({
    x, z, y: y + rnd(-4, 4),
    vx: rnd(-150, 150), vz: rnd(-100, 100), vy: rnd(40, 200),
    t: 0, dur: rnd(0.25, 0.5), size: rnd(1.2, 2.6), color: pick(['#d8e4ea', '#b8ccd8', '#7a4a12']),
  });
  boom(0.12, 0.4, 900);
}

// ---- rendering: floor loot, the counter, the drunk HUD ----
// ONE piece of floor loot — called from render.js's depth-sorted pass so a
// bottle lying behind someone is drawn behind them
function drawFloorItem(it) {
  const t = performance.now() / 1000;
  const bob = Math.abs(Math.sin(t * 3 + it.x)) * 3;
  const pr = proj(it.x, it.z, it.y + (it.y <= 0 ? bob : 0));
  ctx.globalAlpha = it.t > 22 ? Math.max(0, (25 - it.t) / 3) : 1;
  if (it.y <= 0.5) {   // loot shimmer so it reads as grabbable
    ctx.strokeStyle = `rgba(123,255,158,${0.35 + 0.3 * Math.sin(t * 5 + it.z)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(pr.x, proj(it.x, it.z, 0).y, 13 * pr.s, 5.5 * pr.s, 0, 0, 6.28);
    ctx.stroke();
  }
  ctx.font = Math.round(15 * pr.s) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(ITEM_TYPES[it.type].icon, pr.x, pr.y);
  ctx.globalAlpha = 1;
}
// anything in the AIR belongs on top of the crowd: thrown glass, lightning
function drawAirborne() {
  for (const p of thrown) {   // stuff you launched, mid-flight
    const pr = proj(p.x, p.z, p.y);
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(p.t * 13);
    if (p.kind === 'pick') {
      ctx.fillStyle = '#ff9d3a';
      ctx.beginPath();
      ctx.moveTo(0, -3.4 * pr.s); ctx.lineTo(3 * pr.s, 1.6 * pr.s);
      ctx.quadraticCurveTo(0, 4 * pr.s, -3 * pr.s, 1.6 * pr.s);
      ctx.closePath(); ctx.fill();
    } else if (p.kind === 'glass') {
      ctx.fillStyle = 'rgba(210,228,238,.85)';
      ctx.fillRect(-2.6 * pr.s, -3.6 * pr.s, 5.2 * pr.s, 7.2 * pr.s);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillRect(-0.8 * pr.s, -3.6 * pr.s, 1.4 * pr.s, 7.2 * pr.s);
    } else {   // bottle
      ctx.fillStyle = '#7a4a12';
      ctx.fillRect(-1.9 * pr.s, -5.5 * pr.s, 3.8 * pr.s, 8.5 * pr.s);
      ctx.fillRect(-0.95 * pr.s, -9 * pr.s, 1.9 * pr.s, 3.5 * pr.s);
    }
    ctx.restore();
  }
  for (const zp of zaps) {   // chain lightning, briefly rearranging the air
    const a = 1 - zp.t / 0.2;
    for (let seg = 0; seg + 1 < zp.pts.length; seg++) {
      const A = proj(zp.pts[seg].x, zp.pts[seg].z, zp.pts[seg].y);
      const B = proj(zp.pts[seg + 1].x, zp.pts[seg + 1].z, zp.pts[seg + 1].y);
      for (const [w, col] of [[6, `rgba(140,200,255,${0.25 * a})`], [2.2, `rgba(235,248,255,${0.9 * a})`]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        for (let k = 1; k < 4; k++) {   // jagged, alive
          const f = k / 4;
          ctx.lineTo(A.x + (B.x - A.x) * f + rnd(-7, 7), A.y + (B.y - A.y) * f + rnd(-7, 7));
        }
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }
    }
  }
}
function drawBar(beat) {
  const zB = 42, zF = 16;                       // counter top: back & front depths
  const sB = xu(zB), sF = xu(zF);
  const topY = syAt(zB), botY = syAt(zF);
  const edgeTop = W / 2 - bound(zB) * (BAR.u - 0.04) * sB;   // where the slab ends
  const edgeBot = W / 2 - bound(zF) * (BAR.u - 0.04) * sF;
  if (edgeTop < 8) return;                      // screen too narrow to seat anyone
  // counter top
  const wood = ctx.createLinearGradient(0, topY, 0, botY);
  wood.addColorStop(0, '#4a2f1a');
  wood.addColorStop(1, '#33200f');
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.moveTo(-60, topY); ctx.lineTo(edgeTop, topY);
  ctx.lineTo(edgeBot, botY); ctx.lineTo(-60, botY);
  ctx.closePath(); ctx.fill();
  if (barFlashT > 0) {   // fresh-pour glow
    ctx.globalAlpha = barFlashT;
    ctx.fillStyle = 'rgba(255,209,102,.35)';
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = '#6b4520';                  // worn edge highlight
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-60, topY + 1); ctx.lineTo(edgeTop, topY + 1); ctx.stroke();
  // front face
  const faceH = 30 * sF;
  ctx.fillStyle = '#211208';
  ctx.beginPath();
  ctx.moveTo(-60, botY); ctx.lineTo(edgeBot, botY);
  ctx.lineTo(edgeBot, botY + faceH); ctx.lineTo(-60, botY + faceH);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#160b04'; ctx.lineWidth = 1.5;
  for (let k = 1; k < 4; k++) {   // paneling
    const px = -60 + (edgeBot + 60) * (k / 4);
    ctx.beginPath(); ctx.moveTo(px, botY + 3); ctx.lineTo(px, botY + faceH - 3); ctx.stroke();
  }
  // bottles lined up along the back of the counter
  const bcols = ['#7a4a12', '#3d5c2a', '#6b1010', '#7a4a12'];
  for (let i = 0; i < 5; i++) {
    const bx = -30 + (edgeTop + 20) * (i / 5);
    if (bx > edgeTop - 14) break;
    ctx.fillStyle = bcols[i % bcols.length];
    ctx.fillRect(bx, topY - 12 * sB, 5 * sB, 12 * sB);
    ctx.fillRect(bx + 1.6 * sB, topY - 17 * sB, 1.8 * sB, 5 * sB);
  }
  // beer tap
  const tx = Math.max(40, edgeTop * 0.55);
  ctx.strokeStyle = '#c8ccd6'; ctx.lineWidth = 3.5 * sB;
  ctx.beginPath(); ctx.moveTo(tx, topY); ctx.lineTo(tx, topY - 13 * sB); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tx, topY - 13 * sB); ctx.lineTo(tx + 7 * sB, topY - 15 * sB); ctx.stroke();
  // the barkeep — back to the camera, towel on the shoulder, judging you
  const bz = 8, bs = xu(bz);
  const bx2 = W / 2 - bound(bz) * 0.62 * bs;
  const by2 = syAt(bz) + 28 * bs;
  const sway = Math.sin(performance.now() / 900) * 2 * bs;
  ctx.fillStyle = '#0c0810';
  ctx.beginPath(); ctx.arc(bx2 + sway, by2 - 62 * bs, 10.5 * bs, 0, 6.28); ctx.fill();
  ctx.fillRect(bx2 - 13 * bs + sway, by2 - 54 * bs, 26 * bs, 54 * bs);
  ctx.fillStyle = '#d8d2c4';   // the towel
  ctx.fillRect(bx2 + 4 * bs + sway, by2 - 54 * bs, 7 * bs, 20 * bs);
  // neon sign hanging over the counter
  const nx = Math.min(edgeTop - 30, Math.max(84, edgeTop * 0.5));
  const ny = topY - Math.min(110, H * 0.14);   // high enough to clear whoever's ordering
  const flick = Math.random() < 0.02 ? 0.35 : 0.9 + 0.1 * beat;
  ctx.save();
  ctx.globalAlpha = flick;
  ctx.font = '900 17px system-ui';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ff36a0'; ctx.shadowBlur = 14;
  ctx.strokeStyle = '#ff77c2'; ctx.lineWidth = 1.2;
  ctx.fillStyle = '#ffd0e8';
  ctx.fillText('PIT STOP', nx, ny);
  ctx.strokeText('PIT STOP', nx, ny);
  ctx.shadowColor = '#ffb84d'; ctx.shadowBlur = 8;
  ctx.font = '800 11px system-ui';
  ctx.fillStyle = '#ffe2b0';
  ctx.fillText('🍺 ' + beerCost() + ' 🤘', nx, ny + 16);
  ctx.restore();
}
// HUD add-ons drawn from drawHud(): the drunk meter + held item chip + bar prompt
function drawDrunkHud(pad, topPad, bw) {
  if (drunk <= 0.5 && lvl('liver') === 0 && lvl('buzz') === 0 && !atBar()) return;
  const y = topPad + 20, w = bw * 0.72, h = 11;
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(pad, y, w, h);
  const frac = clamp(drunk / 100, 0, 1);
  if (frac > 0) {
    const g = ctx.createLinearGradient(pad, 0, pad + w, 0);
    g.addColorStop(0, '#ffb84d'); g.addColorStop(1, '#ff8f2e');
    ctx.fillStyle = g;
    ctx.fillRect(pad + 2, y + 2, (w - 4) * frac, h - 4);
    ctx.fillStyle = '#fff8e0';   // the foam line
    ctx.fillRect(pad + 2 + (w - 4) * frac - 1.5, y + 2, 1.5, h - 4);
  }
  ctx.font = '700 9.5px system-ui'; ctx.textAlign = 'left';
  ctx.fillStyle = '#ffdca0';
  ctx.fillText('🍺', pad + 3, y + h - 2);
  if (drunk > 1) {
    ctx.fillStyle = '#ffb84d';
    ctx.fillText('×' + drunkMult().toFixed(2) + ' DMG', pad + w + 6, y + h - 2);
  }
}
function drawItemHud() {
  // held item chip rides after the ability chips (desktop only — touch has the button)
  if (!isTouch && held) {
    const def = ITEM_TYPES[held.type];
    const ax0 = 12 + 24 + MAX_LOADOUT * 52 + 8, ay0 = H - 38;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(24,18,10,.8)';
    ctx.beginPath(); ctx.arc(ax0, ay0, 21, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.font = '19px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(heldIcon(), ax0, ay0 + 7);
    if (def.uses > 1) {
      ctx.font = '800 11px system-ui';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(held.uses, ax0 + 15, ay0 - 11);
    }
    ctx.font = '700 10px system-ui';
    ctx.fillStyle = '#c99aa0';
    ctx.fillText('F', ax0, ay0 + 33);
    ctx.globalAlpha = 1;
  }
  // standing at the counter, hands free: the pitch
  if (atBar() && !held) {
    const cost = beerCost();
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 300);
    ctx.font = '800 13px system-ui'; ctx.textAlign = 'center';
    ctx.globalAlpha = pulse;
    const msg = '🍺 BEER — ' + cost + ' 🤘 · ' + (isTouch ? 'tap 🍺' : 'press F');
    ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 4;
    ctx.strokeText(msg, W * 0.3, H - 64);
    ctx.fillStyle = runCred >= cost ? '#ffd166' : '#ff8f6b';
    ctx.fillText(msg, W * 0.3, H - 64);
    ctx.globalAlpha = 1;
  }
}
// touch: one contextual round button — use what you hold / order at the bar
function updateItemBtn() {
  const el = $('itemBtn');
  if (!el) return;
  const active = isTouch && state === 'run' && (held || atBar());
  el.style.display = active ? 'block' : 'none';
  if (active) el.textContent = held ? heldIcon() : '🍺';
}
