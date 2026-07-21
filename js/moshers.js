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

};

// ---- boss helpers: shared brain + base setup, venue-scaled stats ----
function bossBase(m, name, tag, sub) {
  m.boss = true; m.bossName = name; m.tag = tag; m.bossSub = sub; m.aggro = 1;
  m.hp = m.maxhp = m.maxhp * venueMult('hp');
  m.dmg = m.dmg * venueMult('dmg');
  m.speed = m.speed * Math.min(1.8, venueMult('speed'));
}
function bossChase(m) {   // no formations, no calm, no leaving — just the player
  if (player && !player.ko && !player.dead && state === 'run') {
    m.target = player; m.mode = 'seek';
  } else {
    m.target = null; m.mode = 'goal'; m.goal = { x: 0, z: D * 0.5 };
  }
}

// BOSS — Skinny Jean Jarrad. Tall, lanky, immaculate denim. Walks at YOU at
// your own pace forever and sweeps everyone stupid enough to crowd him.
MOSHER_TYPES.jarrad = {
  init(m) {
    m.h = 88; m.r = 20;
    m.maxhp = 380 + 320 * intensity();
    m.speed = 235; m.dmg = 11 + 7 * intensity();
    m.reach = 42; m.armLen = 17;
    m.windR = 78; m.abCd = 4;
    m.look.skin = '#8d5b3c';                    // Jarrad
    m.look.shirt = '#c41f2e';                   // red top…
    m.look.sleeves = '#2f9e46';                 // …green long sleeves underneath
    m.look.pants = '#3a5a9e';                   // skinny blue jeans
    m.look.shoes = '#7e3ff2';                   // purple shoes
    m.look.hair = '#141216';                    // emo black, roots to tips
    m.look.bald = false; m.look.mohawk = false; m.look.longHair = true;
    m.look.beard = true;
    m.hair = [];
    for (let i = 0; i < 6; i++) { const y = m.h - (i + 1) * 6.5; m.hair.push({ x: 0, y, px: 0, py: y }); }
    bossBase(m, 'SKINNY JEAN JARRAD', 'JARRAD', 'he\'s coming for you');
  },
  think(m) {
    bossChase(m);
    if (m.abCd <= 0) {   // periodic 360° sweep when anyone crowds him
      for (const o of moshers) {
        if (o === m || o.ko || o.dead) continue;
        if (hyp(o.x - m.x, o.z - m.z) < m.windR) { npcWindmill(m); m.abCd = rnd(5, 8); break; }
      }
    }
  },
};

// BOSS — Long Hair Luke. The hair arrives before he does. Wide-radius hair
// windmills, constantly, at anything.
MOSHER_TYPES.luke = {
  init(m) {
    m.h = 74; m.r = 18;
    m.maxhp = 300 + 260 * intensity();
    m.speed = 195; m.dmg = 9 + 6 * intensity();
    m.reach = 36; m.windR = 95; m.abCd = 3;
    m.look.skin = '#e8b48c';
    m.look.shirt = '#141216';                   // black top
    m.look.pants = '#3a5a9e';                   // blue jeans
    m.look.hair = '#4a2c14';                    // the famous brown
    m.look.prop = 'vguitar';                    // the white V never leaves his body
    m.look.bald = false; m.look.mohawk = false; m.look.longHair = true;
    m.look.beard = false;
    m.hair = [];                                // SUPER long: 10 segments
    for (let i = 0; i < 10; i++) { const y = m.h - (i + 1) * 6; m.hair.push({ x: 0, y, px: 0, py: y }); }
    bossBase(m, 'LONG HAIR LUKE', 'LUKE', 'mind the hair');
  },
  think(m) {
    bossChase(m);
    if (m.abCd <= 0) { npcWindmill(m); m.windT = 2.2; m.abCd = rnd(4, 6); }   // hair goes BRRR
  },
};

