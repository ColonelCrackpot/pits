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

  // ONE depth-sorted pass over everything standing on the floor: bodies, loose
  // change and dropped loot all occlude each other by depth, so a coin behind
  // someone stays behind them
  const drawList = [];
  for (const m of moshers) drawList.push({ z: m.z, k: 0, o: m });
  for (const c of coins) drawList.push({ z: c.z, k: 1, o: c });
  for (const it of items) drawList.push({ z: it.z, k: 2, o: it });
  drawList.sort((a, b) => b.z - a.z);
  for (const e of drawList) {
    if (e.k === 0) drawMosher(e.o);
    else if (e.k === 1) drawCoin(e.o);
    else drawFloorItem(e.o);
  }
  ctx.globalAlpha = 1;
  drawEventWorld();
  // …and the front row with their backs to the camera, in front of everything
  drawFrontCrowd(beat);
  drawBar(beat);   // the PIT STOP counter claims the front-left corner
  drawAirborne();  // thrown bottles & lightning arc over the top of it all
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
function drawCoin(c) {   // loose change glinting on the floor
  const pr = proj(c.x, c.z, c.y);
  ctx.globalAlpha = c.t > 9 ? Math.max(0, (12 - c.t) / 3) : 1;
  ctx.fillStyle = '#b8860b';
  ctx.beginPath(); ctx.ellipse(pr.x, pr.y + 1.2 * pr.s, 3.2 * pr.s, 2.4 * pr.s, 0, 0, 6.28); ctx.fill();
  ctx.fillStyle = Math.sin(performance.now() / 160 + c.x * 3) > 0.3 ? '#ffe27a' : '#ffd166';
  ctx.beginPath(); ctx.ellipse(pr.x, pr.y, 3.2 * pr.s, 2.4 * pr.s, 0, 0, 6.28); ctx.fill();
  ctx.globalAlpha = 1;
}
// band backdrop: an uploadable PNG per lineup (bands/*.png). Until one loads —
// or if a band never supplies one — their name goes up on a cloth banner.
const bannerCache = {};
function bannerImg(src) {
  if (!src) return null;
  let e = bannerCache[src];
  if (!e) {
    e = bannerCache[src] = { img: new Image(), ok: false };
    e.img.onload = () => { e.ok = e.img.naturalWidth > 0; };
    e.img.onerror = () => { e.failed = true; };
    e.img.src = src;
  }
  return e.ok ? e.img : null;
}
// the banner hangs high on the wall; the NOW PLAYING toast sits under it
function bandBannerRect(stTop) {
  // as much of the back wall as we can spare — artwork is fitted inside with
  // its aspect kept, so a squarer logo still lands at a readable size
  const bw = Math.min(W * 0.5, 460);
  const bh = Math.min(stTop * 0.55, bw * 0.55);
  return { x: W / 2 - bw / 2, y: 30, w: bw, h: bh };   // y clears the HUD timer
}
function drawBandBanner(stTop) {
  const lu = curLineup();
  const rc = bandBannerRect(stTop);
  const bw = rc.w, bh = rc.h, bx = rc.x, by = rc.y;
  const img = bannerImg(lineupBanner(lu));
  if (img) {   // their artwork, letterboxed into the banner slot
    const r = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
    const iw = img.naturalWidth * r, ih = img.naturalHeight * r;
    ctx.drawImage(img, W / 2 - iw / 2, by + (bh - ih) / 2, iw, ih);
    return;
  }
  // fallback: printed cloth, sagging off two tie points
  ctx.save();
  ctx.fillStyle = 'rgba(10,7,12,.92)';
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw, by + bh);
  ctx.quadraticCurveTo(W / 2, by + bh + 7, bx, by + bh);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#7a2230';   // tie points
  for (const px of [bx + 6, bx + bw - 6]) {
    ctx.beginPath(); ctx.arc(px, by + 4, 2.5, 0, 6.28); ctx.fill();
  }
  const name = lu.band;
  let fs = Math.min(bh * 0.5, bw / (name.length * 0.62));
  ctx.font = '900 ' + Math.round(fs) + 'px system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8dce0';
  ctx.strokeStyle = 'rgba(0,0,0,.65)';
  ctx.lineWidth = Math.max(2, fs * 0.14);
  ctx.strokeText(name, W / 2, by + bh * 0.62);
  ctx.fillText(name, W / 2, by + bh * 0.62);
  ctx.restore();
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
  drawBandBanner(stTop);   // the band's name/logo hanging on the back wall
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
  // tonight's lineup takes the stage — who, where and how big all come from
  // the lineup entry (js/lineups.js). y is depth on the platform, so feet
  // always land ON the boards; upstage members draw first.
  if (!BAND) BAND = buildBand();
  const deck = stY - stTop;
  // the deck line: one edge running the full width BELOW the whole band, so
  // the stage reads as a flat floor instead of everyone standing on a hill
  const frontY = Math.min(stTop + (Math.max(...BAND.map(b => b.y)) + 0.16) * deck, stY - 8);
  ctx.strokeStyle = T.plat[2];
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, frontY + 1.5); ctx.lineTo(W, frontY + 1.5); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.05)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, frontY - 0.5); ctx.lineTo(W, frontY - 0.5); ctx.stroke();
  for (const bm of BAND.slice().sort((a, b) => a.y - b.y)) {
    drawBandMember(W * bm.x, stTop + bm.y * deck, bm.sc, beat, bm);
  }
  // strobe on the downbeat
  if (beat > 0.82) { ctx.fillStyle = `rgba(255,245,255,${(beat - 0.82) * 1.4})`; ctx.fillRect(0, 0, W, stY); }
}
// a band member, modeled like the pit bodies: pants legs, shirt torso, skin
// arms & head, real hair — facing the crowd, playing an actual instrument.
// (WHO is on stage comes from BAND / buildBand() in js/lineups.js.)
function drawBandMember(x, footY, sc, beat, mem) {
  const s = (H / 800) * 36 * sc;
  const t = performance.now() / 1000;
  const bang = Math.sin(t * 8.2 + mem.phase) * (0.45 + beat * 0.55);
  const R = mem.role;
  ctx.save();
  ctx.translate(x, footY);
  ctx.lineCap = 'round';
  // stage shadow
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(0, s * 0.03, s * 0.42, s * 0.09, 0, 0, 6.28); ctx.fill();

  const seated = R === 'drums';
  const hipY = seated ? -s * 0.38 : -s * 0.5;
  const neckY = hipY - s * 0.42;
  const lean = (R === 'vox' ? 0.4 : 0.2) * bang;      // headbang lean
  const nx = Math.sin(lean) * s * 0.18;
  const headY = neckY - s * 0.16 - Math.abs(Math.cos(lean)) * s * 0.02;
  const hx = nx * 1.6;

  // long hair hangs BEHIND the body — drawn first, so the torso and the
  // instrument sit in front of it exactly like they do in the pit
  if (mem.hairstyle === 'long') {
    ctx.strokeStyle = mem.hair;
    ctx.lineWidth = Math.max(2, s * 0.09);
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + sgn * s * 0.1, headY - s * 0.04);
      ctx.quadraticCurveTo(
        hx + sgn * s * 0.2 - bang * s * 0.28, headY + s * 0.24,
        hx + sgn * s * 0.16 - bang * s * 0.42, headY + s * 0.5);
      ctx.stroke();
    }
  }
  // legs
  ctx.strokeStyle = mem.pants;
  ctx.lineWidth = Math.max(2.5, s * 0.13);
  if (seated) {   // drummer: knees toward the kit, stool implied
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, hipY); ctx.lineTo(sgn * s * 0.22, hipY + s * 0.2); ctx.lineTo(sgn * s * 0.26, 0);
      ctx.stroke();
    }
  } else {
    const step = R === 'vox' ? s * 0.26 : s * 0.2;    // singer: wide stance
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, hipY); ctx.quadraticCurveTo(sgn * step * 0.7, hipY / 2, sgn * step, 0);
      ctx.stroke();
    }
  }
  // torso
  ctx.strokeStyle = mem.shirt;
  ctx.lineWidth = Math.max(3.5, s * 0.2);
  ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(nx, neckY); ctx.stroke();

  // arms + instrument, per role (skin arms, lineWidth thinner)
  const armW = Math.max(2, s * 0.1);
  ctx.strokeStyle = mem.skin;
  ctx.lineWidth = armW;
  const shY = neckY + s * 0.06;
  if (R === 'lead' || R === 'bass') {
    // guitar body at the hip, neck up-and-away; far hand frets, near hand strums
    const dir = R === 'lead' ? -1 : 1;                 // lead points left, bass right
    const gx = 0, gy = hipY - s * 0.06;
    const nkx = dir * s * 0.62, nky = gy - s * 0.34;
    // neck-side arm frets — drawn BEHIND the guitar, hand up on the neck
    ctx.beginPath(); ctx.moveTo(dir * s * 0.16, shY); ctx.lineTo(nkx * 0.8, nky * 0.98); ctx.stroke();
    const strum = Math.sin(t * 8.2 * 2 + mem.phase) * s * 0.05;
    // the instrument
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(dir * -0.45);
    ctx.strokeStyle = '#1c1410';
    ctx.lineWidth = Math.max(2, s * 0.07);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dir * s * 0.72, -s * 0.1); ctx.stroke();   // neck
    ctx.fillStyle = '#0d0b0e';
    ctx.fillRect(dir * s * 0.72 - s * 0.05, -s * 0.16, s * 0.1, s * 0.12);                    // headstock
    if (R === 'lead') {   // the white V
      ctx.fillStyle = '#efe8dc';
      ctx.strokeStyle = '#141216';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dir * s * 0.06, -s * 0.08);
      ctx.lineTo(-dir * s * 0.3, s * 0.18);
      ctx.lineTo(-dir * s * 0.12, 0);
      ctx.lineTo(-dir * s * 0.28, -s * 0.2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {              // sunburst bass
      ctx.fillStyle = '#3a2010';
      ctx.beginPath(); ctx.ellipse(-dir * s * 0.14, 0.02 * s, s * 0.2, s * 0.15, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#c87a2e';
      ctx.beginPath(); ctx.ellipse(-dir * s * 0.14, 0.02 * s, s * 0.12, s * 0.08, 0, 0, 6.28); ctx.fill();
    }
    ctx.restore();
    // …and the strumming arm lands ON TOP of the guitar, where a real one is
    ctx.strokeStyle = mem.skin;
    ctx.lineWidth = armW;
    ctx.beginPath(); ctx.moveTo(-dir * s * 0.16, shY); ctx.lineTo(gx + dir * s * 0.1, gy + s * 0.12 + strum); ctx.stroke();
    ctx.fillStyle = mem.skin;   // strumming hand
    ctx.beginPath(); ctx.arc(gx + dir * s * 0.1, gy + s * 0.12 + strum, s * 0.05, 0, 6.28); ctx.fill();
  } else if (R === 'drums') {
    // alternating sticks over the kit
    for (const [sgn, ph] of [[-1, 0], [1, Math.PI]]) {
      const hit2 = Math.max(0, Math.sin(t * 8.2 + ph));
      const hxx = sgn * s * 0.34, hyy = hipY - s * 0.12 + hit2 * s * 0.1;
      ctx.beginPath(); ctx.moveTo(sgn * s * 0.14, shY); ctx.lineTo(hxx, hyy); ctx.stroke();
      ctx.strokeStyle = '#c8b89a';   // stick
      ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.beginPath(); ctx.moveTo(hxx, hyy); ctx.lineTo(hxx + sgn * s * 0.16, hyy + s * 0.1 - hit2 * s * 0.06); ctx.stroke();
      ctx.strokeStyle = mem.skin;
      ctx.lineWidth = armW;
    }
  } else if (R === 'keys') {
    // both hands down on the board, pecking alternately
    for (const [sgn, ph] of [[-1, 0], [1, Math.PI * 0.7]]) {
      const peck = Math.abs(Math.sin(t * 8.2 + ph)) * s * 0.05;
      ctx.beginPath();
      ctx.moveTo(sgn * s * 0.14, shY);
      ctx.lineTo(sgn * s * 0.26, hipY - s * 0.16 + peck);
      ctx.stroke();
    }
  } else {   // vox
    // mic hand up to the face, other arm throwing horns skyward
    const mx = hx + s * 0.2, my = headY + s * 0.06;
    ctx.beginPath(); ctx.moveTo(s * 0.14, shY); ctx.lineTo(mx, my); ctx.stroke();
    const up = -bang * s * 0.08;
    ctx.beginPath(); ctx.moveTo(-s * 0.14, shY); ctx.lineTo(-s * 0.4, neckY - s * 0.3 + up); ctx.stroke();
    ctx.fillStyle = mem.skin;   // the horns fist
    ctx.beginPath(); ctx.arc(-s * 0.4, neckY - s * 0.3 + up, s * 0.05, 0, 6.28); ctx.fill();
    ctx.strokeStyle = mem.skin;
    ctx.lineWidth = Math.max(1, s * 0.035);
    for (const fdx of [-0.05, 0.02]) {   // index + pinky
      ctx.beginPath();
      ctx.moveTo(-s * 0.4 + fdx * s, neckY - s * 0.3 + up - s * 0.03);
      ctx.lineTo(-s * 0.42 + fdx * s * 1.6, neckY - s * 0.3 + up - s * 0.12);
      ctx.stroke();
    }
    // mic + short cable
    ctx.fillStyle = '#20242c';
    ctx.beginPath(); ctx.arc(mx + s * 0.02, my - s * 0.02, s * 0.055, 0, 6.28); ctx.fill();
  }

  // head
  ctx.fillStyle = mem.skin;
  ctx.beginPath(); ctx.arc(hx, headY, s * 0.15, 0, 6.28); ctx.fill();
  // hair on top
  ctx.fillStyle = mem.hair;
  if (mem.hairstyle === 'mohawk') {
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.12, headY - s * 0.06);
    ctx.lineTo(hx, headY - s * 0.34);
    ctx.lineTo(hx + s * 0.12, headY - s * 0.06);
    ctx.closePath(); ctx.fill();
  } else if (mem.hairstyle === 'spikes') {
    for (let k = 0; k < 4; k++) {
      const ang = -Math.PI * (0.2 + 0.6 * k / 3);
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(ang - 0.35) * s * 0.13, headY + Math.sin(ang - 0.35) * s * 0.13);
      ctx.lineTo(hx + Math.cos(ang) * s * 0.32, headY + Math.sin(ang) * s * 0.32);
      ctx.lineTo(hx + Math.cos(ang + 0.35) * s * 0.13, headY + Math.sin(ang + 0.35) * s * 0.13);
      ctx.closePath(); ctx.fill();
    }
  } else if (mem.hairstyle !== 'bald') {   // short cap (also the roots for long)
    ctx.beginPath(); ctx.arc(hx, headY - s * 0.04, s * 0.14, Math.PI, 0); ctx.fill();
  }

  // gear drawn in front of its operator
  if (R === 'drums') {
    ctx.fillStyle = '#241017';   // kick drum
    ctx.beginPath(); ctx.arc(0, -s * 0.22, s * 0.26, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#4a2a34';
    ctx.lineWidth = Math.max(1.5, s * 0.04);
    ctx.stroke();
    ctx.fillStyle = '#d8ccb0';
    ctx.beginPath(); ctx.arc(0, -s * 0.22, s * 0.17, 0, 6.28); ctx.fill();
    // rack toms riding on the kick
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = '#3a1a24';
      ctx.beginPath(); ctx.ellipse(sgn * s * 0.14, -s * 0.5, s * 0.12, s * 0.1, sgn * 0.15, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#d8ccb0';
      ctx.beginPath(); ctx.ellipse(sgn * s * 0.14, -s * 0.53, s * 0.1, s * 0.05, sgn * 0.15, 0, 6.28); ctx.fill();
    }
    // snare on its stand, hit-side
    ctx.strokeStyle = '#5a5040';
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath(); ctx.moveTo(-s * 0.38, 0); ctx.lineTo(-s * 0.38, -s * 0.32); ctx.stroke();
    ctx.fillStyle = '#8a2a34';
    ctx.fillRect(-s * 0.5, -s * 0.4, s * 0.24, s * 0.08);
    ctx.fillStyle = '#d8ccb0';
    ctx.beginPath(); ctx.ellipse(-s * 0.38, -s * 0.4, s * 0.12, s * 0.035, 0, 0, 6.28); ctx.fill();
    for (const sgn of [-1, 1]) {   // cymbals on stands
      const shim = Math.sin(t * 8.2 * 2 + sgn) * s * 0.02;
      ctx.strokeStyle = '#5a5040';
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath(); ctx.moveTo(sgn * s * 0.55, 0); ctx.lineTo(sgn * s * 0.55, -s * 0.62); ctx.stroke();
      ctx.fillStyle = '#c8a83a';
      ctx.beginPath(); ctx.ellipse(sgn * s * 0.55, -s * 0.62 + shim, s * 0.16, s * 0.035, 0, 0, 6.28); ctx.fill();
    }
  } else if (R === 'keys') {
    ctx.fillStyle = '#14161c';   // the board on its stand
    ctx.save();
    ctx.transform(1, -0.06, 0, 1, 0, 0);
    ctx.fillRect(-s * 0.44, hipY - s * 0.14, s * 0.88, s * 0.12);
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(-s * 0.4, hipY - s * 0.11, s * 0.8, s * 0.05);
    ctx.strokeStyle = '#14161c';
    ctx.lineWidth = 1;
    for (let k = 1; k < 10; k++) {
      const kx = -s * 0.4 + s * 0.8 * (k / 10);
      ctx.beginPath(); ctx.moveTo(kx, hipY - s * 0.11); ctx.lineTo(kx, hipY - s * 0.06); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#2a2e38';   // stand legs
    ctx.lineWidth = Math.max(1.5, s * 0.04);
    for (const sgn of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sgn * s * 0.3, hipY - s * 0.02); ctx.lineTo(sgn * s * 0.38, 0); ctx.stroke();
    }
  } else if (R === 'vox') {
    // mic cable trailing to the floor
    ctx.strokeStyle = '#20242c';
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(hx + s * 0.22, headY + s * 0.06);
    ctx.quadraticCurveTo(hx + s * 0.3, -s * 0.2, s * 0.1, 0);
    ctx.stroke();
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
  const stTop = syAt(D) - H * 0.16;
  const rc = bandBannerRect(stTop);
  const y = Math.min(rc.y + rc.h + 46, stTop - 10);   // tucked under the backdrop
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
  ctx.restore();   // no band credit here — their banner is hanging right above
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
  const gapX = W / 2 - bound(z) * 0.26 * s;   // the bar owns the front-left corner
  for (let i = 0; i < n; i++) {
    const x = (i - 0.5) * 46 * s + Math.sin(i * 5.1) * 10 * s;
    if (x < gapX) continue;
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
    ctx.strokeStyle = L.shirt; ctx.lineWidth = th * (L.fem ? 1.4 : 1.7);
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
  // torso — fem builds run slimmer through the middle, wider at the hip
  ctx.strokeStyle = flash ? '#fff' : L.shirt;
  ctx.lineWidth = th * (L.fem ? 1.5 : 1.9);
  const hip = px2(lean * 6, hipY), neck = px2(neckU, neckY);
  ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(neck.x, neck.y); ctx.stroke();
  if (L.fem) {
    ctx.fillStyle = flash ? '#fff' : L.pants;
    ctx.beginPath(); ctx.ellipse(hip.x, hip.y, 6 * s, 3.2 * s, 0, 0, 6.28); ctx.fill();
  }
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
  const hdef = HAIRDEF[hairStyleOf(L)] || {};
  if (m.hair && hdef.attach !== 'front') {   // hair chains sway behind the head
    const offs = hdef.multi || [0];          // braids/dreads/glam: several strands
    ctx.lineWidth = Math.max(2, (hdef.thin || offs.length > 1 ? 3.2 : 4.6) * s);
    for (const off of offs) {
      let hx0 = hd.x - fx * (hdef.attach === 'high' ? 4 : 3) * s + off * 0.5 * s;
      let hy0 = hd.y - (hdef.attach === 'high' ? 4.5 : 3) * s;
      for (let i = 0; i < m.hair.length; i++) {
        const hp3 = px2(m.hair[i].x + off, m.hair[i].y);
        ctx.strokeStyle = flash ? '#fff' : (L.hairTip && i > 0 ? L.hairTip : L.hair);
        ctx.beginPath(); ctx.moveTo(hx0, hy0); ctx.lineTo(hp3.x, hp3.y); ctx.stroke();
        if (hdef.tie && i === 0) {   // the hair tie
          ctx.fillStyle = '#3a1424';
          ctx.beginPath(); ctx.arc((hx0 + hp3.x) / 2, (hy0 + hp3.y) / 2, 2 * s, 0, 6.28); ctx.fill();
        }
        hx0 = hp3.x; hy0 = hp3.y;
      }
      if (hdef.tie && offs.length > 1) {   // braid bobbles at the tips
        ctx.fillStyle = '#3a1424';
        ctx.beginPath(); ctx.arc(hx0, hy0, 1.8 * s, 0, 6.28); ctx.fill();
      }
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
  if (m.hair && L.mask !== 'gold' && !hdef.nocap) {   // roots cap (skullet keeps the dome)
    ctx.fillStyle = flash ? '#fff' : L.hair;
    ctx.beginPath(); ctx.arc(hd.x, hd.y - 2 * s, 6.6 * s, Math.PI, 0); ctx.fill();
  }
  if (L.bot && !flash) {   // service antenna + optical visor
    ctx.strokeStyle = '#7a8494';
    ctx.lineWidth = Math.max(1, 1.4 * s);
    ctx.beginPath(); ctx.moveTo(hd.x, hd.y - 7 * s); ctx.lineTo(hd.x, hd.y - 12.5 * s); ctx.stroke();
    ctx.fillStyle = Math.sin(performance.now() / 280) > 0 ? '#ff4d4d' : '#8fd3ff';
    ctx.beginPath(); ctx.arc(hd.x, hd.y - 13.6 * s, 1.6 * s, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#1a2028';
    ctx.fillRect(hd.x - 5 * s + fx * 1.2 * s, hd.y - 2.6 * s, 9.5 * s, 3.2 * s);
    ctx.fillStyle = '#ff3b47';
    ctx.beginPath(); ctx.arc(hd.x + fx * 3 * s, hd.y - 1 * s, 1.2 * s, 0, 6.28); ctx.fill();
  }
  const HS = L.mask === 'gold' ? 'bald' : hairStyleOf(L);
  ctx.fillStyle = flash ? '#fff' : L.hair;
  if (L.mask === 'gold') {
    // no hair styles over the mask
  } else if (HS === 'bob') {   // the bob: full cap plus side curtains down to the jaw
    ctx.beginPath(); ctx.arc(hd.x, hd.y - 1.6 * s, 7.6 * s, Math.PI, 0); ctx.fill();
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(hd.x + sgn * 6 * s, hd.y + 1.2 * s, 2.7 * s, 5.2 * s, 0, 0, 6.28);
      ctx.fill();
    }
  } else if (HS === 'mohawk') {
    ctx.beginPath();
    ctx.moveTo(hd.x - 6 * s, hd.y - 2 * s);
    ctx.lineTo(hd.x, hd.y - 14 * s);
    ctx.lineTo(hd.x + 6 * s, hd.y - 2 * s);
    ctx.closePath(); ctx.fill();
  } else if (HS === 'spikes') {   // liberty spikes: a crown of daggers
    for (let k = 0; k < 5; k++) {
      const ang = -Math.PI * (0.15 + 0.7 * k / 4);
      ctx.beginPath();
      ctx.moveTo(hd.x + Math.cos(ang - 0.3) * 6.2 * s, hd.y - 1 * s + Math.sin(ang - 0.3) * 6.2 * s);
      ctx.lineTo(hd.x + Math.cos(ang) * 15.5 * s, hd.y - 1 * s + Math.sin(ang) * 15.5 * s);
      ctx.lineTo(hd.x + Math.cos(ang + 0.3) * 6.2 * s, hd.y - 1 * s + Math.sin(ang + 0.3) * 6.2 * s);
      ctx.closePath(); ctx.fill();
    }
  } else if (HS === 'deathhawk') {   // wide floppy crest leaning off the back
    for (const k of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(hd.x + (k * 3.4 - 3.4) * s, hd.y - 4 * s);
      ctx.lineTo(hd.x + (k * 4.4 - fx * 2.4) * s, hd.y - (14.5 - Math.abs(k) * 3) * s);
      ctx.lineTo(hd.x + (k * 3.4 + 3.4) * s, hd.y - 4 * s);
      ctx.closePath(); ctx.fill();
    }
  } else if (HS === 'bun') {   // undercut bun: tight dome, knot on top
    ctx.beginPath(); ctx.arc(hd.x, hd.y - 2.4 * s, 6.6 * s, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(hd.x - fx * 1.4 * s, hd.y - 9.6 * s, 3.2 * s, 0, 6.28); ctx.fill();
  } else if (HS === 'bandana') {   // knotted over the skull, tail in the wind
    ctx.beginPath(); ctx.arc(hd.x, hd.y - 2 * s, 6.6 * s, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = flash ? '#fff' : '#c43b2e';
    ctx.lineWidth = Math.max(2, 3.4 * s);
    ctx.beginPath(); ctx.arc(hd.x, hd.y - 2.6 * s, 6 * s, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
    ctx.fillStyle = flash ? '#fff' : '#c43b2e';
    ctx.beginPath();
    ctx.moveTo(hd.x - fx * 5.6 * s, hd.y - 4 * s);
    ctx.lineTo(hd.x - fx * 10 * s, hd.y + 1 * s);
    ctx.lineTo(hd.x - fx * 5 * s, hd.y - 0.5 * s);
    ctx.closePath(); ctx.fill();
  } else if (HS === 'slick') {   // combed straight back, still wet
    ctx.beginPath(); ctx.ellipse(hd.x - fx * 0.8 * s, hd.y - 3 * s, 6.9 * s, 5.4 * s, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.3)';
    ctx.lineWidth = Math.max(1, 1 * s);
    ctx.beginPath(); ctx.arc(hd.x - fx * 1.5 * s, hd.y - 3 * s, 4.6 * s, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
  } else if (HS === 'devilock') {   // slick sides, one long lock over the face
    ctx.beginPath(); ctx.arc(hd.x, hd.y - 2.4 * s, 6.6 * s, Math.PI, 0); ctx.fill();
    if (m.hair) {
      ctx.strokeStyle = flash ? '#fff' : L.hair;
      ctx.lineWidth = Math.max(2, 3.4 * s);
      let dx0 = hd.x + fx * 3.4 * s, dy0 = hd.y - 3 * s;
      for (const h of m.hair) {
        const hp3 = px2(h.x, h.y);
        ctx.beginPath(); ctx.moveTo(dx0, dy0); ctx.lineTo(hp3.x, hp3.y); ctx.stroke();
        dx0 = hp3.x; dy0 = hp3.y;
      }
    }
  } else if (HS === 'alexi') {   // center part + curtains framing the face
    ctx.strokeStyle = flash ? '#fff' : L.hair;
    ctx.lineWidth = Math.max(2, 3.4 * s);
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hd.x + sgn * 5.4 * s, hd.y - 5 * s);
      ctx.quadraticCurveTo(hd.x + sgn * 7.6 * s, hd.y + 2 * s, hd.x + sgn * 6 * s, hd.y + 9 * s);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.lineWidth = Math.max(1, 1.2 * s);
    ctx.beginPath(); ctx.moveTo(hd.x, hd.y - 8.4 * s); ctx.lineTo(hd.x, hd.y - 5.4 * s); ctx.stroke();
  } else if (HS === 'halfshave') {   // one proud side, one shaved side
    ctx.beginPath();
    ctx.arc(hd.x, hd.y - 2 * s, 6.9 * s, Math.PI * 0.75, Math.PI * 1.62);
    ctx.lineTo(hd.x, hd.y - 2 * s);
    ctx.closePath(); ctx.fill();
  } else if (HS !== 'bald' && !m.hair) {
    ctx.beginPath(); ctx.arc(hd.x, hd.y - 2.4 * s, 6.6 * s, Math.PI, 0); ctx.fill();
  }
  // near arm (in front)
  drawArm(m, nearArm, s, px2, flash, false);
  // whatever's in the player's hand (bottle etc.) rides in front of the arm
  if (m.isPlayer && held) {
    const IT = ITEM_TYPES[held.type];
    if (IT.drawHeld) IT.drawHeld(m, px2, s, nearArm);
  }
  if (L.controller && !m.ko) {   // Andre's rig: both thumbs busy, antenna up
    const cc = px2(neckU + kfx * 6, m.h * 0.5);
    ctx.save();
    ctx.translate(cc.x, cc.y);
    ctx.fillStyle = '#20262e';
    ctx.fillRect(-5 * s, -2.5 * s, 10 * s, 5 * s);
    ctx.strokeStyle = '#7a8494';
    ctx.lineWidth = Math.max(1, 1.2 * s);
    ctx.beginPath(); ctx.moveTo(kfx * 3 * s, -2.5 * s); ctx.lineTo(kfx * 5.5 * s, -8.5 * s); ctx.stroke();
    ctx.fillStyle = Math.sin(performance.now() / 220) > 0 ? '#7bff9e' : '#144d28';
    ctx.beginPath(); ctx.arc(-kfx * 2.5 * s, 0, 1 * s, 0, 6.28); ctx.fill();
    ctx.restore();
  }
  // guitars, slung in FRONT of the body — Luke's pride, or your loot
  const prop = L.prop || (m.isPlayer && held && ITEM_TYPES[held.type].prop) || null;
  if (prop === 'vguitar' || prop === 'bassg' || prop === 'acg') {
    const gx = px2(neckU + kfx * 5, hipY + 7);
    ctx.save();
    ctx.translate(gx.x, gx.y);
    // smashT: hoisted overhead and brought DOWN across the smash arc
    const smash = (m.smashT || 0) > 0 ? Math.sin((1 - m.smashT / 0.38) * Math.PI) : 0;
    ctx.rotate(kfx * (-0.5 + Math.sin(m.bangPhase) * 0.06 - smash * 2.2));
    const u = s * 1.3;
    if (prop === 'vguitar') {
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
    } else if (prop === 'bassg') {   // long neck, sunburst body, pure low end
      ctx.strokeStyle = '#1c1410';
      ctx.lineWidth = Math.max(2, 2.2 * u);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-kfx * 28 * u, -14 * u); ctx.stroke();
      ctx.fillStyle = '#0d0b0e';
      ctx.fillRect(-kfx * 30 * u - (kfx > 0 ? 0 : 5 * u), -17 * u, 5 * u, 5 * u);
      ctx.fillStyle = '#3a2010';   // sunburst rim
      ctx.beginPath(); ctx.ellipse(kfx * 9 * u, 1.5 * u, 8.5 * u, 6.8 * u, kfx * 0.25, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#c87a2e';   // sunburst heart
      ctx.beginPath(); ctx.ellipse(kfx * 9 * u, 1.5 * u, 5.4 * u, 4 * u, kfx * 0.25, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#e8e0d0';
      ctx.lineWidth = Math.max(1, 0.7 * u);
      ctx.beginPath(); ctx.moveTo(kfx * 13 * u, 1.5 * u); ctx.lineTo(-kfx * 26 * u, -13 * u); ctx.stroke();
    } else {   // acoustic: warm wood, big hips, a hole where the mosh should be
      ctx.strokeStyle = '#2a2018';
      ctx.lineWidth = Math.max(2, 2 * u);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-kfx * 20 * u, -11 * u); ctx.stroke();
      ctx.fillStyle = '#0d0b0e';
      ctx.fillRect(-kfx * 22 * u - (kfx > 0 ? 0 : 5 * u), -14 * u, 5 * u, 5 * u);
      ctx.fillStyle = '#b8874a';
      ctx.beginPath(); ctx.ellipse(kfx * 9 * u, 2 * u, 9.5 * u, 7.6 * u, kfx * 0.22, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#2a1a0c';   // sound hole
      ctx.beginPath(); ctx.arc(kfx * 6.5 * u, 0.6 * u, 3 * u, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#efe4d0';
      ctx.lineWidth = Math.max(1, 0.7 * u);
      ctx.beginPath(); ctx.moveTo(kfx * 12 * u, 2 * u); ctx.lineTo(-kfx * 18 * u, -10 * u); ctx.stroke();
    }
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
  drawDrunkHud(pad, topPad, bw);   // the third meter: liquid confidence
  drawItemHud();                   // held item chip + bar prompt
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
