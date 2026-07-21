'use strict';
// ============================== abilities ==============================
// Definitions (cost/cd/dur) live in config.js; BEHAVIOR lives here. To add a
// move: one entry in ABILITIES (config) + one entry in ABILITY_IMPL with
//   use(a, l, st)  — fired on activation (cooldown already spent)
//   tick(a, st, dt) — optional, runs every frame (own the st.t countdown)
const abState = {};
for (const a of ABILITIES) abState[a.id] = { cd: 0, t: 0 };
// true while a channelled move owns the player's body (no auto-punching)
const abChanneling = () => abState.wind.t > 0 || abState.elbow.t > 0 || abState.mower.t > 0 || (abState.mower.rev || 0) > 0 || abState.cart.t > 0;

const ABILITY_IMPL = {
  kick: {
    use(a, l, st) {
      player.kickT = 0.32;
      const dir = kickAim();
      player.face = { ...dir };
      const s = pStats();
      let landed = false;
      for (const m of moshers) {
        if (m === player || m.ko || m.dead) continue;
        const dx = m.x - player.x, dz = m.z - player.z, d = hyp(dx, dz) || 1;
        if (d > s.reach * 1.2 + m.r) continue;
        if ((dx * dir.x + dz * dir.z) / d < 0.35) continue;
        hit(m, s.dmg * 2.2, { x: dx / d, z: dz / d }, player, 2.6);
        landed = true;
      }
      boom(0.14, 0.6, 320);
      if (landed) { shake = Math.min(16, shake + 6); freezeT = Math.max(freezeT, 0.04); }
    },
  },
  wind: {
    use(a, l, st) {
      st.t = a.dur(l);
      st.tick = 0;
      sfx.horn();
    },
    tick(a, st, dt) {
      if (st.t > 0 && player && !player.ko) {
        st.t -= dt;
        st.tick -= dt;
        if (st.tick <= 0) {
          st.tick = 0.14;
          const s = pStats();
          for (const m of moshers) {
            if (m.isPlayer || m.ko || m.dead) continue;
            const dx = m.x - player.x, dz = m.z - player.z, d = hyp(dx, dz) || 1;
            if (d > s.reach * 1.5 + m.r) continue;
            hit(m, s.dmg * 0.5, { x: dx / d, z: dz / d }, player);
          }
          sfx.whoosh();
        }
      } else st.t = Math.max(0, st.t - dt);
    },
  },
  berserk: {
    use(a, l, st) {
      st.t = a.dur(l);
      beep(120, 55, 0.5, 'sawtooth', 0.25);
      shake = Math.min(16, shake + 8);
      banner = { txt: 'BERSERK', sub: '', t: 0, dur: 1, color: '#ff3b47' };
    },
    tick(a, st, dt) { st.t = Math.max(0, st.t - dt); },
  },
  elbow: {   // rapid overhead elbow drops into whoever's in front
    use(a, l, st) { st.t = a.dur(l); st.tick = 0; sfx.whoosh(); },
    tick(a, st, dt) {
      if (!(st.t > 0 && player && !player.ko)) { st.t = Math.max(0, st.t - dt); return; }
      st.t -= dt;
      st.tick -= dt;
      if (st.tick <= 0) {
        st.tick = 0.16;
        const s = pStats();
        for (const m of moshers) {
          if (m.isPlayer || m.ko || m.dead) continue;
          const dx = m.x - player.x, dz = m.z - player.z, d = hyp(dx, dz) || 1;
          if (d > s.reach * 1.1 + m.r) continue;
          if ((dx * player.face.x + dz * player.face.z) / d < 0.45) continue;
          hit(m, s.dmg * 0.7, { x: dx / d, z: dz / d }, player);
        }
        boom(0.05, 0.3, 600);
      }
    },
  },
  cart: {    // untouchable roll through the crowd in your movement direction
    use(a, l, st) {
      st.t = a.dur(l);
      const mv = hyp(player.tvx, player.tvz) > 30
        ? { x: player.tvx, z: player.tvz } : { ...player.face };
      const d = hyp(mv.x, mv.z) || 1;
      st.dir = { x: mv.x / d, z: mv.z / d };
      player.cartT = st.t;
      sfx.whoosh();
    },
    tick(a, st, dt) {
      if (!(st.t > 0 && player && !player.ko)) { st.t = Math.max(0, st.t - dt); return; }
      st.t -= dt;
      player.invuln = Math.max(player.invuln, 0.12);   // can't be touched mid-wheel
      player.cartT = st.t;
      for (const m of moshers) {
        if (m.isPlayer || m.ko || m.dead || m.bumpCd > 0) continue;
        const dx = m.x - player.x, dz = m.z - player.z, d = hyp(dx, dz);
        if (d < player.r + m.r + 6) {
          m.bumpCd = 0.6;
          hit(m, pStats().dmg * 0.6, { x: dx / (d || 1), z: dz / (d || 1) }, player, 1.6);
        }
      }
    },
  },
  mower: {   // plant, YANK the cord twice, then mow a straight line through the pit
    use(a, l, st) {
      st.rev = 0.55;           // the pull-cord wind-up — planted, yanking
      st.pull = -1;
      st.t = 0;
      st.dir = { ...player.face };
      st.lvl = l;
    },
    tick(a, st, dt) {
      if (st.rev > 0 && player && !player.ko) {
        st.rev -= dt;
        const pull = Math.floor((0.55 - st.rev) / 0.26);   // two yanks
        if (pull !== st.pull) { st.pull = pull; beep(140, 330, 0.12, 'sawtooth', 0.16); }
        if (st.rev <= 0) {     // she's running
          st.t = a.dur(st.lvl);
          st.dir = { ...player.face };
          boom(0.3, 0.55, 190);
          beep(90, 70, 0.6, 'sawtooth', 0.14);
        }
        return;
      }
      if (!(st.t > 0 && player && !player.ko)) { st.t = Math.max(0, st.t - dt); return; }
      st.t -= dt;
      for (const m of moshers) {
        if (m.isPlayer || m.ko || m.dead || m.bumpCd > 0) continue;
        const dx = m.x - player.x, dz = m.z - player.z, d = hyp(dx, dz);
        if (d < player.r + m.r + 10) {
          m.bumpCd = 0.6;
          hit(m, pStats().dmg * 0.9, { x: dx / (d || 1), z: dz / (d || 1) }, player, 1.8);
        }
      }
      if (Math.random() < dt * 30) spawnHitFx(player.x + rnd(-10, 10), player.z, 8);
    },
  },
  spin: {    // one full spin kick — everyone around you eats boot
    use(a, l, st) {
      player.spinT = 0.45;
      const s = pStats();
      let landed = false;
      for (const m of moshers) {
        if (m.isPlayer || m.ko || m.dead) continue;
        const dx = m.x - player.x, dz = m.z - player.z, d = hyp(dx, dz) || 1;
        if (d > s.reach * 1.6 + m.r) continue;
        hit(m, s.dmg * 1.6, { x: dx / d, z: dz / d }, player, 1.9);
        landed = true;
      }
      boom(0.16, 0.55, 300);
      if (landed) { shake = Math.min(16, shake + 6); freezeT = Math.max(freezeT, 0.03); }
    },
  },
  change: {  // fling a fistful of gold — cheap, staggers everyone in the cone
    use(a, l, st) {
      if (runCred < 2) {
        floats.push({ x: player.x, z: player.z, y: 70, txt: 'need 2 🤘', t: 0, color: '#ff8f6b' });
        st.cd = 0.4;   // don't burn the real cooldown
        return;
      }
      runCred -= 2;
      const f = player.face;
      for (const m of moshers) {
        if (m.isPlayer || m.ko || m.dead || m.boss) continue;   // bosses don't care about money
        const dx = m.x - player.x, dz = m.z - player.z, d = hyp(dx, dz) || 1;
        if (d > 190 || (dx * f.x + dz * f.z) / d < 0.45) continue;
        m.stun = 1.2 + 0.25 * l;
        m.target = null;
        hit(m, 4, { x: dx / d, z: dz / d }, player);
      }
      for (let i = 0; i < 7; i++) particles.push({
        x: player.x, z: player.z, y: 46,
        vx: f.x * rnd(120, 260) + rnd(-60, 60), vz: f.z * rnd(120, 260) + rnd(-60, 60),
        vy: rnd(60, 140), t: 0, dur: rnd(0.5, 0.8), size: 3, color: '#ffd166',
      });
      sfx.coin();
    },
  },
};

