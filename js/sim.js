'use strict';
// ============================== per-frame simulation ==============================
function updateMosher(m, dt) {
  if (m.dead) return;
  if (!isFinite(m.x)) m.x = rnd(-0.5, 0.5) * bound(m.z);
  if (m.ko) {
    m.koT += dt;
    simRagdoll(m, dt);
    if (!m.isPlayer && m.koT > 2.6) m.dead = true;   // replacement already spawned at KO
    return;
  }
  m.swingCd = Math.max(0, m.swingCd - dt);
  m.invuln = Math.max(0, m.invuln - dt);
  m.stun = Math.max(0, m.stun - dt);
  m.bumpCd = Math.max(0, m.bumpCd - dt);
  m.flash = Math.max(0, m.flash - dt * 4);

  if (m.isPlayer) {
    let ix = (kb.KeyA || kb.ArrowLeft ? -1 : 0) + (kb.KeyD || kb.ArrowRight ? 1 : 0) + stickVec.x;
    let iz = (kb.KeyW || kb.ArrowUp ? 1 : 0) + (kb.KeyS || kb.ArrowDown ? -1 : 0) + stickVec.z;
    const d = hyp(ix, iz);
    if (d > 1) { ix /= d; iz /= d; }
    const slow = abState.wind.t > 0 || abState.elbow.t > 0 ? 0.55 : 1;
    const sp = pStats().speed * slow;
    m.tvx = ix * sp; m.tvz = iz * sp;
    if (d > 0.2) m.face = { x: ix / (d || 1), z: iz / (d || 1) };
    // past half a meter of drunk the legs start negotiating their own route
    if (drunk > 45) {
      const w = (drunk - 45) / 55;
      m.tvx += Math.sin(runT * 2.3) * 130 * w;
      m.tvz += Math.cos(runT * 1.7) * 85 * w;
    }
    // dash moves own the wheels; the mower rev keeps you planted mid-yank
    if ((abState.mower.rev || 0) > 0) { m.tvx = 0; m.tvz = 0; }
    else if (abState.mower.t > 0) { m.tvx = abState.mower.dir.x * 400; m.tvz = abState.mower.dir.z * 400; }
    if (abState.cart.t > 0) { m.tvx = abState.cart.dir.x * 540; m.tvz = abState.cart.dir.z * 540; }
    // fists fly on their own — nearest mosher in range gets one
    if (state === 'run' && m.swingCd <= 0 && !abChanneling() && m.stun <= 0) {
      let best = null, bd = pStats().reach * 1.3 + 20;
      for (const o of moshers) {
        if (o.isPlayer || o.ko || o.dead) continue;
        const dd = hyp(o.x - m.x, o.z - m.z);
        if (dd < bd) { bd = dd; best = o; }
      }
      if (best) startSwing(m, { x: best.x - m.x, z: best.z - m.z });
    }
    // slow HP regen out of combat
    m.regenT += dt;
    if (m.regenT > 4) m.hp = Math.min(m.maxhp, m.hp + 3.5 * dt);
  } else {
    m.think -= dt;
    if (m.think <= 0) { m.think = rnd(0.12, 0.3); think(m); }
    npcSteer(m, dt);
    const T = MOSHER_TYPES[m.type];
    if (T && T.tick) T.tick(m, dt);   // per-frame boss state machines (charges, etc.)
    // NPC moves: windmill spin-out + kick anim timers
    m.abCd = Math.max(0, (m.abCd || 0) - dt);
    m.rageT = Math.max(0, (m.rageT || 0) - dt);
    if (m.windT > 0) {
      m.windT -= dt;
      m.windTick = (m.windTick || 0) - dt;
      m.tvx *= 0.5; m.tvz *= 0.5;
      if (m.windTick <= 0) {
        m.windTick = 0.16;
        for (const o of moshers) {
          if (o === m || o.ko || o.dead) continue;
          const dx = o.x - m.x, dz = o.z - m.z, dd = hyp(dx, dz) || 1;
          if (dd > (m.windR || 44) + o.r) continue;
          hit(o, m.dmg * 0.6 * (o.isPlayer ? 1 : 0.45), { x: dx / dd, z: dz / dd }, m);
        }
      }
    }
    m.kickT = Math.max(0, (m.kickT || 0) - dt);
    if (m.flavor) { m.flavor.t += dt; if (m.flavor.t > m.flavor.dur) m.flavor = null; }
  }
  if (m.stun > 0) { m.tvx = 0; m.tvz = 0; }

  const acc = m.isPlayer ? 9 : 6;
  m.vx += (m.tvx - m.vx) * Math.min(1, acc * dt);
  m.vz += (m.tvz - m.vz) * Math.min(1, acc * dt);
  m.x = clamp(m.x + m.vx * dt, -bound(m.z), bound(m.z));
  // during a wall of death the crowd closes ranks front and back — the whole
  // field squeezes into the wall's coverage, so there's no hiding at the edges
  let zMin = 26, zMax = D - 14;
  if (ev && ev.type === 'wall') {
    const sq = ev.phase === 'warn' ? Math.min(1, ev.t / 2.5) : 1;
    zMin = 26 + (84 - 26) * sq;
    zMax = (D - 14) - ((D - 14) - D * 0.86) * sq;
  }
  m.z = clamp(m.z + m.vz * dt, zMin, zMax);
  // the ring of spectators around the pit shoves anyone drifting out back in
  if (!m.leaving) {
    const EDGE = 34, bx = bound(m.z);
    if (Math.abs(m.x) > bx - EDGE) {
      m.vx -= Math.sign(m.x) * ((Math.abs(m.x) - (bx - EDGE)) / EDGE) * 950 * dt;
    }
    if (m.z < 70) m.vz += ((70 - m.z) / 44) * 950 * dt;
    if (m.z > D - 46) m.vz -= ((m.z - (D - 46)) / 32) * 800 * dt;
  }

  // swing anim + strike frame
  if (m.swing) {
    m.swing.t += dt;
    if (!m.swing.hitDone && m.swing.t > m.swing.dur * 0.45) { m.swing.hitDone = true; doStrike(m); }
    if (m.swing.t >= m.swing.dur) m.swing = null;
  }

  // headbang + walk cycle — the player's idle headbang is the TRUE windmill:
  // harder, faster, all hair
  const speed = hyp(m.vx, m.vz);
  const banging = speed < 60;
  m.bangPhase += dt * (banging ? (m.isPlayer ? 10.5 : 8.2) : 5);
  m.walkPhase += dt * speed * 0.055;

  simArms(m, dt);
  simHair(m, dt);
}
function simArms(m, dt) {
  const bob = Math.sin(m.bangPhase) * (hyp(m.vx, m.vz) < 60 ? 3 : 1.6);
  const lean = clamp(m.vx * 0.0011, -0.4, 0.4);
  const shY = m.h * 0.74 + bob;
  for (const [arm, sgn] of [[m.armL, -1], [m.armR, 1]]) {
    const sx = sgn * 7 + lean * 12;
    // verlet integrate
    for (const P of [['ex', 'ey', 'epx', 'epy'], ['hx', 'hy', 'hpx', 'hpy']]) {
      const vx2 = (arm[P[0]] - arm[P[2]]) * 0.94 - m.vx * dt * 0.55;
      const vy2 = (arm[P[1]] - arm[P[3]]) * 0.94;
      arm[P[2]] = arm[P[0]]; arm[P[3]] = arm[P[1]];
      arm[P[0]] += vx2; arm[P[1]] += vy2 - 300 * dt * dt;
    }
    // windmill: both hands whip around in a circle
    if (isWindmilling(m)) {
      const wa = performance.now() / 1000 * 13 + (sgn > 0 ? 0 : Math.PI);
      const tx = sx + Math.cos(wa) * 24;
      const ty = shY + Math.sin(wa) * 24;
      arm.hx += (tx - arm.hx) * 0.7; arm.hy += (ty - arm.hy) * 0.7;
    }
    // excessive elbows: alternating overhead elbow drops
    if (m.isPlayer && abState.elbow.t > 0) {
      const ph = Math.sin(performance.now() / 1000 * 16 + (sgn > 0 ? 0 : Math.PI));
      arm.hx += (sx + m.face.x * 8 - arm.hx) * 0.6;
      arm.hy += (shY + 12 + ph * 10 - arm.hy) * 0.6;
    }
    // lawnmower — rev phase: near arm rips the pull cord, other steadies the handle
    if (m.isPlayer && (abState.mower.rev || 0) > 0) {
      const isPull = (m.face.x >= 0) === (sgn > 0);
      if (isPull) {
        const yank = ((0.55 - abState.mower.rev) / 0.26) % 1;   // 0→reach low, 1→ripped up & back
        const rip = yank < 0.35 ? 0 : Math.min(1, (yank - 0.35) / 0.3);
        arm.hx += (m.face.x * (13 - 30 * rip) - arm.hx) * 0.75;
        arm.hy += (m.h * 0.28 + rip * m.h * 0.5 - arm.hy) * 0.75;
      } else {
        arm.hx += (m.face.x * 12 - arm.hx) * 0.5;
        arm.hy += (m.h * 0.34 - arm.hy) * 0.5;
      }
    }
    // lawnmower — mowing: both hands low in front, sweeping like they're on the handle
    if (m.isPlayer && abState.mower.t > 0) {
      const sw = Math.sin(performance.now() / 1000 * 9) * 10;
      arm.hx += (m.face.x * 14 + sw - arm.hx) * 0.6;
      arm.hy += (m.h * 0.35 - arm.hy) * 0.6;
    }
    // NPC flavor choreography
    if (m.flavor) {
      const ft = m.flavor.t, F = m.flavor.type;
      if (F === 'stirpot') {          // both hands circling a big invisible pot
        const wa = ft * 6 + (sgn > 0 ? 0 : 0.9);
        arm.hx += (Math.cos(wa) * 13 - arm.hx) * 0.5;
        arm.hy += (m.h * 0.38 + Math.sin(wa) * 5 - arm.hy) * 0.5;
      } else if (F === 'possess') {   // every limb somewhere else
        if (Math.random() < 0.25) {
          arm.hpx = arm.hx - rnd(-14, 14); arm.hpy = arm.hy - rnd(-10, 16);
        }
      } else if (F === 'buttfire') {  // hands slapping behind
        const ph = Math.sin(ft * 12 + (sgn > 0 ? 0 : Math.PI));
        arm.hx += (-m.face.x * 9 + sgn * 4 - arm.hx) * 0.55;
        arm.hy += (m.h * 0.4 + ph * 4 - arm.hy) * 0.55;
      } else if (F === 'demons') {    // shadowboxing the air
        const ph = Math.sin(ft * 13 + (sgn > 0 ? 0 : Math.PI));
        arm.hx += (m.face.x * (14 + ph * 12) + sgn * 3 - arm.hx) * 0.55;
        arm.hy += (shY + 4 + Math.cos(ft * 9 + sgn) * 6 - arm.hy) * 0.55;
      }
      // twostep: arms just swing naturally with the skips (verlet does it)
    }
    // held item choreography (bottle hand, etc.)
    if (m.isPlayer && held) {
      const IT = ITEM_TYPES[held.type];
      if (IT.arm) IT.arm(m, arm, sgn, shY);
    }
    // swing: drive the hand toward the punch target
    if (m.swing) {
      const s = Math.sin(Math.PI * m.swing.t / m.swing.dur);
      const isNear = (m.swing.dir.x >= 0) === (sgn > 0);
      if (isNear || Math.abs(m.swing.dir.x) < 0.3) {
        const tx = sx + m.swing.dir.x * 26 * s + sgn * 4;
        const ty = shY - 4 + 14 * s;
        arm.hx += (tx - arm.hx) * 0.55; arm.hy += (ty - arm.hy) * 0.55;
      }
    }
    // constraints: shoulder→elbow, elbow→hand (bosses get longer arms)
    const AL = m.armLen || 11;
    for (let it = 0; it < 2; it++) {
      let dx = arm.ex - sx, dy = arm.ey - shY, d = hyp(dx, dy) || 0.001;
      let diff = (d - AL) / d;
      arm.ex -= dx * diff; arm.ey -= dy * diff;
      dx = arm.hx - arm.ex; dy = arm.hy - arm.ey; d = hyp(dx, dy) || 0.001;
      diff = (d - AL) / d * 0.5;
      arm.hx -= dx * diff; arm.hy -= dy * diff;
      arm.ex += dx * diff; arm.ey += dy * diff;
    }
    arm.sx = sx; arm.sy = shY;
  }
}
function simHair(m, dt) {
  if (!m.hair) return;
  const headU = m.headU || 0, headY = m.headY || m.h;
  const fx = m.face.x >= 0 ? 1 : -1;
  const hdef = HAIRDEF[hairStyleOf(m.look)] || {};
  // ponytails anchor high on the back of the skull, devilocks on the FRONT
  let ax = headU + (hdef.attach === 'front' ? fx * 4 : -fx * (hdef.attach === 'high' ? 4.5 : 3.5));
  let ay = headY + (hdef.attach === 'high' ? 6 : hdef.attach === 'front' ? 2 : 3);
  const sp = hdef.sp || 5.5;
  for (const h of m.hair) {
    const vx2 = (h.x - h.px) * 0.9 - m.vx * dt * 0.5;
    const vy2 = (h.y - h.py) * 0.9;
    h.px = h.x; h.py = h.y;
    h.x += vx2; h.y += vy2 - 500 * dt * dt;
    const dx = h.x - ax, dy = h.y - ay, d = hyp(dx, dy) || 0.001;
    const diff = (d - sp) / d;
    h.x -= dx * diff; h.y -= dy * diff;
    ax = h.x; ay = h.y;
  }
}
function collide() {
  for (let i = 0; i < moshers.length; i++) {
    const a = moshers[i];
    if (a.dead || a.ko) continue;
    for (let j = i + 1; j < moshers.length; j++) {
      const b = moshers[j];
      if (b.dead || b.ko) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const rr = a.r + b.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, ov = (rr - d) / 2;
      a.x -= nx * ov; a.z -= nz * ov;
      b.x += nx * ov; b.z += nz * ov;
      const rvx = b.vx - a.vx, rvz = b.vz - a.vz;
      const rel = -(rvx * nx + rvz * nz);
      if (rel > 40) {
        const imp = rel * 0.5;
        a.vx -= nx * imp; a.vz -= nz * imp;
        b.vx += nx * imp; b.vz += nz * imp;
        // charging bodies hurt (wall of death shine)
        if (rel > 320 && (a.bumpCd <= 0 || b.bumpCd <= 0)
            && !(a.mode === 'circle' && b.mode === 'circle')) {   // ring brushes don't chip the crowd
          a.bumpCd = b.bumpCd = 0.5;
          const dmg = (rel - 300) * 0.03;
          const charging = ev && ev.type === 'wall' && ev.phase === 'active';
          // att stays null: body checks are environmental, no cred for standing there
          hit(a, dmg * (charging && b.mode === 'charge' ? 3 : 1), { x: -nx, z: -nz }, null);
          hit(b, dmg * (charging && a.mode === 'charge' ? 3 : 1), { x: nx, z: nz }, null);
        }
      }
    }
  }
}

