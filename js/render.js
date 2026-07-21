'use strict';
// ============================== render ==============================
function render() {
  if (!(W > 0 && H > 0 && isFinite(XF) && XF > 0)) return;
  ctx.clearRect(0, 0, W, H);
  const beat = beatPulse();
  const sx = (Math.random() - 0.5) * shake, sy2 = (Math.random() - 0.5) * shake;
  ctx.save();
  ctx.translate(sx, sy2);

  drawStage(beat);
  drawFloor(beat);

  // spectators enclosing the pit: stage barrier + sides behind the crowd…
  drawBarrierCrowd(beat);
  drawSideCrowds(beat);
  if (songToast) drawSongToast(beat);

  const drawList = moshers.slice().sort((a, b) => b.z - a.z);
  for (const m of drawList) drawMosher(m);
  drawEventWorld();
  // …and the front row with their backs to the camera, in front of everything
  drawFrontCrowd(beat);

  for (const c of coins) {   // loose change glinting on the floor
    const pr = proj(c.x, c.z, c.y);
    ctx.globalAlpha = c.t > 9 ? Math.max(0, (12 - c.t) / 3) : 1;
    ctx.fillStyle = '#b8860b';
    ctx.beginPath(); ctx.ellipse(pr.x, pr.y + 1.2 * pr.s, 3.2 * pr.s, 2.4 * pr.s, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = Math.sin(performance.now() / 160 + c.x * 3) > 0.3 ? '#ffe27a' : '#ffd166';
    ctx.beginPath(); ctx.ellipse(pr.x, pr.y, 3.2 * pr.s, 2.4 * pr.s, 0, 0, 6.28); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const p of bossProjs) {   // incoming pocket debris
    const pr = proj(p.x, p.z, p.y);
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(p.t * 14);
    ctx.fillStyle = '#8a7a5a';
    ctx.fillRect(-4 * pr.s, -3 * pr.s, 8 * pr.s, 6 * pr.s);
    ctx.restore();
  }
  for (const p of particles) {
    const pr = proj(p.x, p.z, p.y);
    ctx.globalAlpha = 1 - p.t / p.dur;
    ctx.fillStyle = p.color;
    if (p.star) {
      const ang = p.a0 + p.t * 5;
      ctx.font = Math.round(9 * pr.s) + 'px sans-serif';
      ctx.fillText('★', pr.x + Math.cos(ang) * 12 * pr.s, pr.y + Math.sin(ang) * 4 * pr.s);
    } else if (p.char) {
      ctx.font = '700 ' + Math.round(p.size * 2.4 * pr.s) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.char, pr.x, pr.y);
    } else {
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, p.size * pr.s, 0, 6.28);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  for (const f of floats) {
    const pr = proj(f.x, f.z, f.y + f.t * 30);
    ctx.globalAlpha = 1 - f.t / 1.1;
    ctx.font = '800 ' + Math.round(9 * pr.s) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = f.color;
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3;
    ctx.strokeText(f.txt, pr.x, pr.y);
    ctx.fillText(f.txt, pr.x, pr.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // full-screen flashes
  if (whiteFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${whiteFlash * 0.5})`; ctx.fillRect(0, 0, W, H); }
  if (redFlash > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(200,0,20,0)');
    g.addColorStop(1, `rgba(200,0,20,${redFlash * 0.45})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (abState.berserk.t > 0) {   // seeing red
    const bp = 0.1 + 0.05 * Math.sin(performance.now() / 130);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8);
    g.addColorStop(0, 'rgba(255,30,30,0)');
    g.addColorStop(1, `rgba(255,30,30,${bp})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  drawHud();
}
function drawStage(beat) {
  const stY = syAt(D);              // stage front edge on screen
  const stTop = stY - H * 0.16;     // platform top
  // back wall
  const T = curTheme();
  const wall = ctx.createLinearGradient(0, 0, 0, stY);
  wall.addColorStop(0, T.wall[0]);
  wall.addColorStop(1, T.wall[1]);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, stY);
  // light beams
  const cols = T.beams;
  const t = performance.now() / 1000;
  for (let i = 0; i < 4; i++) {
    const bx = W * (0.2 + 0.2 * i);
    const ang = Math.sin(t * 0.9 + i * 1.8) * 0.55;
    ctx.save();
    ctx.translate(bx, 6);
    ctx.rotate(ang);
    const gb = ctx.createLinearGradient(0, 0, 0, stY * 1.4);
    gb.addColorStop(0, cols[i] + 'cc');
    gb.addColorStop(1, cols[i] + '00');
    ctx.globalAlpha = 0.16 + 0.2 * beat;
    ctx.fillStyle = gb;
    ctx.beginPath();
    ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
    ctx.lineTo(70, stY * 1.4); ctx.lineTo(-70, stY * 1.4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // platform
  ctx.fillStyle = T.plat[0];
  ctx.fillRect(0, stTop, W, stY - stTop);
  ctx.fillStyle = T.plat[1];
  ctx.fillRect(0, stTop, W, 5);
  ctx.fillStyle = T.plat[2];
  ctx.fillRect(0, stY - 4, W, 4);
  // speaker stacks
  for (const side of [0.06, 0.94]) {
    const spx = W * side, spw = Math.min(90, W * 0.11);
    ctx.fillStyle = '#100b10';
    ctx.fillRect(spx - spw / 2, stTop - 88, spw, 88);
    ctx.strokeStyle = '#241820'; ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(spx, stTop - 72 + k * 27, spw * 0.26, 0, 6.28);
      ctx.stroke();
    }
  }
  // band
  drawBander(W * 0.5, stTop + 6, 1.15, beat, 'vox');
  drawBander(W * 0.32, stTop - 2, 1.0, beat, 'gtr');
  drawBander(W * 0.68, stTop - 2, 1.0, beat, 'gtr2');
  drawBander(W * 0.5, stTop - 26, 0.85, beat, 'drums');
  // strobe on the downbeat
  if (beat > 0.82) { ctx.fillStyle = `rgba(255,245,255,${(beat - 0.82) * 1.4})`; ctx.fillRect(0, 0, W, stY); }
}
function drawBander(x, footY, sc, beat, role) {
  const s = (H / 800) * 34 * sc;
  const bang = Math.sin(performance.now() / 1000 * 8.2) * (0.5 + beat);
  ctx.save();
  ctx.translate(x, footY);
  ctx.strokeStyle = '#050308'; ctx.fillStyle = '#050308';
  ctx.lineWidth = Math.max(2.5, s * 0.16); ctx.lineCap = 'round';
  if (role === 'drums') {
    ctx.beginPath(); ctx.arc(0, -s * 0.95, s * 0.22, 0, 6.28); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 0.55 - bang * 4); ctx.lineTo(0, -s * 0.75); ctx.lineTo(s * 0.5, -s * 0.55 + bang * 4);
    ctx.stroke();
    ctx.fillStyle = '#241017';
    ctx.fillRect(-s * 0.75, -s * 0.5, s * 1.5, s * 0.5);
    ctx.restore();
    return;
  }
  // legs
  ctx.beginPath();
  ctx.moveTo(-s * 0.22, 0); ctx.lineTo(0, -s * 0.5); ctx.lineTo(s * 0.22, 0);
  ctx.stroke();
  // torso with headbang lean
  const lean = role === 'vox' ? bang * 0.35 : bang * 0.22;
  const hx = Math.sin(lean) * s * 0.6, hy = -s * 0.5 - Math.cos(lean) * s * 0.62;
  ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(hx, hy); ctx.stroke();
  // head + whipping hair
  ctx.beginPath(); ctx.arc(hx, hy - s * 0.14, s * 0.16, 0, 6.28); ctx.fill();
  ctx.lineWidth = Math.max(2, s * 0.1);
  ctx.beginPath();
  ctx.moveTo(hx, hy - s * 0.2);
  ctx.quadraticCurveTo(hx - bang * s * 0.5, hy + s * 0.1, hx - bang * s * 0.62, hy + s * 0.42);
  ctx.stroke();
  ctx.lineWidth = Math.max(2.5, s * 0.16);
  if (role === 'vox') {
    ctx.beginPath(); ctx.moveTo(hx, hy + s * 0.1); ctx.lineTo(hx + s * 0.34, hy - s * 0.05); ctx.stroke();
  } else {
    const dir2 = role === 'gtr' ? 1 : -1;
    ctx.save();
    ctx.translate(0, -s * 0.62); ctx.rotate(dir2 * (0.5 + bang * 0.08));
    ctx.fillStyle = '#3a1218';
    ctx.fillRect(-s * 0.55, -s * 0.09, s * 1.1, s * 0.18);
    ctx.restore();
  }
  ctx.restore();
}
function drawFloor(beat) {
  const stY = syAt(D);
  const T = curTheme();
  const fl = ctx.createLinearGradient(0, stY, 0, H);
  fl.addColorStop(0, T.floor[0]);
  fl.addColorStop(0.5, T.floor[1]);
  fl.addColorStop(1, T.floor[2]);
  ctx.fillStyle = fl;
  ctx.fillRect(0, stY, W, H - stY);
  // colored light pools sweeping the pit
  const t = performance.now() / 1000;
  const cols = T.pools.map(c => 'rgba(' + c + ',');
  for (let i = 0; i < 3; i++) {
    const px = Math.sin(t * 0.7 + i * 2.1) * 0.35 * W + W / 2;
    const pz = D * (0.3 + 0.25 * Math.sin(t * 0.5 + i * 1.4) + 0.25);
    const pr = proj((px - W / 2) / xu(pz), pz, 0);
    const rad = 130 * pr.s;
    const g = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, rad);
    g.addColorStop(0, cols[i] + (0.10 + 0.08 * beat) + ')');
    g.addColorStop(1, cols[i] + '0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(pr.x, pr.y, rad, rad * 0.4, 0, 0, 6.28);
    ctx.fill();
  }
  // follow spots: warm on the player, cold purple on any boss
  if (player && !player.dead && state === 'run') drawFollowSpot(player, 80, '255,240,205', 0.20 + 0.04 * beat);
  for (const b of moshers) if (b.boss && !b.dead) drawFollowSpot(b, 95, '200,120,255', 0.18 + 0.05 * beat);
  drawEventFloor();
}
function drawFollowSpot(m, radius, rgb, alpha) {
  const pr = proj(m.x, m.z, 0);
  const rad = radius * pr.s;
  ctx.fillStyle = `rgba(${rgb},0.05)`;   // faint beam from the rig
  ctx.beginPath();
  ctx.moveTo(pr.x - 10, -10); ctx.lineTo(pr.x + 10, -10);
  ctx.lineTo(pr.x + rad * 0.75, pr.y); ctx.lineTo(pr.x - rad * 0.75, pr.y);
  ctx.closePath(); ctx.fill();
  const g2 = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, rad);
  g2.addColorStop(0, `rgba(${rgb},${alpha})`);
  g2.addColorStop(0.7, `rgba(${rgb},${alpha * 0.4})`);
  g2.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.ellipse(pr.x, pr.y, rad, rad * 0.4, 0, 0, 6.28);
  ctx.fill();
}
function drawSongToast(beat) {
  const t = songToast.t;
  const a = t < 0.4 ? t / 0.4 : t > 4 ? Math.max(0, 5 - t) : 1;
  const y = syAt(D) * 0.42;
  ctx.save();
  ctx.globalAlpha = clamp(a, 0, 1);
  ctx.translate(W / 2, y);
  ctx.scale(1 + 0.04 * beat, 1 + 0.04 * beat);
  ctx.textAlign = 'center';
  ctx.font = '700 11px system-ui';
  ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 4;
  ctx.strokeText('NOW PLAYING', 0, -22);
  ctx.fillStyle = '#c9d8f2';
  ctx.fillText('NOW PLAYING', 0, -22);
  const txt = '♪ ' + songToast.title.toUpperCase() + ' ♪';
  ctx.font = '900 ' + Math.round(Math.min(30, W * 0.05)) + 'px system-ui';
  ctx.lineWidth = 7;
  ctx.strokeText(txt, 0, 0);
  ctx.fillStyle = '#ff9d6b';
  ctx.fillText(txt, 0, 0);
  ctx.restore();
}
function drawBarrierCrowd(beat) {
  const z = D * 0.985;
  const s = xu(z);
  const y = syAt(z);
  ctx.fillStyle = '#0a070c';
  for (let i = 0; i < 24; i++) {
    const x = W / 2 + ((i - 11.5) * 34 + Math.sin(i * 7.3) * 8) * s;
    const bob = Math.sin(performance.now() / 1000 * 8.2 + i * 1.7) * 4 * s * (0.6 + beat * 0.6);
    ctx.beginPath();
    ctx.arc(x, y - 46 * s + bob, 8 * s, 0, 6.28);
    ctx.fill();
    ctx.fillRect(x - 9 * s, y - 40 * s + bob, 18 * s, 40 * s);
  }
}
// spectator columns along both sides of the pit — the wall that shoves you back in
function drawSideCrowds(beat) {
  ctx.fillStyle = '#0b080d';
  const t = performance.now() / 1000;
  for (let z = D * 0.92; z > 70; z -= 52) {
    const s = xu(z);
    const y = syAt(z);
    for (const side of [-1, 1]) {
      const x = W / 2 + side * (bound(z) + 24) * s;
      if (x < -30 || x > W + 30) continue;
      const bob = Math.sin(t * 8.2 + z * 0.4 + side * 2) * 4 * s * (0.6 + beat * 0.6);
      const jig = Math.sin(z * 12.7 + side) * 6 * s;
      ctx.beginPath();
      ctx.arc(x + jig, y - 46 * s + bob, 8 * s, 0, 6.28);
      ctx.fill();
      ctx.fillRect(x + jig - 9 * s, y - 40 * s + bob, 18 * s, 40 * s);
    }
  }
}
// front row: big dark backs between the camera and the pit, closing the ring
function drawFrontCrowd(beat) {
  const z = 12;
  const s = xu(z);
  const y = syAt(z) + 30 * s;
  const t = performance.now() / 1000;
  ctx.fillStyle = '#070509';
  const n = Math.ceil(W / (46 * s)) + 2;
  for (let i = 0; i < n; i++) {
    const x = (i - 0.5) * 46 * s + Math.sin(i * 5.1) * 10 * s;
    const bob = Math.sin(t * 8.2 + i * 2.1) * 5 * s * (0.6 + beat * 0.6);
    ctx.beginPath();
    ctx.arc(x, y - 58 * s + bob, 10 * s, 0, 6.28);
    ctx.fill();
    ctx.fillRect(x - 12 * s, y - 50 * s + bob, 24 * s, 52 * s);
  }
}
function drawMosher(m) {
  const pr = proj(m.x, m.z, 0);
  const s = pr.s;
  if ((m.blinkT || 0) > 0) ctx.globalAlpha = 0.3 + 0.35 * Math.abs(Math.sin(performance.now() / 45));
  const T = MOSHER_TYPES[m.type || 'punk'];
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.42)';
  ctx.beginPath();
  ctx.ellipse(pr.x, pr.y, m.r * s * 1.1, m.r * s * 0.42, 0, 0, 6.28);
  ctx.fill();
  if (T && T.draw) { T.draw(m, pr, s); return; }   // boss/special body override
  if (!m.ko && (m.isPlayer ? abState.berserk.t > 0 : (m.rageT || 0) > 0)) {
    const rp = 0.6 + 0.4 * Math.sin(performance.now() / 90);
    const g = ctx.createRadialGradient(pr.x, pr.y - 30 * s, 4, pr.x, pr.y - 30 * s, 46 * s);
    g.addColorStop(0, `rgba(255,50,50,${0.22 * rp})`);
    g.addColorStop(1, 'rgba(255,50,50,0)');
    ctx.fillStyle = g;
    ctx.fillRect(pr.x - 50 * s, pr.y - 80 * s, 100 * s, 90 * s);
  }
  if (m.isPlayer && !m.ko) {
    const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 250);
    ctx.strokeStyle = abState.berserk.t > 0 ? `rgba(255,60,60,${0.9 * pulse})` : `rgba(255,184,77,${0.85 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(pr.x, pr.y, (m.r + 7) * s, (m.r + 7) * s * 0.42, 0, 0, 6.28);
    ctx.stroke();
  }
  const L = m.look;
  const px2 = (u, y) => ({ x: pr.x + u * s, y: pr.y - y * s });
  ctx.lineCap = 'round';

  if (m.ko && m.rag) {
    const r = m.rag;
    ctx.globalAlpha = m.isPlayer ? 1 : clamp(1 - (m.koT - 1.8) / 0.8, 0, 1);
    const th = Math.max(2, 4.4 * s) * (m.bulk || 1);
    // legs
    ctx.strokeStyle = L.pants; ctx.lineWidth = th;
    for (const f of ['footL', 'footR']) {
      const a = px2(r.hip.x, r.hip.y), b = px2(r[f].x, r[f].y);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // torso
    ctx.strokeStyle = L.shirt; ctx.lineWidth = th * 1.7;
    const nk = px2(r.neck.x, r.neck.y), hp2 = px2(r.hip.x, r.hip.y);
    ctx.beginPath(); ctx.moveTo(nk.x, nk.y); ctx.lineTo(hp2.x, hp2.y); ctx.stroke();
    // arms
    ctx.strokeStyle = L.skin; ctx.lineWidth = th * 0.9;
    for (const hnd of ['handL', 'handR']) {
      const b = px2(r[hnd].x, r[hnd].y);
      ctx.beginPath(); ctx.moveTo(nk.x, nk.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // shoes stay on, even out cold
    if (L.shoes) {
      ctx.fillStyle = L.shoes;
      for (const f of ['footL', 'footR']) {
        const b = px2(r[f].x, r[f].y);
        ctx.beginPath(); ctx.ellipse(b.x, b.y, 3.8 * s, 2 * s, 0, 0, 6.28); ctx.fill();
      }
    }
    // head
    const hd = px2(r.head.x, r.head.y + 3);
    ctx.fillStyle = L.mask === 'gold' ? '#d9a92c' : L.skin;
    ctx.beginPath(); ctx.arc(hd.x, hd.y, 7 * s, 0, 6.28); ctx.fill();
    if (L.mask === 'gold') {
      ctx.fillStyle = '#a8760a';
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hd.x + sgn * 5 * s, hd.y - 3.5 * s);
        ctx.lineTo(hd.x + sgn * 8.5 * s, hd.y - 10 * s);
        ctx.lineTo(hd.x + sgn * 2 * s, hd.y - 6 * s);
        ctx.closePath(); ctx.fill();
      }
    } else if (!L.bald) {
      ctx.fillStyle = L.hair;
      ctx.beginPath(); ctx.arc(hd.x, hd.y - 2 * s, 6.4 * s, Math.PI, 0); ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }

  const idlePlayer = m.isPlayer && hyp(m.vx, m.vz) < 60;
  const bob = Math.sin(m.bangPhase) * (hyp(m.vx, m.vz) < 60 ? (idlePlayer ? 4.2 : 3) : 1.6);
  let lean = clamp(m.vx * 0.0011, -0.4, 0.4);
  if (m.cartT > 0) lean = Math.sin((0.5 - m.cartT) * 12.5) * 1.25;   // cartwheel: whole body over
  const crouch = m.flavor && m.flavor.type === 'stirpot' ? 0.78 : 1;  // stirring happens down low
  const hipY = m.h * 0.44 * crouch + bob * 0.5;
  const neckY = m.h * 0.78 * crouch + bob;
  const neckU = lean * 14;
  const flash = m.flash > 0.4;

  // legs — scissor when moving, wide bounce stance when banging
  const speed = hyp(m.vx, m.vz);
  const th = Math.max(2, 4.4 * s) * (m.bulk || 1);
  ctx.strokeStyle = flash ? '#fff' : L.pants;
  ctx.lineWidth = th;
  const step = speed > 40 ? Math.sin(m.walkPhase) * 9 : 0;
  const kick = m.kickT > 0 ? Math.sin(Math.PI * (0.32 - m.kickT) / 0.32) : 0;
  // spin kick: the boot leg sweeps a full circle around the body
  const spin = m.spinT > 0 ? (0.45 - m.spinT) / 0.45 : 0;
  const kfx = m.face.x >= 0 ? 1 : -1;
  for (const [sgn, off] of [[-1, step], [1, -step]]) {
    let a = px2(lean * 6, hipY), b = px2(sgn * 8 + off * 0.7, 0);
    let mid = px2(sgn * 5 + off, hipY * 0.5);
    if (spin > 0 && sgn === kfx) {
      const sa = spin * Math.PI * 2;
      b = px2(Math.cos(sa) * kfx * 30, hipY * 0.65 + Math.sin(sa) * 6);
      mid = px2(Math.cos(sa) * kfx * 14, hipY * 0.7);
    } else if (kick > 0 && sgn === kfx) {   // big boot: leg thrusts out at hip height
      b = px2(kfx * (10 + 26 * kick), hipY * (0.4 + 0.5 * kick));
      mid = px2(kfx * 10, hipY * 0.55);
    }
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mid.x, mid.y, b.x, b.y); ctx.stroke();
    if (L.shoes || L.slops) {   // boots / sneakers / slops on the feet
      ctx.fillStyle = L.shoes || L.skin;
      ctx.beginPath();
      ctx.ellipse(b.x + kfx * 2.4 * s, b.y - 0.8 * s, 4.2 * s, 2.1 * s, 0, 0, 6.28);
      ctx.fill();
      if (L.slops) {   // the thin sole of a proud slop
        ctx.strokeStyle = '#241a10';
        ctx.lineWidth = Math.max(1, 1.1 * s);
        ctx.beginPath();
        ctx.moveTo(b.x - 2 * s, b.y + 1.2 * s);
        ctx.lineTo(b.x + kfx * 5.5 * s, b.y + 1.2 * s);
        ctx.stroke();
      }
      ctx.strokeStyle = flash ? '#fff' : L.pants;
      ctx.lineWidth = th;
    }
  }
  // wallet chain swinging at the hip
  if (L.chain) {
    const a1 = px2(lean * 6 + kfx * 4, hipY - 1);
    const b1 = px2(lean * 6 + kfx * 8 - m.vx * 0.006, hipY * 0.55);
    ctx.strokeStyle = '#c8ccd6';
    ctx.lineWidth = Math.max(1, 1.3 * s);
    ctx.beginPath();
    ctx.moveTo(a1.x, a1.y);
    ctx.quadraticCurveTo((a1.x + b1.x) / 2 + kfx * 3 * s, (a1.y + b1.y) / 2 + 4 * s, b1.x, b1.y);
    ctx.stroke();
  }
  // far arm (behind torso)
  const farArm = m.face.x >= 0 ? m.armL : m.armR;
  const nearArm = m.face.x >= 0 ? m.armR : m.armL;
  drawArm(m, farArm, s, px2, flash, true);
  // torso
  ctx.strokeStyle = flash ? '#fff' : L.shirt;
  ctx.lineWidth = th * 1.9;
  const hip = px2(lean * 6, hipY), neck = px2(neckU, neckY);
  ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(neck.x, neck.y); ctx.stroke();
  if (L.logo && !flash) {   // band logo on the shirt
    ctx.save();
    ctx.translate((hip.x + neck.x) / 2, (hip.y + neck.y) / 2);
    ctx.rotate(Math.atan2(neck.x - hip.x, hip.y - neck.y) * 0.4);
    ctx.font = '900 ' + Math.max(3.5, 4.4 * s) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = L.logoColor || '#ff2222';
    ctx.fillText(L.logo, 0, 1.5 * s);
    ctx.restore();
  }
  // head — banging hard
  const bang = Math.sin(m.bangPhase) * (speed < 60 ? 0.9 : 0.35);
  const fx = m.face.x >= 0 ? 1 : -1;
  const headU = neckU + Math.sin(bang) * 9 * fx;
  const headY = neckY + Math.cos(bang) * 10;
  m.headU = headU; m.headY = headY;
  const hd = px2(headU, headY);
  if (m.hair) {   // long hair hangs from the back of the skull, drawn behind the head
    ctx.lineWidth = Math.max(2, 4.6 * s);
    let hx0 = hd.x - fx * 3 * s, hy0 = hd.y - 3 * s;
    for (let i = 0; i < m.hair.length; i++) {
      const hp3 = px2(m.hair[i].x, m.hair[i].y);
      ctx.strokeStyle = flash ? '#fff' : (L.hairTip && i > 0 ? L.hairTip : L.hair);
      ctx.beginPath(); ctx.moveTo(hx0, hy0); ctx.lineTo(hp3.x, hp3.y); ctx.stroke();
      hx0 = hp3.x; hy0 = hp3.y;
    }
  }
  ctx.fillStyle = L.mask === 'gold' ? (flash ? '#fff' : '#d9a92c') : (flash ? '#fff' : L.skin);
  ctx.beginPath(); ctx.arc(hd.x, hd.y, 7 * s, 0, 6.28); ctx.fill();
  if (L.mask === 'gold' && !flash) {   // the gold devil mask
    ctx.fillStyle = '#a8760a';
    for (const sgn of [-1, 1]) {   // horns
      ctx.beginPath();
      ctx.moveTo(hd.x + sgn * 5.2 * s, hd.y - 4 * s);
      ctx.lineTo(hd.x + sgn * 9 * s, hd.y - 11.5 * s);
      ctx.lineTo(hd.x + sgn * 2.2 * s, hd.y - 6.4 * s);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#1a0e04';
    ctx.lineWidth = Math.max(1, 1.2 * s);
    for (const sgn of [-1, 1]) {   // angry eye slits
      ctx.beginPath();
      ctx.moveTo(hd.x + fx * 1.2 * s + sgn * 1.2 * s, hd.y - 1.2 * s - (sgn === (fx >= 0 ? 1 : -1) ? 1.2 : 0) * s);
      ctx.lineTo(hd.x + fx * 1.2 * s + sgn * 4 * s, hd.y - 2.6 * s);
      ctx.stroke();
    }
    ctx.beginPath();   // mouth grille
    ctx.moveTo(hd.x + fx * 1.2 * s - 2.6 * s, hd.y + 3 * s);
    ctx.lineTo(hd.x + fx * 1.2 * s + 3.4 * s, hd.y + 3 * s);
    ctx.stroke();
  }
  if (L.beard && L.mask !== 'gold') {
    ctx.fillStyle = flash ? '#eee' : L.hair;
    ctx.beginPath(); ctx.arc(hd.x + fx * 1.5 * s, hd.y + 3.5 * s, 4 * s, 0, 6.28); ctx.fill();
  }
  if (m.hair && L.mask !== 'gold') {   // hairline cap for long-hair heads (roots colour)
    ctx.fillStyle = flash ? '#fff' : L.hair;
    ctx.beginPath(); ctx.arc(hd.x, hd.y - 2 * s, 6.6 * s, Math.PI, 0); ctx.fill();
  }
  if (L.mask === 'gold') {
    // no hair styles over the mask
  } else if (L.mohawk) {
    ctx.fillStyle = flash ? '#fff' : L.hair;
    ctx.beginPath();
    ctx.moveTo(hd.x - 6 * s, hd.y - 2 * s);
    ctx.lineTo(hd.x, hd.y - 14 * s);
    ctx.lineTo(hd.x + 6 * s, hd.y - 2 * s);
    ctx.closePath(); ctx.fill();
  } else if (!L.bald && !m.hair) {
    ctx.fillStyle = flash ? '#fff' : L.hair;
    ctx.beginPath(); ctx.arc(hd.x, hd.y - 2.4 * s, 6.6 * s, Math.PI, 0); ctx.fill();
  }
  // near arm (in front)
  drawArm(m, nearArm, s, px2, flash, false);
  // the V guitar, slung in FRONT of the body (Luke's pride and joy)
  if (L.prop === 'vguitar') {
    const gx = px2(neckU + kfx * 5, hipY + 7);
    ctx.save();
    ctx.translate(gx.x, gx.y);
    ctx.rotate(kfx * (-0.5 + Math.sin(m.bangPhase) * 0.06));
    const u = s * 1.3;
    ctx.strokeStyle = '#2a2018';
    ctx.lineWidth = Math.max(2, 2 * u);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-kfx * 22 * u, -12 * u); ctx.stroke();
    ctx.fillStyle = '#0d0b0e';   // headstock
    ctx.fillRect(-kfx * 24 * u - (kfx > 0 ? 0 : 5 * u), -15 * u, 5 * u, 5 * u);
    ctx.fillStyle = '#efe8dc';   // the white V
    ctx.strokeStyle = '#141216';
    ctx.lineWidth = Math.max(1, 1.1 * u);
    ctx.beginPath();
    ctx.moveTo(-kfx * 2 * u, -4 * u);
    ctx.lineTo(kfx * 18 * u, 9 * u);
    ctx.lineTo(kfx * 8.5 * u, 0.8 * u);
    ctx.lineTo(kfx * 16 * u, -10 * u);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  if (m.boss) {   // boss nameplate + health bar
    const bw = 54 * s;
    const by = pr.y - (m.h + 22) * s;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(pr.x - bw / 2, by, bw, 5);
    ctx.fillStyle = '#c86bff';
    ctx.fillRect(pr.x - bw / 2 + 1, by + 1, (bw - 2) * clamp(m.hp / m.maxhp, 0, 1), 3);
    ctx.font = '800 ' + Math.round(6 * s + 4) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
    ctx.strokeText(m.tag || 'BOSS', pr.x, by - 4);
    ctx.fillStyle = '#e6c6ff';
    ctx.fillText(m.tag || 'BOSS', pr.x, by - 4);
  }
  if (m.isPlayer) {
    const bob2 = Math.sin(performance.now() / 300) * 3;
    const mk = px2(headU, headY + 22);
    ctx.fillStyle = '#ffb84d';
    ctx.beginPath();
    ctx.moveTo(mk.x, mk.y + bob2 + 6 * s);
    ctx.lineTo(mk.x - 5 * s, mk.y + bob2 - 3 * s);
    ctx.lineTo(mk.x + 5 * s, mk.y + bob2 - 3 * s);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawArm(m, arm, s, px2, flash, far) {
  const th = Math.max(2, 3 * s) * (m.bulk ? 1 + (m.bulk - 1) * 0.7 : 1);
  const armCol = m.look.sleeves || m.look.skin;   // long-sleeve under-layer
  ctx.strokeStyle = flash ? '#fff' : (far ? shade(armCol, -24) : armCol);
  ctx.lineWidth = th;
  const sh = px2(arm.sx || 0, arm.sy || m.h * 0.74);
  const el = px2(arm.ex, arm.ey), hn = px2(arm.hx, arm.hy);
  ctx.beginPath();
  ctx.moveTo(sh.x, sh.y); ctx.lineTo(el.x, el.y); ctx.lineTo(hn.x, hn.y);
  ctx.stroke();
  // fist (always skin — sleeves end at the wrist)
  ctx.fillStyle = flash ? '#fff' : (far ? shade(m.look.skin, -24) : m.look.skin);
  ctx.beginPath(); ctx.arc(hn.x, hn.y, th * 0.7, 0, 6.28); ctx.fill();
  // studded armband on the upper arm
  if (m.look.armband) {
    const adx = el.x - sh.x, ady = el.y - sh.y, ad = Math.hypot(adx, ady) || 1;
    const bx2 = sh.x + adx * 0.45, by2 = sh.y + ady * 0.45;
    ctx.strokeStyle = m.look.armband;
    ctx.lineWidth = th * 1.6;
    ctx.beginPath();
    ctx.moveTo(bx2 - adx / ad * 2.2 * s, by2 - ady / ad * 2.2 * s);
    ctx.lineTo(bx2 + adx / ad * 2.2 * s, by2 + ady / ad * 2.2 * s);
    ctx.stroke();
    ctx.fillStyle = '#d8dce6';
    for (const k of [-1.5, 0, 1.5]) {
      ctx.beginPath();
      ctx.arc(bx2 + adx / ad * k * s, by2 + ady / ad * k * s, Math.max(0.8, 0.85 * s), 0, 6.28);
      ctx.fill();
    }
  }
}
function drawHud() {
  if (state !== 'run' || !player) {
    if (banner) drawBanner();
    return;
  }
  const pad = 12, topPad = 10;
  // HP bar
  const bw = Math.min(240, W * 0.4);
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(pad, topPad, bw, 16);
  const hpFrac = clamp(player.hp / player.maxhp, 0, 1);
  ctx.fillStyle = hpFrac > 0.35 ? '#4fd35f' : '#ff4d4d';
  ctx.fillRect(pad + 2, topPad + 2, (bw - 4) * hpFrac, 12);
  ctx.font = '700 11px system-ui'; ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.fillText('HP', pad + 4, topPad + 12);
  // score (the bragging number) + gold (the economy) + kos
  ctx.textAlign = 'right';
  ctx.font = '900 19px system-ui';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(runScore.toLocaleString(), W - pad - 44, topPad + 15);
  ctx.font = '800 13px system-ui';
  ctx.fillStyle = '#ffb84d';
  ctx.fillText('🤘 ' + runCred, W - pad - 44, topPad + 32);
  ctx.font = '700 11px system-ui';
  ctx.fillStyle = '#e3cdd0';
  ctx.fillText(runKos + ' KOs', W - pad - 44, topPad + 47);
  // timer
  ctx.textAlign = 'center';
  ctx.font = '800 15px system-ui';
  ctx.fillStyle = '#fff';
  ctx.fillText(fmtTime(runT), W / 2, topPad + 15);
  if (combo > 1 && comboT > 0) {
    ctx.font = '900 20px system-ui';
    ctx.fillStyle = '#7bff9e';
    ctx.fillText(combo + 'x COMBO', W / 2, topPad + 40);
  }
  // ability cooldown chips — one per loadout slot (desktop; touch gets DOM buttons)
  if (!isTouch) {
    let ax0 = pad + 24;
    const ay0 = H - 38;
    for (let i = 0; i < MAX_LOADOUT; i++) {
      const id = save.loadout[i];
      if (!id) {   // empty slot: faint outline as an invitation
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#5a4a52'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ax0, ay0, 21, 0, 6.28); ctx.stroke();
        ctx.globalAlpha = 1;
        ax0 += 52;
        continue;
      }
      const a = ABILITIES.find(x => x.id === id);
      const st = abState[id];
      const l = abLvl(id);
      const frac = st.cd > 0 ? st.cd / a.cd(l) : 0;
      const active = st.t > 0;
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = active ? 'rgba(255,60,60,.55)' : 'rgba(24,12,16,.75)';
      ctx.beginPath(); ctx.arc(ax0, ay0, 21, 0, 6.28); ctx.fill();
      ctx.strokeStyle = frac > 0 ? '#5a4a52' : '#ffb84d';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.font = '19px system-ui'; ctx.textAlign = 'center';
      ctx.globalAlpha = frac > 0 ? 0.45 : 1;
      ctx.fillText(a.icon, ax0, ay0 + 7);
      ctx.globalAlpha = 0.92;
      if (frac > 0) {   // cooldown pie sweep
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.beginPath();
        ctx.moveTo(ax0, ay0);
        ctx.arc(ax0, ay0, 20, -Math.PI / 2, -Math.PI / 2 + frac * 6.283);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '800 12px system-ui';
        ctx.fillText(Math.ceil(st.cd), ax0, ay0 + 4);
      }
      ctx.font = '700 10px system-ui';
      ctx.fillStyle = '#c99aa0';
      ctx.fillText(SLOT_LABELS[i], ax0, ay0 + 33);
      ctx.globalAlpha = 1;
      ax0 += 52;
    }
  }
  if (banner) drawBanner();
}
function drawBanner() {
  const a = banner.t < 0.15 ? banner.t / 0.15 : banner.t > banner.dur - 0.3 ? (banner.dur - banner.t) / 0.3 : 1;
  ctx.save();
  ctx.globalAlpha = clamp(a, 0, 1);
  ctx.translate(W / 2 + (Math.random() - 0.5) * 3, H * 0.3);
  ctx.transform(1, 0, -0.1, 1, 0, 0);
  ctx.textAlign = 'center';
  ctx.font = '900 ' + Math.min(54, W * 0.085) + 'px system-ui';
  ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 8;
  ctx.strokeText(banner.txt, 0, 0);
  ctx.fillStyle = banner.color;
  ctx.fillText(banner.txt, 0, 0);
  if (banner.sub) {
    ctx.font = '700 16px system-ui';
    ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 5;
    ctx.strokeText(banner.sub, 0, 28);
    ctx.fillStyle = '#fff';
    ctx.fillText(banner.sub, 0, 28);
  }
  // countdown for wall of death
  if (ev && ev.type === 'wall' && ev.phase === 'warn') {
    const n = Math.ceil(3 - ev.t);
    ctx.font = '900 40px system-ui';
    ctx.strokeText(n, 0, 78);
    ctx.fillStyle = '#fff';
    ctx.fillText(n, 0, 78);
  }
  ctx.restore();
}
