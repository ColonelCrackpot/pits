'use strict';
// ============================== mosher bodies ==============================
// Mosher archetypes. Bosses & specials slot in HERE without touching anything
// else: add an entry with any of these optional hooks —
//   init(m)   — after the base body is built: override hp/speed/size/look…
//   think(m)  — replaces the default AI decision for this type (js/ai.js)
//   draw(m, pr, s) — replaces the default body renderer (js/render.js)
// Then spawn one with makeMosher(x, z, false, 'yourType').
const MOSHER_TYPES = {
  punk: {},   // the default crowd body — all standard behavior

  // BOSS #1 — Skinny Jean Gene. Tall, lanky, immaculate denim. Ignores
  // formations, lulls and manners: he walks at YOU and sweeps everyone
  // stupid enough to stand near him.
  gene: {
    init(m) {
      m.boss = true;
      m.bossName = 'SKINNY JEAN GENE';
      m.bossSub = 'he\'s coming for you';
      m.tag = 'GENE';
      m.h = 88; m.r = 20;                       // a full head and a half taller
      m.maxhp = 380 + 320 * intensity(); m.hp = m.maxhp;
      m.speed = 235;                            // standard (player) pace, relentless
      m.dmg = 11 + 7 * intensity();
      m.aggro = 1;
      m.reach = 42; m.armLen = 17;              // lanky = long everything
      m.windR = 78;                             // his sweeps clear a big circle
      m.abCd = 4;
      m.look.skin = '#e8c4a0';
      m.look.shirt = '#16121a';
      m.look.pants = '#232b46';                 // the skinny jeans
      m.look.hair = '#171310';
      m.look.bald = false; m.look.mohawk = false; m.look.longHair = true;
      m.look.beard = true;
      m.hair = [];
      for (let i = 0; i < 6; i++) { const y = m.h - (i + 1) * 6.5; m.hair.push({ x: 0, y, px: 0, py: y }); }
    },
    think(m) {
      // no formations, no calm, no leaving — just the player
      if (player && !player.ko && !player.dead && state === 'run') {
        m.target = player; m.mode = 'seek';
      } else {
        m.target = null; m.mode = 'goal'; m.goal = { x: 0, z: D * 0.5 };
      }
      // periodic 360° sweep when anyone crowds him
      if (m.abCd <= 0) {
        let near = 0;
        for (const o of moshers) {
          if (o === m || o.ko || o.dead) continue;
          if (hyp(o.x - m.x, o.z - m.z) < m.windR) near++;
        }
        if (near) { npcWindmill(m); m.abCd = rnd(5, 8); }
      }
    },
  },
};

