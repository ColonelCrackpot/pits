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
  if (mellowT > 0) {   // …unless someone's playing acoustic. even bosses feel that.
    m.target = null; m.mode = 'goal';
    if (!m.goal || Math.random() < 0.3)
      m.goal = { x: rnd(-0.5, 0.5) * bound(m.z), z: clamp(m.z + rnd(-80, 80), D * 0.2, D * 0.85) };
    return;
  }
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
    m.look.hair = '#d9b45a';                    // Alexi blonde
    m.look.style = 'alexi';                     // center part, curtains past the chin
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
  onKo(m) {   // the V survives its owner — grab it before it despawns
    spawnItem('eguitar', m.x, m.z);
    floats.push({ x: m.x, z: m.z, y: m.h + 30, txt: 'HE DROPPED THE V!', t: 0, color: '#7bff9e' });
  },
};

// BOSS — Gym Bro Kyle. Never skips anything. Periodically stops to pump up:
// heals, rages, and comes back meaner.
MOSHER_TYPES.kylegym = {
  init(m) {
    m.h = 66; m.r = 23; m.bulk = 1.85;          // never skipped ANY day
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
    m.h = 60; m.r = 20;
    m.maxhp = 300 + 260 * intensity();
    m.speed = 215; m.dmg = 11 + 7 * intensity();
    m.reach = 30; m.rageCd = 6;
    m.bulk = 1.7;                               // built like a fridge with opinions
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
    } else if (m.chordCd <= 0 && mellowT <= 0 && player && !player.ko && hyp(player.x - m.x, player.z - m.z) < 190) {
      m.chordT = 0.55;
      floats.push({ x: m.x, z: m.z, y: m.h + 20, txt: '🎸', t: 0, color: '#ffd166' });
      beep(82, 80, 0.5, 'sawtooth', 0.2);
      m.chordCd = rnd(8, 11);
    }
  },
};