function update(dt) {
  if (freezeT > 0) { freezeT -= dt; return; }
  calm = Math.max(0, calm - dt);
  tickAbilities(dt);
  if (songToast) { songToast.t += dt; if (songToast.t > 5) songToast = null; }
  if (state === 'run') {
    runT += dt;
    comboT -= dt;
    if (comboT <= 0) combo = 0;
    if (calm <= 0) {
      evTimer -= dt;
      if (!ev && evTimer <= 0) triggerEvent();
      // boss entrances on a timer — but never two at once
      if (runT >= nextBossT) {
        if (!moshers.some(m => m.boss && !m.ko && !m.dead)) { spawnBoss(BOSS_ROTATION[bossIdx++ % BOSS_ROTATION.length]); nextBossT = runT + 150; }
        else nextBossT = runT + 30;
      }
    }
  }
  updateEvent(dt);
  for (const m of moshers) updateMosher(m, dt);
  collide();
  moshers = moshers.filter(m => !m.dead);
  // the crowd keeps joining as the set heats up — and floods back after a lull.
  // no walk-ins during a wall of death: one wall, one impact, refill afterwards
  const live = liveNpc();
  if (!(ev && ev.type === 'wall') &&
      live < maxNpc() && Math.random() < dt * (live < maxNpc() * 0.6 ? 4 : 1.2)) spawnNpc(true);

  for (const p of particles) {
    p.t += dt;
    p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
    p.vy -= 300 * dt;
    if (p.y < 0) p.y = 0;
  }
  particles = particles.filter(p => p.t < p.dur);
  // boss projectiles (Cargo Shorts Kyle's pocket inventory)
  for (const p of bossProjs) {
    p.t += dt;
    p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
    p.vy -= 60 * dt;
    if (player && !player.ko && hyp(p.x - player.x, p.z - player.z) < player.r + 9 && p.y < 60) {
      const d = hyp(p.vx, p.vz) || 1;
      hit(player, p.dmg, { x: p.vx / d, z: p.vz / d }, p.from);
      p.t = 99;
    }
  }
  bossProjs = bossProjs.filter(p => p.t < 1.3);
  // loose change on the floor: bounce, settle, get scooped (pickup change)
  for (const c of coins) {
    c.t += dt;
    c.x += c.vx * dt; c.z += c.vz * dt; c.y += c.vy * dt;
    c.vy -= 420 * dt;
    if (c.y <= 0) { c.y = 0; c.vy *= -0.4; c.vx *= 0.6; c.vz *= 0.6; }
    if (player && !player.ko && state === 'run' && c.t > 0.35 && hyp(c.x - player.x, c.z - player.z) < 26) {
      runCred += c.val;
      floats.push({ x: c.x, z: c.z, y: 30, txt: '+' + c.val + ' 🤘', t: 0, color: '#ffb84d' });
      sfx.coin();
      c.t = 99;
    }
  }
  coins = coins.filter(c => c.t < 12);
  updateItems(dt);   // floor loot, chugging, the drunk meter's slow sobering
  for (const f of floats) f.t += dt;
  floats = floats.filter(f => f.t < 1.1);
  if (banner) { banner.t += dt; if (banner.t > banner.dur) banner = null; }
  shake = Math.max(0, shake - dt * 40);
  redFlash = Math.max(0, redFlash - dt * 1.6);
  whiteFlash = Math.max(0, whiteFlash - dt * 2);
}