// BOSS #2 — Shirtless Shawn. No shirt, no neck, no mercy. Slow on his feet,
// barely feels knockback, and every few seconds he plants, flexes, and
// bull-charges in a straight line through everything.
MOSHER_TYPES.shawn = {
  init(m) {
    m.boss = true;
    m.bossName = 'SHIRTLESS SHAWN';
    m.bossSub = 'absolute unit';
    m.tag = 'SHAWN';
    m.h = 64; m.r = 23; m.bulk = 1.8;          // not tall — WIDE
    m.maxhp = 550 + 400 * intensity(); m.hp = m.maxhp;
    m.speed = 150;                              // lumbers…
    m.dmg = 16 + 8 * intensity();
    m.aggro = 1;
    m.reach = 34; m.armLen = 13;
    m.kbResist = 0.25;                          // muscle absorbs the hit
    m.chargeCd = 5; m.chargeT = 0; m.charging = 0;
    m.look.skin = '#d99e6a';
    m.look.shirt = shade(m.look.skin, -20);     // that's not a shirt, that's torso
    m.look.pants = '#2c3040';
    m.look.hair = '#2b1d12';
    m.look.bald = false; m.look.mohawk = false; m.look.longHair = false;   // short hair
    m.look.beard = true;
    m.hair = null;
  },
  think(m) {
    if (player && !player.ko && !player.dead && state === 'run') {
      m.target = player; m.mode = 'seek';
    } else {
      m.target = null; m.mode = 'goal'; m.goal = { x: 0, z: D * 0.5 };
    }
    // line up a bull charge when the player is at rushing distance
    if (m.chargeCd <= 0 && m.chargeT <= 0 && m.charging <= 0 && player && !player.ko && state === 'run') {
      const d = hyp(player.x - m.x, player.z - m.z);
      if (d > 110 && d < 430) {
        m.chargeT = 0.55;   // the flex — your warning
        floats.push({ x: m.x, z: m.z, y: m.h + 20, txt: '💪', t: 0, color: '#ffd166' });
        boom(0.15, 0.4, 200);
      }
    }
  },
  tick(m, dt) {
    m.chargeCd = Math.max(0, m.chargeCd - dt);
    if (m.chargeT > 0) {
      // telegraph: feet planted, arms up in a double-bicep flex
      m.chargeT -= dt;
      m.tvx = 0; m.tvz = 0;
      for (const [arm, sgn] of [[m.armL, -1], [m.armR, 1]]) {
        arm.hx += (sgn * 15 - arm.hx) * 0.4;
        arm.hy += (m.h * 0.98 - arm.hy) * 0.4;
      }
      if (m.chargeT <= 0 && player && !player.ko) {
        const dx = player.x - m.x, dz = player.z - m.z, d = hyp(dx, dz) || 1;
        m.chargeDir = { x: dx / d, z: dz / d };
        m.charging = 0.9;
        boom(0.35, 0.6, 350);
      }
    } else if (m.charging > 0) {
      m.charging -= dt;
      m.tvx = m.chargeDir.x * 720; m.tvz = m.chargeDir.z * 720;
      // trample everything in the lane
      for (const o of moshers) {
        if (o === m || o.ko || o.dead || o.bumpCd > 0) continue;
        const dx = o.x - m.x, dz = o.z - m.z, d = hyp(dx, dz);
        if (d < m.r + o.r + 6) {
          o.bumpCd = 0.8;
          hit(o, m.dmg * 1.3 * (o.isPlayer ? 1 : 0.6), { x: dx / (d || 1), z: dz / (d || 1) }, m, 2.4);
        }
      }
      // ran out of pit: thud to a stop
      if (Math.abs(m.x) >= bound(m.z) - 18 || m.z <= 30 || m.z >= D - 20) m.charging = 0;
      if (m.charging <= 0) { m.chargeCd = rnd(5, 8); shake = Math.min(14, shake + 5); }
    }
  },
};

// boss entrance: crowd parts, lights hit, banner drops
function spawnBoss(type) {
  const b = makeMosher(0, D * 0.9, false, type || 'gene');
  moshers.push(b);
  for (const m of moshers) {
    if (m === b || m.isPlayer || m.ko || m.dead) continue;
    const dx = m.x - b.x, dz = m.z - b.z, d = hyp(dx, dz) || 1;
    if (d < 170) { m.vx += dx / d * 520; m.vz += dz / d * 520; }
  }
  whiteFlash = 0.4; shake = Math.min(20, shake + 14);
  banner = { txt: b.bossName || 'BOSS', sub: b.bossSub || '', t: 0, dur: 2.6, color: '#c86bff' };
  sfx.horn(); boom(0.5, 0.6, 300);
  return b;
}