// BOSS — Wi-Fi Andre. Won't fight you himself — he hugs the edge of the pit
// with a controller and pilots a ROBOT at you. Smash the pilot, kill the bot.
MOSHER_TYPES.andre = {
  init(m) {
    m.h = 60; m.r = 17;
    m.maxhp = 280 + 220 * intensity();
    m.speed = 215; m.dmg = 6 + 4 * intensity();   // he's not the threat. it is.
    m.reach = 26; m.blinkCd = 0; m.deployCd = 1.2;
    m.side = Math.random() < 0.5 ? -1 : 1;
    m.look.skin = '#c98d63';
    m.look.shirt = '#1e2630';
    m.look.pants = '#333848';
    m.look.hair = '#171310';
    m.look.controller = true;                   // the rig in his hands
    m.look.bald = false; m.look.mohawk = false; m.look.longHair = false;
    m.look.beard = false;
    m.hair = null;
    bossBase(m, 'WI-FI ANDRE', 'ANDRE', 'he brought a friend');
  },
  think(m) {   // never enters the fray: posts up at the side of the pit
    if (m.spotZ == null) m.spotZ = rnd(D * 0.35, D * 0.7);
    m.target = null;
    m.mode = 'goal';
    m.goal = { x: m.side * (bound(m.spotZ) - 44), z: m.spotZ };
  },
  // he TANKS it now: five hits land before the connection "drops" and he
  // relocates — you get a real combo on him between teleports
  onHit(m) {
    if (m.blinkT > 0 || m.ko) return;
    m.hitTaken = (m.hitTaken || 0) + 1;
    if (m.hitTaken >= 5) {
      m.hitTaken = 0;
      m.blinkT = 0.35;   // buffering…
      floats.push({ x: m.x, z: m.z, y: m.h + 20, txt: '📶…', t: 0, color: '#8fd3ff' });
    }
  },
  tick(m, dt) {
    m.deployCd = Math.max(0, m.deployCd - dt);
    if (m.blinkT > 0) {   // mid-lag: frozen, then gone
      m.blinkT -= dt;
      m.tvx = 0; m.tvz = 0;
      if (m.blinkT <= 0) {
        m.side *= -1;
        m.spotZ = rnd(D * 0.35, D * 0.7);
        m.x = m.side * (bound(m.spotZ) - 44); m.z = m.spotZ;
        floats.push({ x: m.x, z: m.z, y: m.h + 20, txt: '📶', t: 0, color: '#8fd3ff' });
        beep(1400, 700, 0.12, 'square', 0.1);
      }
    }
    // robot management: deploy, lose it, redeploy, repeat
    const botUp = m.bot && !m.bot.ko && !m.bot.dead;
    if (!botUp && m.deployT == null && m.deployCd <= 0) {
      m.deployT = 0.8;
      floats.push({ x: m.x, z: m.z, y: m.h + 20, txt: '📡 PAIRING…', t: 0, color: '#8fd3ff' });
      beep(700, 1300, 0.3, 'square', 0.12);
    }
    if (m.deployT != null) {
      m.deployT -= dt;
      m.tvx = 0; m.tvz = 0;
      if (m.deployT <= 0) {
        m.deployT = null;
        m.deployCd = 5;
        const bz = clamp(m.z + rnd(-30, 30), 60, D - 60);
        const bot = makeMosher(clamp(m.x - m.side * 70, -bound(bz) + 20, bound(bz) - 20), bz, false, 'wifibot');
        bot.minion = true;
        m.bot = bot;
        moshers.push(bot);
        floats.push({ x: bot.x, z: bot.z, y: bot.h + 20, txt: '🤖 ONLINE', t: 0, color: '#8fd3ff' });
        whiteFlash = Math.max(whiteFlash, 0.15);
        boom(0.2, 0.4, 300);
      }
    }
  },
  onKo(m) {   // controller hits the floor — so does the robot
    if (m.bot && !m.bot.ko && !m.bot.dead) {
      m.bot.hp = 0;
      koMosher(m.bot, null, { x: 0, z: -1 });
      floats.push({ x: m.bot.x, z: m.bot.z, y: m.bot.h + 20, txt: '📡 SIGNAL LOST', t: 0, color: '#8fd3ff' });
    }
  },
};
// Andre's better half: all chassis, no chill. Chases the player exclusively,
// with a close-range taser zap. Dies instantly if the pilot goes down.
MOSHER_TYPES.wifibot = {
  init(m) {
    m.h = 64; m.r = 19; m.bulk = 1.3;
    m.maxhp = (300 + 240 * intensity()) * venueMult('hp'); m.hp = m.maxhp;
    m.speed = 205 * Math.min(1.8, venueMult('speed'));
    m.dmg = (10 + 6 * intensity()) * venueMult('dmg');
    m.reach = 30; m.kbResist = 0.45; m.zapCd = 3; m.aggro = 1;
    m.look.skin = '#a8b2c0';                    // brushed steel
    m.look.shirt = '#5a6472';
    m.look.pants = '#3a4250';
    m.look.hair = '#171310';
    m.look.bot = true;                          // antenna + visor
    m.look.bald = true; m.look.mohawk = false; m.look.longHair = false;
    m.look.beard = false; m.look.fem = false;
    m.hair = null;
  },
  think(m) {   // one directive in the firmware
    if (player && !player.ko && !player.dead && state === 'run') {
      m.target = player; m.mode = 'seek';
    } else { m.target = null; m.mode = 'roam'; }
  },
  tick(m, dt) {
    m.zapCd = Math.max(0, m.zapCd - dt);
    if (m.zapCd <= 0 && player && !player.ko && state === 'run') {
      const dx = player.x - m.x, dz = player.z - m.z, d = hyp(dx, dz);
      if (d < 48) {
        player.stun = Math.max(player.stun, 0.35);   // before hit() — invuln can't eat the jolt
        hit(player, m.dmg * 0.8, { x: dx / (d || 1), z: dz / (d || 1) }, m);
        for (let i = 0; i < 6; i++) particles.push({
          x: player.x, z: player.z, y: rnd(20, 50),
          vx: rnd(-120, 120), vz: rnd(-80, 80), vy: rnd(40, 160),
          t: 0, dur: rnd(0.2, 0.4), size: 2, color: '#8fd3ff',
        });
        beep(1600, 300, 0.15, 'square', 0.14);
        m.zapCd = rnd(4, 6);
      }
    }
  },
};