function useAbility(id) {
  const a = ABILITIES.find(x => x.id === id);
  const l = abLvl(id);
  if (!a || !l || !player || player.ko || player.stun > 0 || state !== 'run') return;
  const st = abState[id];
  if (st.cd > 0 || abChanneling()) return;
  st.cd = a.cd(l);
  ABILITY_IMPL[id].use(a, l, st);
}
const useSlot = i => { const id = save.loadout[i]; if (id) useAbility(id); };
function kickAim() {
  let best = null, bs = -2;
  const reach = pStats().reach * 1.2;
  for (const m of moshers) {
    if (m.isPlayer || m.ko || m.dead) continue;
    const dx = m.x - player.x, dz = m.z - player.z, d = hyp(dx, dz);
    if (d > reach + m.r) continue;
    const dot = (dx * player.face.x + dz * player.face.z) / (d || 1);
    if (dot > bs) { bs = dot; best = { x: dx / d, z: dz / d }; }
  }
  return best || { ...player.face };
}
function tickAbilities(dt) {
  for (const a of ABILITIES) {
    const st = abState[a.id];
    st.cd = Math.max(0, st.cd - dt);
    const impl = ABILITY_IMPL[a.id];
    if (impl.tick) impl.tick(a, st, dt);
  }
  if (player) {
    player.kickT = Math.max(0, (player.kickT || 0) - dt);
    player.spinT = Math.max(0, (player.spinT || 0) - dt);
    player.cartT = Math.max(0, (player.cartT || 0) - dt);
  }
}