function makeLook() {
  const bald = Math.random() < 0.12, mohawk = !bald && Math.random() < 0.14;
  return {
    skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(['#3a4260', '#333848', '#4a3a34']),
    hair: pick(HAIRC), bald, mohawk,
    longHair: !bald && !mohawk && Math.random() < 0.6,
    beard: Math.random() < 0.35,
    hue: rndi(0, 360),
  };
}
function makeArm() {
  return { ex: 8, ey: 34, epx: 8, epy: 34, hx: 12, hy: 26, hpx: 12, hpy: 26 };
}
function makeMosher(x, z, isPlayer, type) {
  const m = {
    isPlayer: !!isPlayer, type: type || 'punk',
    x, z, vx: 0, vz: 0, tvx: 0, tvz: 0, r: isPlayer ? 17 : 16,
    face: { x: 0, z: isPlayer ? 1 : -1 },
    hp: 1, maxhp: 1,
    swing: null, swingCd: 0, invuln: 0, stun: 0, bumpCd: 0, flash: 0,
    ko: false, koT: 0, rag: null, dead: false,
    bangPhase: rnd(0, 6.28), walkPhase: rnd(0, 6.28),
    armL: makeArm(), armR: makeArm(),
    hair: null, look: makeLook(),
    think: rnd(0, 0.2), target: null, goal: null, mode: 'roam',
    side: 0, circA: rnd(0, 6.28), lastHitBy: null, regenT: 0,
    h: isPlayer ? 58 : rnd(52, 60),
  };
  m.armL.ex = -8; m.armL.epx = -8; m.armL.hx = -12; m.armL.hpx = -12;
  const hairInit = () => {
    const arr = [];
    for (let i = 0; i < 4; i++) { const y = m.h - (i + 1) * 5.5; arr.push({ x: 0, y, px: 0, py: y }); }
    return arr;
  };
  if (m.look.longHair) m.hair = hairInit();
  if (isPlayer) {
    applyStyle(m);
    m.maxhp = 100 + 25 * lvl('skull'); m.hp = m.maxhp;
  } else {
    m.maxhp = 40 + 34 * intensity() + rnd(-6, 6); m.hp = m.maxhp;
    m.speed = rnd(140, 185) + 60 * intensity();
    m.dmg = 5 + 5 * intensity() + rnd(0, 2);
    m.aggro = rnd(0.4, 1);
    m.abCd = rnd(6, 15);   // NPCs bust out moves too (kick / windmill)
    m.windT = 0; m.kickT = 0;
  }
  const T = MOSHER_TYPES[m.type];
  if (T && T.init) T.init(m);
  return m;
}
// apply the saved character style to the player body
function applyStyle(m) {
  const st = save.style;
  m.look.skin = st.skin; m.look.shirt = st.shirt; m.look.pants = st.pants;
  m.look.hair = st.hair; m.look.beard = !!st.beard;
  m.look.longHair = st.hairStyle === 'long';
  m.look.mohawk = st.hairStyle === 'mohawk';
  m.look.bald = st.hairStyle === 'bald';
  if (m.look.longHair && !m.hair) {
    m.hair = [];
    for (let i = 0; i < 4; i++) { const y = m.h - (i + 1) * 5.5; m.hair.push({ x: 0, y, px: 0, py: y }); }
  }
  if (!m.look.longHair) m.hair = null;
}
// current player stats with upgrades + berserk applied
const pStats = () => {
  const rage = abState.berserk.t > 0;
  return {
    dmg: (24 + 8 * lvl('fists')) * (rage ? 1.6 : 1),
    speed: 235 * (1 + 0.1 * lvl('boots')) * (rage ? 1.3 : 1),
    reach: 34 * (1 + 0.15 * lvl('reach')),
    kb: (1 + 0.15 * lvl('reach')) * (rage ? 1.4 : 1),
    credMult: 1 + 0.2 * lvl('pres'),
  };
};
// windmilling: player state lives in abState, NPCs carry their own timer
const isWindmilling = m => m.isPlayer ? abState.wind.t > 0 : (m.windT || 0) > 0;

function spawnNpc(edge, type) {
  let x, z;
  if (edge) {
    if (Math.random() < 0.6) { z = rnd(D * 0.82, D * 0.95); x = rnd(-1, 1) * bound(z) * 0.9; }
    else { z = rnd(D * 0.2, D * 0.7); x = (Math.random() < 0.5 ? -1 : 1) * bound(z) * 0.96; }
  } else {
    z = rnd(D * 0.15, D * 0.85); x = rnd(-0.9, 0.9) * bound(z);
  }
  moshers.push(makeMosher(x, z, false, type));
}