// BOSS — Gym Bro Kyle. Never skips anything. Periodically stops to pump up:
// heals, rages, and comes back meaner.
MOSHER_TYPES.kylegym = {
  init(m) {
    m.h = 66; m.r = 21; m.bulk = 1.5;
    m.maxhp = 420 + 340 * intensity();
    m.speed = 185; m.dmg = 12 + 7 * intensity();
    m.reach = 34; m.kbResist = 0.5;
    m.pumpCd = 8;
    m.look.skin = '#d99e6a';
    m.look.shirt = shade(m.look.skin, -20);     // shirt would only hide the gains
    m.look.pants = '#2c3040';
    m.look.hair = '#2b1d12';
    m.look.mask = 'gold';                       // the gold devil mask
    m.look.bald = false; m.look.mohawk = false; m.look.longHair = false;
    m.look.beard = false;
    m.hair = null;
    bossBase(m, 'GYM BRO KYLE', 'KYLE', 'it\'s not a phase, it\'s a lifestyle');
  },
  think(m) { bossChase(m); },
  tick(m, dt) {
    m.pumpCd = Math.max(0, m.pumpCd - dt);
    if (m.pumpT > 0) {
      m.pumpT -= dt;
      m.tvx = 0; m.tvz = 0;
      for (const [arm, sgn] of [[m.armL, -1], [m.armR, 1]]) {   // double bicep
        arm.hx += (sgn * 14 - arm.hx) * 0.4;
        arm.hy += (m.h * 0.95 - arm.hy) * 0.4;
      }
      if (m.pumpT <= 0) {
        m.rageT = 4;
        m.hp = Math.min(m.maxhp, m.hp + m.maxhp * 0.1);
        floats.push({ x: m.x, z: m.z, y: m.h + 20, txt: 'PUMPED', t: 0, color: '#ff5b47' });
        boom(0.3, 0.5, 300);
      }
    } else if (m.pumpCd <= 0) {
      m.pumpT = 0.8;
      floats.push({ x: m.x, z: m.z, y: m.h + 20, txt: '💪', t: 0, color: '#ffd166' });
      m.pumpCd = rnd(9, 13);
    }
  },
};

// BOSS — Angry Adrian. Regular-sized. Furious. Periodically goes berserk,
// exactly like your Berserk, which he thinks he invented.
MOSHER_TYPES.adrian = {
  init(m) {
    m.h = 60; m.r = 17;
    m.maxhp = 260 + 240 * intensity();
    m.speed = 225; m.dmg = 10 + 7 * intensity();
    m.reach = 30; m.rageCd = 6;
    m.bulk = 1.35;                              // bulky
    m.look.skin = '#f0c9a8';
    m.look.shirt = '#141216';                   // black shirt…
    m.look.logo = 'AIDS';                       // …with the logo
    m.look.logoColor = '#ff2222';
    m.look.pants = '#6a7064';                   // grey camo
    m.look.slops = true;                        // slops. in the pit. legend.
    m.look.hair = '#2b1d12';
    m.look.bald = true; m.look.mohawk = false; m.look.longHair = false;
    m.look.beard = true;
    m.hair = null;
    bossBase(m, 'ANGRY ADRIAN', 'ADRIAN', 'he was born like this');
  },
  think(m) { bossChase(m); },
  tick(m, dt) {
    m.rageCd = Math.max(0, m.rageCd - dt);
    if (m.rageCd <= 0) {
      m.rageT = 5;
      m.rageCd = rnd(11, 15);
      floats.push({ x: m.x, z: m.z, y: m.h + 20, txt: '😤', t: 0, color: '#ff5b47' });
      beep(120, 55, 0.5, 'sawtooth', 0.2);
      shake = Math.min(12, shake + 5);
    }
  },
};

// BOSS — Rockstar Reno. Windmills an invisible guitar, then drops a power
// chord: a shockwave that launches everyone around him.
MOSHER_TYPES.reno = {
  init(m) {
    m.h = 68; m.r = 18;
    m.maxhp = 300 + 260 * intensity();
    m.speed = 190; m.dmg = 9 + 6 * intensity();
    m.reach = 32; m.chordCd = 6;
    m.look.skin = '#b07a4a';
    m.look.shirt = '#181418';                   // black vest / wife-beater
    m.look.pants = '#5a5844';                   // cargo pants
    m.look.chain = true;                        // silver chain off the hip
    m.look.hair = '#0d0d0f';                    // long black hair
    m.look.bald = false; m.look.mohawk = false; m.look.longHair = true;
    m.look.beard = false;
    m.hair = [];
    for (let i = 0; i < 6; i++) { const y = m.h - (i + 1) * 6; m.hair.push({ x: 0, y, px: 0, py: y }); }
    bossBase(m, 'ROCKSTAR RENO', 'RENO', 'every pit is his encore');
  },
  think(m) { bossChase(m); },
  tick(m, dt) {
    m.chordCd = Math.max(0, m.chordCd - dt);
    if (m.chordT > 0) {
      m.chordT -= dt;
      m.tvx = 0; m.tvz = 0;
      if (m.chordT <= 0) {   // the chord lands
        for (const o of moshers) {
          if (o === m || o.ko || o.dead) continue;
          const dx = o.x - m.x, dz = o.z - m.z, d = hyp(dx, dz) || 1;
          if (d > 150 + o.r) continue;
          hit(o, m.dmg * (o.isPlayer ? 1 : 0.5), { x: dx / d, z: dz / d }, m, 2.6);
        }
        whiteFlash = Math.max(whiteFlash, 0.25);
        shake = Math.min(18, shake + 10);
        sfx.horn(); boom(0.4, 0.6, 200);
      }
    } else if (m.chordCd <= 0 && player && !player.ko && hyp(player.x - m.x, player.z - m.z) < 190) {
      m.chordT = 0.55;
      floats.push({ x: m.x, z: m.z, y: m.h + 20, txt: '🎸', t: 0, color: '#ffd166' });
      beep(82, 80, 0.5, 'sawtooth', 0.2);
      m.chordCd = rnd(8, 11);
    }
  },
};

