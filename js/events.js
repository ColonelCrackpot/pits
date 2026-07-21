'use strict';
// ============================== pit events ==============================
// Each event is one self-contained registry entry. Add a new event by adding
// an entry here — nothing else needs touching. Hooks (all optional except
// start/update):
//   weight      — relative pick chance on the event timer
//   start()     — set up `ev` (must set ev = {type, phase, t: 0, ...}) + banner
//   update(dt)  — phase logic; call endEvent(bonus, txt) when done
//   steer(m)    — per-NPC formation override (return true = AI handled)
//   drawFloor() — floor decal (marker, glow) during the event
//   drawWorld() — drawn after the crowd (airborne bodies etc.)

// ring radius over event time: spiral inward to the crowd-fit floor, then the
// pit CLOSES — the last stretch collapses all the way so the center is never safe
function circleR(t) {
  const p = Math.min(1, t / 9);
  const R0 = Math.min(bound(D * 0.45) - 28, 260);   // start at the arena edge — no standing outside it
  const fit = Math.min(liveNpc() * 5.2 + 16, 180);
  let r = Math.max(fit, R0 - (R0 - 70) * p);
  if (t > 9) r = Math.max(24, r - (r - 24) * Math.min(1, (t - 9) / 1.8));
  return r;
}
function assignCircleSlots() {
  const cz2 = D * 0.45;
  const npcs = moshers.filter(m => !m.isPlayer && !m.ko && !m.dead);
  // keep everyone's current bearing, then space the slots out evenly in that order
  npcs.sort((a, b) => Math.atan2(a.z - cz2, a.x) - Math.atan2(b.z - cz2, b.x));
  npcs.forEach((m, i) => { m.circSlot = Math.atan2(npcs[0].z - cz2, npcs[0].x) + i / npcs.length * Math.PI * 2; });
}
// two even lines, one per side, spread across the pit's depth — no bunching
function assignWallSlots() {
  const npcs = moshers.filter(m => !m.isPlayer && !m.ko && !m.dead);
  const L = [], R = [];
  for (const m of npcs) (m.x < 0 ? L : R).push(m);
  while (L.length > R.length + 1) R.push(L.pop());
  while (R.length > L.length + 1) L.push(R.pop());
  for (const [arr, side] of [[L, -1], [R, 1]]) {
    arr.sort((a, b) => a.z - b.z);
    arr.forEach((m, i) => {
      m.side = side;
      m.wallZ = D * 0.145 + D * 0.70 * (arr.length < 2 ? 0.5 : i / (arr.length - 1));
    });
  }
}

