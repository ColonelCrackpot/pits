'use strict';
// ============================== combat & ragdoll ==============================
function startSwing(m, dir) {
  if (m.swingCd > 0 || m.ko || m.stun > 0) return;
  const d = hyp(dir.x, dir.z) || 1;
  m.swing = { t: 0, dur: 0.26, dir: { x: dir.x / d, z: dir.z / d }, hitDone: false };
  m.swingCd = m.isPlayer ? PUNCH_CD / (1 + 0.12 * lvl('fast')) : rnd(0.9, 1.6);
  m.face = { ...m.swing.dir };
  if (m.isPlayer) sfx.whoosh();
  // hurl the near hand forward for the wind-up
  const arm = m.swing.dir.x >= 0 ? m.armR : m.armL;
  arm.hpx = arm.hx - m.swing.dir.x * 10; arm.hpy = arm.hy - 6;
}
function doStrike(att) {
  const dir = att.swing.dir;
  const reach = att.isPlayer ? pStats().reach : (att.reach || 26);
  const dmgBase = att.isPlayer ? pStats().dmg : att.dmg * (att.rageT > 0 ? 1.5 : 1);
  for (const m of moshers) {
    if (m === att || m.ko || m.dead) continue;
    const dx = m.x - att.x, dz = m.z - att.z, d = hyp(dx, dz) || 1;
    if (d > reach + m.r + att.r) continue;
    const dot = (dx * dir.x + dz * dir.z) / d;
    if (dot < 0.3) continue;
    const dmg = dmgBase * (att.isPlayer || m.isPlayer ? 1 : 0.45);
    hit(m, dmg, { x: dx / d, z: dz / d }, att);
  }
}
function hit(m, dmg, dir, att, kbMult) {
  if (m.isPlayer && (m.invuln > 0 || god)) return;
  if (m.isPlayer && abState.berserk.t > 0) dmg *= 0.5;   // berserk shrugs it off
  m.hp -= dmg; m.flash = 1; m.regenT = 0;
  m.lastHitBy = att;
  const kb = (150 + dmg * 7 * (att && att.isPlayer ? pStats().kb : 1)) * (kbMult || 1) * (m.kbResist || 1);
  m.vx += dir.x * Math.min(560 * (kbMult || 1), kb);
  m.vz += dir.z * Math.min(560 * (kbMult || 1), kb);
  // jolt the verlet bits so the hit reads
  [m.armL, m.armR].forEach(a => { a.hpx = a.hx - dir.x * 14; a.hpy = a.hy + 8; });
  if (m.hair) m.hair.forEach(h => { h.px = h.x - dir.x * 8; });
  spawnHitFx(m.x, m.z, m.h * 0.75);
  sfx.punch();
  if (att && att.isPlayer) { freezeT = Math.max(freezeT, 0.028); shake = Math.min(14, shake + 3); }
  if (m.isPlayer) {
    m.invuln = 0.35; shake = Math.min(18, shake + 6); redFlash = 0.5;
    sfx.hurt();
    if (m.hp <= 0) playerDown();
  } else if (m.hp <= 0) {
    koMosher(m, att, dir);
  }
}
function koMosher(m, att, dir) {
  m.ko = true; m.koT = 0;
  buildRagdoll(m, dir);
  sfx.ko();
  spawnStars(m.x, m.z, m.h);
  // the pit never empties: a fresh body walks in the moment one drops —
  // EXCEPT during a wall of death (one wall, one impact) and never for bosses
  if (!m.isPlayer && !m.boss && !(ev && ev.type === 'wall') && liveNpc() < maxNpc()) spawnNpc(true);
  if (m.boss) banner = { txt: (m.tag || 'BOSS') + ' IS DOWN', sub: '', t: 0, dur: 2.2, color: '#c86bff' };
  if (att && att.isPlayer && state === 'run') {
    combo++; comboT = 3;
    // SCORE rides the combo and pays instantly; GOLD hits the floor —
    // pickup change: you scoop what you knock loose
    const sc = (m.boss ? 1000 : 100 * combo) * save.venue;
    const gold = Math.max(1, Math.round((m.boss ? 10 : 1) * pStats().credMult * venueMult('gold')));
    runScore += sc; runKos++;
    spawnCoins(m.x, m.z, gold, m.boss ? 5 : 2);
    floats.push({ x: m.x, z: m.z, y: m.h + 14, txt: '+' + sc, t: 0, color: '#ffd166' });
    if (combo > 1 && !m.boss) floats.push({ x: m.x, z: m.z, y: m.h + 34, txt: combo + 'x!', t: 0, color: '#7bff9e' });
  } else if (!m.isPlayer && state === 'run' && Math.random() < 0.5) {
    spawnCoins(m.x, m.z, Math.max(1, Math.round(venueMult('gold'))), 1);   // ambient KOs shake a little loose
  }
}
function spawnCoins(x, z, total, n) {
  const each = Math.max(1, Math.floor(total / n));
  for (let i = 0; i < n; i++) {
    coins.push({
      x: x + rnd(-6, 6), z: z + rnd(-5, 5), y: 30,
      vx: rnd(-90, 90), vz: rnd(-70, 70), vy: rnd(80, 190),
      val: i === 0 ? total - each * (n - 1) : each, t: 0,
    });
  }
}
// ---- NPC versions of the moves (no berserk — that's yours) ----
function npcKick(m, dirIn) {
  const d = hyp(dirIn.x, dirIn.z) || 1;
  const dir = { x: dirIn.x / d, z: dirIn.z / d };
  m.kickT = 0.32; m.face = { ...dir };
  m.swingCd = rnd(1.2, 1.8);
  for (const o of moshers) {
    if (o === m || o.ko || o.dead) continue;
    const dx = o.x - m.x, dz = o.z - m.z, dd = hyp(dx, dz) || 1;
    if (dd > 30 + o.r + m.r) continue;
    if ((dx * dir.x + dz * dir.z) / dd < 0.35) continue;
    hit(o, m.dmg * 2 * (o.isPlayer ? 1 : 0.45), { x: dx / dd, z: dz / dd }, m, 2.2);
  }
  boom(0.12, 0.4, 320);
}
function npcWindmill(m) {
  m.windT = 1.6;
  m.windTick = 0;
  m.swingCd = 2;
}
function playerDown() {
  if (lvl('wind') > windUsed) {
    windUsed++;
    player.hp = player.maxhp * 0.5;
    player.invuln = 2;
    sfx.wind();
    banner = { txt: 'SECOND WIND!', sub: 'back on your feet', t: 0, dur: 1.6, color: '#7bff9e' };
    for (const m of moshers) {
      if (m.isPlayer || m.ko) continue;
      const dx = m.x - player.x, dz = m.z - player.z, d = hyp(dx, dz);
      if (d < 140) { m.vx += dx / d * 480; m.vz += dz / d * 480; }
    }
    return;
  }
  player.ko = true; player.koT = 0;
  buildRagdoll(player, { x: -player.face.x, z: -player.face.z });
  sfx.ko(); shake = 20; redFlash = 1;
  setTimeout(() => { if (state === 'run') gameOver(); }, 1300);
}