// BOSS PAIR — The Goth Twins. Raven wears her hair down and windmills it;
// Wren wears the braids and the stare. Drop one and the other gets FURIOUS.
function enrageTwin(m) {
  const s = m.twin;
  if (s && !s.ko && !s.dead) {
    s.rageT = 600;   // permanent, as far as you're concerned
    banner = { txt: 'HER TWIN IS FURIOUS', sub: '', t: 0, dur: 1.8, color: '#c86bff' };
    beep(120, 60, 0.5, 'sawtooth', 0.2);
    shake = Math.min(14, shake + 6);
  }
}
MOSHER_TYPES.gothtwins = {   // RAVEN — hair down
  init(m) {
    m.h = 64; m.r = 16;
    m.maxhp = 250 + 210 * intensity();
    m.speed = 230; m.dmg = 9 + 6 * intensity();
    m.reach = 30; m.windR = 70; m.abCd = 4;
    m.look.fem = true;
    m.look.skin = '#f2e6dc';                    // hasn't seen the sun since 2019
    m.look.shirt = '#141216';
    m.look.pants = '#1a1c22';
    m.look.hair = '#0d0d0f';
    m.look.bald = false; m.look.mohawk = false; m.look.longHair = true;
    m.look.beard = false;
    m.hair = [];
    for (let i = 0; i < 6; i++) { const y = m.h - (i + 1) * 6; m.hair.push({ x: 0, y, px: 0, py: y }); }
    bossBase(m, 'THE GOTH TWINS', 'RAVEN', 'they finish each other\'s violence');
  },
  think(m) {
    bossChase(m);
    if (m.abCd <= 0) {
      for (const o of moshers) {
        if (o === m || o.ko || o.dead || o === m.twin) continue;
        if (hyp(o.x - m.x, o.z - m.z) < m.windR) { npcWindmill(m); m.abCd = rnd(5, 8); break; }
      }
    }
  },
  onKo(m) { enrageTwin(m); },
  entourage(m) {   // she never shows up alone
    const s = makeMosher(m.x + 48, clamp(m.z + 12, 40, D - 30), false, 'gothtwin2');
    s.twin = m; m.twin = s;
    return [s];
  },
};
MOSHER_TYPES.gothtwin2 = {   // WREN — braids and the stare
  init(m) {
    m.h = 64; m.r = 16;
    m.maxhp = 250 + 210 * intensity();
    m.speed = 215; m.dmg = 9 + 6 * intensity();
    m.reach = 30; m.stareCd = 5;
    m.look.fem = true;
    m.look.skin = '#f2e6dc';
    m.look.shirt = '#181418';
    m.look.pants = '#1a1c22';
    m.look.hair = '#0d0d0f';
    m.look.style = 'braids';                    // the Wednesday special
    m.look.bald = false; m.look.mohawk = false; m.look.longHair = false;
    m.look.beard = false;
    m.hair = [];
    for (let i = 0; i < 4; i++) { const y = m.h - (i + 1) * 5; m.hair.push({ x: 0, y, px: 0, py: y }); }
    bossBase(m, 'THE GOTH TWINS', 'WREN', '');
  },
  think(m) { bossChase(m); },
  tick(m, dt) {
    m.stareCd = Math.max(0, m.stareCd - dt);
    if (m.stareT > 0) {
      m.stareT -= dt;
      m.tvx = 0; m.tvz = 0;
      if (player) m.face = { x: Math.sign(player.x - m.x) || 1, z: 0 };
      if (m.stareT <= 0 && player && !player.ko) {
        const dx = player.x - m.x, dz = player.z - m.z, d = hyp(dx, dz) || 1;
        if (d < 200) {   // the stare lands: you feel judged, and slower
          player.stun = Math.max(player.stun, 0.7);
          hit(player, m.dmg * 0.6, { x: dx / d, z: dz / d }, m, 0.4);
          floats.push({ x: player.x, z: player.z, y: player.h + 18, txt: '👁', t: 0, color: '#c86bff' });
          redFlash = Math.max(redFlash, 0.3);
        }
      }
    } else if (m.stareCd <= 0 && mellowT <= 0 && player && !player.ko && hyp(player.x - m.x, player.z - m.z) < 180) {
      m.stareT = 0.55;
      floats.push({ x: m.x, z: m.z, y: m.h + 20, txt: '👁…', t: 0, color: '#c86bff' });
      beep(90, 60, 0.4, 'sine', 0.15);
      m.stareCd = rnd(7, 10);
    }
  },
  onKo(m) { enrageTwin(m); },
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
    } else if (m.stompCd <= 0 && mellowT <= 0 && player && !player.ko && hyp(player.x - m.x, player.z - m.z) < 130) {
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
    if (m.chargeCd <= 0 && m.chargeT <= 0 && m.charging <= 0 && mellowT <= 0 && player && !player.ko && state === 'run') {
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
  const T = MOSHER_TYPES[b.type];
  if (T && T.entourage) for (const extra of T.entourage(b)) moshers.push(extra);   // twins etc.
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

// legacy flags (bosses set these directly) or an explicit style key → one name
const hairStyleOf = L => L.style ||
  (L.bald ? 'bald' : L.mohawk ? 'mohawk' : L.pony ? 'ponytail' : L.bob ? 'bob' : L.longHair ? 'long' : 'short');

function makeLook() {
  const fem = Math.random() < 0.34;   // pits are for everyone
  let bald, mohawk, pony = false, bob = false, longHair, style = null;
  if (fem) {
    bald = false;
    mohawk = Math.random() < 0.06;
    const r = Math.random();
    pony = !mohawk && r < 0.4;
    bob = !mohawk && !pony && r < 0.65;
    longHair = !mohawk && !pony && !bob;
  } else {
    bald = Math.random() < 0.12;
    mohawk = !bald && Math.random() < 0.14;
    longHair = !bald && !mohawk && Math.random() < 0.6;
  }
  if (Math.random() < 0.24) {   // some of the crowd came dressed for the poster
    style = pick(fem ? FEM_STYLES : MASC_STYLES);
    bald = mohawk = pony = bob = longHair = false;
  }
  return {
    skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(['#3a4260', '#333848', '#4a3a34']),
    hair: pick(HAIRC), bald, mohawk, longHair,
    fem, pony, bob, style,
    beard: !fem && Math.random() < 0.35,
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
  const hairInit = (segs, sp) => {
    const arr = [];
    for (let i = 0; i < segs; i++) { const y = m.h - (i + 1) * sp; arr.push({ x: 0, y, px: 0, py: y }); }
    return arr;
  };
  const hdef = HAIRDEF[hairStyleOf(m.look)] || {};
  if (hdef.segs) m.hair = hairInit(hdef.segs, hdef.sp || 5.5);
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
  m.look.fem = st.body === 'girl';
  m.look.longHair = st.hairStyle === 'long';
  m.look.pony = st.hairStyle === 'ponytail';
  m.look.bob = st.hairStyle === 'bob';
  m.look.mohawk = st.hairStyle === 'mohawk';
  m.look.bald = st.hairStyle === 'bald';
  m.look.style = ['long', 'ponytail', 'bob', 'mohawk', 'short', 'bald'].includes(st.hairStyle)
    ? null : st.hairStyle;
  const hdef = HAIRDEF[hairStyleOf(m.look)] || {};
  if (hdef.segs) {
    if (!m.hair || m.hair.length !== hdef.segs) {
      m.hair = [];
      for (let i = 0; i < hdef.segs; i++) { const y = m.h - (i + 1) * (hdef.sp || 5.5); m.hair.push({ x: 0, y, px: 0, py: y }); }
    }
  } else m.hair = null;
}
// current player stats with upgrades + berserk applied
const pStats = () => {
  const rage = abState.berserk.t > 0;
  return {
    dmg: (24 + 8 * lvl('fists')) * (rage ? 1.6 : 1) * drunkMult(),   // beer = damage
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