const EVENTS = {
  wall: {
    weight: 0.30,
    start() {
      ev = { type: 'wall', phase: 'warn', t: 0 };
      assignWallSlots();
      banner = { txt: 'WALL OF DEATH', sub: 'pick a side or get through the gap!', t: 0, dur: 3, color: '#ff3b47' };
      sfx.horn();
    },
    update(dt) {
      if (ev.phase === 'warn' && ev.t > 3) {
        ev.phase = 'active'; ev.t = 0;
        banner = { txt: 'GO GO GO', sub: '', t: 0, dur: 0.8, color: '#ff3b47' };
        for (const m of moshers) if (!m.isPlayer && !m.ko) m.mode = 'charge';
        boom(0.4, 0.6, 900);
      } else if (ev.phase === 'active' && ev.t > 3.6) {
        endEvent(3, 'WALL SURVIVED');
      }
    },
    steer(m) {
      if (!m.side || m.wallZ == null) {   // joined mid-event
        m.side = m.x < 0 ? -1 : 1;
        m.wallZ = clamp(m.z, D * 0.145, D * 0.845);
      }
      if (ev.phase === 'warn') {
        m.goal = { x: m.side * bound(m.wallZ) * 0.85, z: m.wallZ };
        m.mode = 'goal';
      } else {
        m.mode = 'charge';
      }
      return true;
    },
  },

  circle: {
    weight: 0.30,
    start() {
      ev = { type: 'circle', phase: 'warn', t: 0 };
      assignCircleSlots();
      banner = { txt: 'CIRCLE PIT', sub: 'run with the flow — or stay out of it', t: 0, dur: 2, color: '#ffb84d' };
      sfx.horn();
    },
    update(dt) {
      if (ev.phase === 'warn' && ev.t > 2) { ev.phase = 'active'; ev.t = 0; ev.flowT = 0; }
      else if (ev.phase === 'active') {
        if (ev.t > 9 && !ev.closing) {
          ev.closing = true;
          banner = { txt: 'PIT CLOSES', sub: 'nowhere to hide', t: 0, dur: 1.2, color: '#ffb84d' };
          boom(0.3, 0.5, 700);
        }
        // reward running with the flow (until the collapse starts)
        if (player && !player.ko && state === 'run' && ev.t < 9) {
          const rT = circleR(ev.t);
          const dx = player.x, dz = player.z - D * 0.45, r = hyp(dx, dz) || 1;
          if (r > rT - 60 && r < rT + 70) {
            const tx = -dz / r, tz = dx / r;
            const flow = player.vx * tx + player.vz * tz;
            if (flow > 150) {
              ev.flowT = (ev.flowT || 0) + dt;
              if (ev.flowT > 1) {
                ev.flowT -= 1;
                runCred += Math.max(1, Math.round(1 * pStats().credMult * venueMult('gold')));
                runScore += 40;
                floats.push({ x: player.x, z: player.z, y: 70, txt: '+40 flow', t: 0, color: '#ffd166' });
              }
            }
          }
        }
        if (ev.t > 11.2) endEvent(2, 'CIRCLE CLOSED');
      }
    },
    steer(m) {
      // once the pit is closing, anyone caught inside gets swarmed
      if (ev.phase === 'active' && ev.t > 9 && player && !player.ko) {
        const d = hyp(player.x - m.x, player.z - m.z);
        if (d < 90) { m.target = player; m.mode = 'seek'; return true; }
      }
      m.mode = 'circle';
      return true;
    },
  },

  diver: {
    weight: 0.26,
    start() {
      const tz = rnd(D * 0.18, D * 0.55);
      const tx = rnd(-0.6, 0.6) * bound(tz);
      ev = { type: 'diver', phase: 'warn', t: 0, tx, tz };
      banner = { txt: 'STAGE DIVER', sub: 'clear the landing zone!', t: 0, dur: 1.6, color: '#8fd3ff' };
      sfx.horn();
    },
    update(dt) {
      if (ev.phase === 'warn' && ev.t > 1.4) {
        ev.phase = 'active'; ev.t = 0;
        diver = { t: 0, dur: 1.1, x0: ev.tx * 0.3, z0: D + 30, tx: ev.tx, tz: ev.tz, look: makeLook() };
      } else if (ev.phase === 'active' && diver) {
        diver.t += dt;
        if (diver.t >= diver.dur) {
          // impact
          const ix = diver.tx, iz = diver.tz;
          boom(0.5, 0.7, 500); shake = Math.min(22, shake + 14); whiteFlash = 0.35;
          spawnHitFx(ix, iz, 10); spawnHitFx(ix, iz, 30);
          for (const m of moshers) {
            if (m.ko || m.dead) continue;
            const dx = m.x - ix, dz = m.z - iz, d = hyp(dx, dz);
            if (d < 120) {
              const dir = { x: dx / (d || 1), z: dz / (d || 1) };
              if (m.isPlayer) hit(m, 22, dir, null);
              else { m.vx += dir.x * 500; m.vz += dir.z * 500; m.hp -= 60; if (m.hp <= 0) koMosher(m, null, dir); }
            }
          }
          diver = null;
          endEvent(0, null);
        }
      }
    },
    drawFloor() {
      const pr = proj(ev.tx, ev.tz, 0);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 90);
      ctx.strokeStyle = `rgba(143,211,255,${0.4 + 0.4 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(pr.x, pr.y, 120 * pr.s * 0.9, 120 * pr.s * 0.36, 0, 0, 6.28);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(pr.x, pr.y, 120 * pr.s * 0.9 * pulse, 120 * pr.s * 0.36 * pulse, 0, 0, 6.28);
      ctx.stroke();
    },
    drawWorld() {
      if (!diver) return;
      const s0 = diver.t / diver.dur;
      const x = diver.x0 + (diver.tx - diver.x0) * s0;
      const z = diver.z0 + (diver.tz - diver.z0) * s0;
      const y = 4 * 130 * s0 * (1 - s0) + (1 - s0) * 60;
      const pr = proj(x, clamp(z, 0, D), y);
      const spin = diver.t * 9;
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(spin);
      const u = 10 * pr.s;
      ctx.strokeStyle = '#e8b48c'; ctx.lineWidth = Math.max(2, 3 * pr.s); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-u, -u * 0.7); ctx.lineTo(u, u * 0.7);
      ctx.moveTo(-u, u * 0.7); ctx.lineTo(u, -u * 0.7);
      ctx.stroke();
      ctx.fillStyle = '#1a1016';
      ctx.beginPath(); ctx.arc(0, 0, u * 0.55, 0, 6.28); ctx.fill();
      ctx.restore();
      // shadow
      const sh = proj(x, clamp(z, 0, D), 0);
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, u, u * 0.4, 0, 0, 6.28);
      ctx.fill();
    },
  },

  heal: {
    weight: 0.14,   // the rare one
    start() {
      const hz = rnd(D * 0.25, D * 0.62);
      ev = { type: 'heal', phase: 'active', t: 0, hx: rnd(-0.55, 0.55) * bound(hz), hz, r: 115, dur: 7 };
      banner = { txt: 'POWER BALLAD', sub: 'the band\'s healing light — stand in it', t: 0, dur: 2.2, color: '#7bff9e' };
      sfx.wind();
    },
    update(dt) {
      if (player && !player.ko && state === 'run') {
        const d = hyp(player.x - ev.hx, player.z - ev.hz);
        if (d < ev.r) {
          player.hp = Math.min(player.maxhp, player.hp + 16 * dt);
          if (Math.random() < dt * 6) particles.push({
            x: player.x + rnd(-14, 14), z: player.z + rnd(-10, 10), y: rnd(10, 50),
            vx: 0, vz: 0, vy: 55, t: 0, dur: 0.9, size: 5, color: '#7bff9e', char: '♪',
          });
        }
      }
      if (Math.random() < dt * 4) particles.push({
        x: ev.hx + rnd(-1, 1) * ev.r * 0.8, z: ev.hz + rnd(-1, 1) * ev.r * 0.6, y: 0,
        vx: 0, vz: 0, vy: 40, t: 0, dur: 1.2, size: 4, color: '#ffe27a', char: '♪',
      });
      if (ev.t > ev.dur) endEvent(0, null);
    },
    drawFloor() {
      const pr = proj(ev.hx, ev.hz, 0);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);
      const rad = ev.r * pr.s;
      const g = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, rad);
      g.addColorStop(0, `rgba(123,255,158,${0.12 + 0.07 * pulse})`);
      g.addColorStop(0.8, `rgba(255,226,122,${0.07 + 0.05 * pulse})`);
      g.addColorStop(1, 'rgba(255,226,122,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(pr.x, pr.y, rad, rad * 0.4, 0, 0, 6.28);
      ctx.fill();
      ctx.strokeStyle = `rgba(123,255,158,${0.5 + 0.35 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(pr.x, pr.y, rad * (0.86 + 0.1 * pulse), rad * 0.4 * (0.86 + 0.1 * pulse), 0, 0, 6.28);
      ctx.stroke();
    },
  },
};

function triggerEvent(type) {
  if (!type) {
    const total = Object.values(EVENTS).reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const k in EVENTS) { r -= EVENTS[k].weight; if (r <= 0) { type = k; break; } }
    type = type || 'wall';
  }
  EVENTS[type].start();
}
function updateEvent(dt) {
  if (!ev) return;
  ev.t += dt;
  EVENTS[ev.type].update(dt);
}
function endEvent(bonus, txt) {
  if (bonus && player && !player.ko && state === 'run') {
    const g = Math.max(1, Math.round(bonus * pStats().credMult * venueMult('gold')));
    const sc = bonus * 100 * save.venue;
    runCred += g;
    runScore += sc;
    banner = { txt: txt, sub: `+${sc} score · +${g} gold`, t: 0, dur: 1.6, color: '#7bff9e' };
  }
  ev = null;
  evTimer = rnd(20, 30);
}
// render hooks
function drawEventFloor() { if (ev && EVENTS[ev.type].drawFloor) EVENTS[ev.type].drawFloor(); }
function drawEventWorld() { if (ev && EVENTS[ev.type].drawWorld) EVENTS[ev.type].drawWorld(); }