// KO bodies switch to a small verlet skeleton in body-local (u = world-x offset, y = up) space.
function buildRagdoll(m, dir) {
  const dx = (dir ? dir.x : 0) * 90;
  const p = (u, y, vx2, vy2) => ({ x: u, y, px: u - vx2 * 0.016, py: y - vy2 * 0.016 });
  const kick = 120 + Math.abs(m.vx) * 0.4;
  m.rag = {
    head:  p(0, m.h * 0.95, dx * 2.4 + kick * (dir ? dir.x : 0), 130),
    neck:  p(0, m.h * 0.78, dx * 2, 60),
    hip:   p(0, m.h * 0.42, dx, 0),
    handL: p(-14, m.h * 0.6, dx, 90),
    handR: p(14, m.h * 0.6, dx, 90),
    footL: p(-7, 0, 0, 40),
    footR: p(7, 0, 0, 40),
  };
}
const RAG_STICKS = [
  ['neck', 'hip', null, true],   // rigid torso — length computed on first sim
  ['head', 'neck', 11, true],
  ['handL', 'neck', 26, false],  // false = rope (max length only)
  ['handR', 'neck', 26, false],
  ['footL', 'hip', 27, false],
  ['footR', 'hip', 27, false],
];
function simRagdoll(m, dt) {
  const r = m.rag, g = 620;
  for (const k in r) {
    const pt = r[k];
    const vx2 = (pt.x - pt.px) * 0.985, vy2 = (pt.y - pt.py) * 0.985;
    pt.px = pt.x; pt.py = pt.y;
    pt.x += vx2; pt.y += vy2 - g * dt * dt;
    if (pt.y < 0) { pt.y = 0; pt.py = pt.y - vy2 * -0.3; pt.px = pt.x - vx2 * 0.5; }
  }
  for (let it = 0; it < 3; it++) {
    for (const [a, b, len0, rigid] of RAG_STICKS) {
      const pa = r[a], pb = r[b];
      let len = len0;
      if (len == null) len = m.h * 0.36;
      const dx = pa.x - pb.x, dy = pa.y - pb.y, d = hyp(dx, dy) || 0.001;
      if (!rigid && d < len) continue;
      const diff = (d - len) / d * 0.5;
      pa.x -= dx * diff; pa.y -= dy * diff;
      pb.x += dx * diff; pb.y += dy * diff;
    }
  }
  // body keeps sliding on the floor while the skeleton flops
  m.vx *= Math.pow(0.04, dt); m.vz *= Math.pow(0.04, dt);
  m.x = clamp(m.x + m.vx * dt, -bound(m.z), bound(m.z));
  m.z = clamp(m.z + m.vz * dt, 26, D - 14);
}

// ---- combat FX ----
function spawnHitFx(x, z, y) {
  for (let i = 0; i < 7; i++) {
    const a = rnd(0, 6.28);
    particles.push({
      x, z, y: y + rnd(-4, 4),
      vx: Math.cos(a) * rnd(40, 160), vz: rnd(-40, 40), vy: Math.sin(a) * rnd(30, 140) + 60,
      t: 0, dur: rnd(0.25, 0.5), size: rnd(1.5, 3.5), color: pick(['#fff', '#ffd9a0', '#ff8f6b']),
    });
  }
}
function spawnStars(x, z, h) {
  for (let i = 0; i < 5; i++) {
    particles.push({
      x, z, y: h + 6, star: true, a0: rnd(0, 6.28),
      vx: 0, vz: 0, vy: 20, t: 0, dur: 1.1, size: 5, color: '#ffe27a',
    });
  }
}