// BOSS — Cargo Shorts Kyle. No relation. Those pockets are FULL and every
// single thing in them is aimed at your head.
MOSHER_TYPES.kylecargo = {
  init(m) {
    m.h = 62; m.r = 18;
    m.maxhp = 280 + 240 * intensity();
    m.speed = 170; m.dmg = 10 + 6 * intensity();
    m.reach = 30; m.throwCd = 3;
    m.look.skin = '#f0c9a8';
    m.look.shirt = '#33202a';
    m.look.pants = '#5a5844';                   // the cargo shorts
    m.look.hair = '#2b1d12';
    m.look.bald = false; m.look.mohawk = false; m.look.longHair = false;
    m.look.beard = true;
    m.hair = null;
    bossBase(m, 'CARGO SHORTS KYLE', 'KYLE', 'everything in those pockets is for you');
  },
  think(m) {
    // keeps his distance like a coward with full pockets
    if (player && !player.ko && !player.dead && state === 'run') {
      const d = hyp(player.x - m.x, player.z - m.z);
      if (d < 160) {   // back off
        m.mode = 'goal';
        m.goal = { x: clamp(m.x + (m.x - player.x), -bound(m.z), bound(m.z)), z: clamp(m.z + (m.z - player.z), 40, D - 30) };
      } else bossChase(m);
    } else bossChase(m);
  },
  tick(m, dt) {
    m.throwCd = Math.max(0, m.throwCd - dt);
    if (m.throwCd <= 0 && player && !player.ko && state === 'run') {
      const dx = player.x - m.x, dz = player.z - m.z, d = hyp(dx, dz);
      if (d > 90 && d < 420) {
        m.face = { x: dx / d, z: dz / d };
        bossProjs.push({
          x: m.x + m.face.x * 14, z: m.z + m.face.z * 14, y: 44,
          vx: dx / d * 420, vz: dz / d * 420, vy: 30,
          t: 0, dmg: m.dmg * 1.1, from: m,
        });
        // the throwing arm snaps forward
        const arm = m.face.x >= 0 ? m.armR : m.armL;
        arm.hpx = arm.hx + m.face.x * 12; arm.hpy = arm.hy - 10;
        beep(600, 250, 0.1, 'square', 0.1);
        m.throwCd = rnd(2.5, 4.5);
      }
    }
  },
};

// BOSS — Wi-Fi Andre. Terrible connection. Keeps lagging out of reality and
// reappearing right next to you.
MOSHER_TYPES.andre = {
  init(m) {
    m.h = 60; m.r = 17;
    m.maxhp = 240 + 220 * intensity();
    m.speed = 180; m.dmg = 11 + 7 * intensity();
    m.reach = 30; m.blinkCd = 5;
    m.look.skin = '#c98d63';
    m.look.shirt = '#1e2630';
    m.look.pants = '#333848';
    m.look.hair = '#171310';
    m.look.bald = false; m.look.mohawk = false; m.look.longHair = false;
    m.look.beard = false;
    m.hair = null;
    bossBase(m, 'WI-FI ANDRE', 'ANDRE', 'you can\'t block what buffers');
  },
  think(m) { bossChase(m); },
  tick(m, dt) {
    m.blinkCd = Math.max(0, m.blinkCd - dt);
    if (m.blinkT > 0) {
      m.blinkT -= dt;
      m.tvx = 0; m.tvz = 0;
      if (m.blinkT <= 0 && player && !player.ko) {   // reconnected. behind you.
        const ang = rnd(0, 6.28);
        m.x = clamp(player.x + Math.cos(ang) * 55, -bound(player.z), bound(player.z));
        m.z = clamp(player.z + Math.sin(ang) * 45, 40, D - 30);
        m.face = { x: Math.sign(player.x - m.x) || 1, z: 0 };
        floats.push({ x: m.x, z: m.z, y: m.h + 20, txt: '📶', t: 0, color: '#8fd3ff' });
        beep(1400, 700, 0.12, 'square', 0.1);
      }
    } else if (m.blinkCd <= 0 && player && !player.ko && hyp(player.x - m.x, player.z - m.z) > 120) {
      m.blinkT = 0.4;   // buffering…
      floats.push({ x: m.x, z: m.z, y: m.h + 20, txt: '📶…', t: 0, color: '#8fd3ff' });
      m.blinkCd = rnd(6, 9);
    }
  },
};

