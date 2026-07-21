'use strict';
// ============================== NPC brain ==============================
function think(m) {
  const T = MOSHER_TYPES[m.type || 'punk'];
  if (T && T.think) { T.think(m); return; }   // boss/special AI override
  if (m.leaving) { m.mode = 'leave'; m.target = null; return; }
  if (m.flavor) { m.mode = 'flavor'; return; }   // committed to the bit
  if (calm > 0) {   // between songs: no brawling — just milling about and showing off
    m.target = null;
    if (Math.random() < 0.25) {
      m.flavor = { type: pick(FLAVORS), t: 0, dur: rnd(1.8, 3.2) };
      m.mode = 'flavor';
      return;
    }
    m.goal = { x: rnd(-0.7, 0.7) * bound(m.z), z: clamp(m.z + rnd(-90, 90), D * 0.15, D * 0.88) };
    m.mode = 'goal';
    return;
  }
  if (ev && ev.phase !== 'done' && EVENTS[ev.type].steer) {
    if (EVENTS[ev.type].steer(m)) return;   // event formation takes over
  }
  m.mode = 'roam';
  // pick someone to hit — the pit hits the pit, and mostly NOT the player
  let huntersOnPlayer = 0;
  for (const o of moshers) if (!o.isPlayer && o.mode === 'seek' && o.target && o.target.isPlayer) huntersOnPlayer++;
  let best = null, bd = 260;
  for (const o of moshers) {
    if (o === m || o.ko || o.dead) continue;
    if (o.isPlayer && huntersOnPlayer >= 2 && m.target !== o) continue;
    const d = hyp(o.x - m.x, o.z - m.z) * (o.isPlayer ? 1.15 : 1);
    if (d < bd) { bd = d; best = o; }
  }
  if (best && Math.random() < m.aggro * (0.55 + 0.45 * intensity())) {
    m.target = best; m.mode = 'seek';
  } else if (Math.random() < 0.09 && !m.boss) {
    // no one to hit? bust a move
    m.flavor = { type: pick(FLAVORS), t: 0, dur: rnd(1.5, 2.6) };
    m.mode = 'flavor';
  } else {
    m.target = null;
    m.goal = { x: rnd(-0.7, 0.7) * bound(m.z), z: clamp(m.z + rnd(-130, 130), D * 0.15, D * 0.88) };
    m.mode = 'goal';
  }
}
function npcSteer(m, dt) {
  const sp = m.speed * (m.rageT > 0 ? 1.35 : 1);
  if (m.mode === 'seek' && m.target && !m.target.ko && !m.target.dead) {
    const dx = m.target.x - m.x, dz = m.target.z - m.z, d = hyp(dx, dz) || 1;
    const reach = (m.reach || 26) + m.target.r;
    if (d > reach * 0.9) { m.tvx = dx / d * sp; m.tvz = dz / d * sp; }
    else { m.tvx = 0; m.tvz = 0; }
    if (d < reach + m.r && m.swingCd <= 0) {
      // sometimes bust out a move instead of a plain swing
      if (m.abCd <= 0 && Math.random() < 0.5) {
        if (Math.random() < 0.6) npcKick(m, { x: dx, z: dz });
        else npcWindmill(m);
        m.abCd = rnd(9, 16);
      } else startSwing(m, { x: dx, z: dz });
    }
  } else if (m.mode === 'goal' && m.goal) {
    const dx = m.goal.x - m.x, dz = m.goal.z - m.z, d = hyp(dx, dz);
    if (d < 20) { m.tvx = 0; m.tvz = 0; }
    else { m.tvx = dx / d * sp * (ev && ev.type === 'wall' ? 1.6 : 0.75); m.tvz = dz / d * sp * (ev && ev.type === 'wall' ? 1.6 : 0.75); }
  } else if (m.mode === 'charge') {
    m.tvx = -m.side * 520;
    let laneZ = m.wallZ != null ? m.wallZ : m.z;
    // the wall aims at you: chargers near the player's row bend onto it,
    // so standing still in a gap never works — you have to dodge THROUGH
    if (player && !player.ko && Math.abs(player.z - laneZ) < 70) laneZ = player.z;
    m.tvz = (laneZ - m.z) * 3;
    if (-m.side * m.x > bound(m.z) * 0.7) { m.mode = 'roam'; m.tvx = 0; }
  } else if (m.mode === 'circle') {
    // chase an assigned slot on a shrinking ring: even spacing + inward spiral
    const cz2 = D * 0.45;
    if (m.circSlot == null) m.circSlot = rnd(0, 6.28);
    const active = ev && ev.phase === 'active';
    const ang = m.circSlot + (active ? ev.t * 2.4 : 0);
    const rT = circleR(active ? ev.t : 0);
    const tx2 = Math.cos(ang) * rT, tz2 = cz2 + Math.sin(ang) * rT;
    const dx = tx2 - m.x, dz = tz2 - m.z, d = hyp(dx, dz) || 1;
    const sp2 = Math.min(active && ev.t > 9 ? 480 : 430, d * 4 + 130);
    m.tvx = dx / d * sp2; m.tvz = dz / d * sp2;
  } else if (m.mode === 'flavor' && m.flavor) {
    const F = m.flavor.type;
    if (F === 'buttfire') {         // hops forward, hands on the fire
      m.tvx = m.face.x * 55; m.tvz = m.face.z * 30;
    } else if (F === 'twostep') {   // skip-kick shuffle side to side
      m.tvx = Math.sin(m.flavor.t * 5.5) * 85; m.tvz = 0;
      m.kickT = Math.max(m.kickT || 0, Math.sin(m.flavor.t * 11) > 0.6 ? 0.22 : 0);
    } else if (F === 'demons') {    // lunging at nothing in particular
      m.tvx = m.face.x * Math.sin(m.flavor.t * 7) * 45; m.tvz = m.face.z * 20;
      if (Math.random() < 0.02) m.kickT = 0.26;
    } else {
      m.tvx = 0; m.tvz = 0;         // stirpot / possess: planted
    }
  } else if (m.mode === 'leave') {
    // slip off to the side of the pit and vanish into the dark
    const sgn = Math.sign(m.x) || (Math.random() < 0.5 ? -1 : 1);
    m.tvx = sgn * m.speed * 0.7;
    m.tvz = (D * 0.8 - m.z) * 0.4;
    if (Math.abs(m.x) >= bound(m.z) - 16) m.dead = true;
  } else {
    m.tvx *= 0.9; m.tvz *= 0.9;
  }
}