// BOSS — Bearfoot Barry. Shoes are a societal construct. The ground disagrees
// with his stomps, loudly.
MOSHER_TYPES.barry = {
  init(m) {
    m.h = 68; m.r = 21; m.bulk = 1.35;
    m.maxhp = 380 + 300 * intensity();
    m.speed = 160; m.dmg = 13 + 8 * intensity();
    m.reach = 32; m.kbResist = 0.6; m.stompCd = 5;
    m.look.skin = '#e8b48c';
    m.look.shirt = '#402a18';
    m.look.pants = '#4a3a34';
    m.look.hair = '#2b1d12';
    m.look.bald = true; m.look.mohawk = false; m.look.longHair = false;
    m.look.beard = true;                        // all the hair went to the beard
    m.hair = null;
    bossBase(m, 'BEARFOOT BARRY', 'BARRY', 'the floor fears him');
  },
  think(m) { bossChase(m); },
  tick(m, dt) {
    m.stompCd = Math.max(0, m.stompCd - dt);
    if (m.stompT > 0) {
      m.stompT -= dt;
      m.tvx = 0; m.tvz = 0;
      m.kickT = Math.max(m.kickT || 0, 0.3);   // leg up…
      if (m.stompT <= 0) {                     // …and DOWN
        for (const o of moshers) {
          if (o === m || o.ko || o.dead) continue;
          const dx = o.x - m.x, dz = o.z - m.z, d = hyp(dx, dz) || 1;
          if (d > 120 + o.r) continue;
          hit(o, m.dmg * 1.2 * (o.isPlayer ? 1 : 0.6), { x: dx / d, z: dz / d }, m, 2.2);
          if (o.isPlayer) o.stun = Math.max(o.stun, 0.5);
        }
        spawnHitFx(m.x, m.z, 4); spawnHitFx(m.x, m.z, 12);
        shake = Math.min(20, shake + 12);
        boom(0.5, 0.7, 160);
      }
    } else if (m.stompCd <= 0 && player && !player.ko && hyp(player.x - m.x, player.z - m.z) < 130) {
      m.stompT = 0.45;
      floats.push({ x: m.x, z: m.z, y: m.h + 20, txt: '🦶', t: 0, color: '#ffd166' });
      m.stompCd = rnd(7, 10);
    }
  },
};

// BOSS — Shirtless Shane. No shirt, no neck, no mercy. Slow on his feet,
// barely feels knockback, and every few seconds he plants, flexes, and
// bull-charges in a straight line through everything.
MOSHER_TYPES.shane = {
  init(m) {
    m.h = 64; m.r = 23; m.bulk = 1.8;          // not tall — WIDE
    m.maxhp = 550 + 400 * intensity();
    m.speed = 150;                              // lumbers…
    m.dmg = 16 + 8 * intensity();
    m.reach = 34; m.armLen = 13;
    m.kbResist = 0.25;                          // muscle absorbs the hit
    m.chargeCd = 5; m.chargeT = 0; m.charging = 0;
    m.look.skin = '#d99e6a';
    m.look.shirt = shade(m.look.skin, -20);     // that's not a shirt, that's torso
    m.look.pants = '#3a5a9e';                   // jeans
    m.look.shoes = '#141216';                   // black boots
    m.look.armband = '#141216';                 // spiked stud armbands
    m.look.hair = '#4a2c14';                    // short brown
    m.look.bald = false; m.look.mohawk = false; m.look.longHair = false;
    m.look.beard = true;
    m.hair = null;
    bossBase(m, 'SHIRTLESS SHANE', 'SHANE', 'absolute unit');
  },
  think(m) {
    bossChase(m);
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
  const b = makeMosher(0, D * 0.9, false, type || 'jarrad');
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
    // venue scaling: each venue's crowd hits like the previous venue's maxed player
    m.maxhp = (40 + 34 * intensity() + rnd(-6, 6)) * venueMult('hp'); m.hp = m.maxhp;
    m.speed = (rnd(140, 185) + 60 * intensity()) * Math.min(1.8, venueMult('speed'));
    m.dmg = (5 + 5 * intensity() + rnd(0, 2)) * venueMult('dmg');
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
