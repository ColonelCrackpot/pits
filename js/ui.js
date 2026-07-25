'use strict';
// ============================== menu / shop / style UI ==============================
// ---- settings: volume sliders (YPIM pattern: live preview, own storage key) ----
// Wired for BOTH the menu and the pause panel — syncVolume() pushes the current
// levels into every set so the two never disagree.
const VOL_SETS = [['volMusic', 'volFx', 'volUi'], ['pVolMusic', 'pVolFx', 'pVolUi']];
function wireVolume(musicId, fxId, uiId) {
  const m = $(musicId), f = $(fxId), u = $(uiId);
  if (!m) return;
  let fxPrev = 0, uiPrev = 0;
  m.addEventListener('input', () => { AUDIO.music = m.value / 100; audioPersist(); applyAudio(); syncVolume(); });
  f.addEventListener('input', () => {
    AUDIO.fx = f.value / 100; audioPersist(); applyAudio(); syncVolume();
    clearTimeout(fxPrev); fxPrev = setTimeout(() => sfx.punch(), 120);
  });
  u.addEventListener('input', () => {
    AUDIO.ui = u.value / 100; audioPersist(); applyAudio(); syncVolume();
    clearTimeout(uiPrev); uiPrev = setTimeout(() => sfx.buy(), 120);
  });
}
function syncVolume() {
  for (const [mi, fi, ui] of VOL_SETS) {
    if (!$(mi)) continue;
    $(mi).value = Math.round(AUDIO.music * 100);
    $(fi).value = Math.round(AUDIO.fx * 100);
    $(ui).value = Math.round(AUDIO.ui * 100);
  }
}
for (const set of VOL_SETS) wireVolume(...set);
syncVolume();

// ---- pause: freeze the set, tweak the mix, or call it a night ----
function setPaused(on) {
  if (state !== 'run' && on) return;
  paused = !!on;
  document.body.classList.toggle('paused', paused);
  $('pauseOv').style.display = paused ? '' : 'none';
  $('pauseBtn').textContent = paused ? '▶' : '⏸';
  Music.setMode(paused ? 'menu' : 'run');   // duck the band while we talk
  if (paused) {
    syncVolume();
    $('pauseStats').innerHTML =
      `SCORE <span class="big">${runScore.toLocaleString()}</span><br>` +
      `<span class="big">${fmtTime(runT)}</span> survived · <span class="big">${runKos}</span> KOs<br>` +
      `<span class="big">🤘 ${runCred}</span> gold this set`;
  }
}
const togglePause = () => setPaused(!paused);
$('pauseBtn').addEventListener('click', togglePause);
$('resumeBtn').addEventListener('click', () => setPaused(false));
$('endRunBtn').addEventListener('click', () => {
  setPaused(false);
  gameOver();   // banks the gold and posts the score, same as being carried out
});
// ---- danger zone: wipe the save (volumes + ad consent survive on purpose) ----
// Two-tap confirm built into the button — native confirm() dialogs can be
// silently suppressed by the browser, which made the button look dead.
let resetArmedAt = -99999;
$('resetBtn').addEventListener('click', () => {
  const now = performance.now();
  if (now - resetArmedAt > 4000) {   // first tap: arm
    resetArmedAt = now;
    $('resetBtn').textContent = '⚠ wipe EVERYTHING? tap again';
    setTimeout(() => {
      if (performance.now() - resetArmedAt >= 3900) $('resetBtn').textContent = '⚠ reset save';
    }, 4100);
    return;
  }
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  location.reload();
});

// venue switcher + next-venue unlock
function renderVenue() {
  const box = $('venueBox');
  const v = save.venue, vm = save.venueMax;
  const nextCost = VENUE_COST(vm);
  const lu = curLineup(), multi = LINEUPS.length > 1;
  box.innerHTML =
    `<div class="strow">
      <button class="sarrow" id="vPrev" ${v <= 1 ? 'disabled' : ''}>◀</button>
      <div class="sval" style="text-align:center">${venueName(v)}<br>
        <span style="font-size:10.5px;color:#c99aa0;font-weight:600">venue ${v} · crowd ×${venueMult('hp') >= 100 ? Math.round(venueMult('hp')) : +venueMult('hp').toFixed(1)} tough</span></div>
      <button class="sarrow" id="vNext" ${v >= vm ? 'disabled' : ''}>▶</button>
    </div>
    <div class="strow">
      <button class="sarrow" id="luPrev" ${multi ? '' : 'disabled'}>◀</button>
      <div class="sval" style="text-align:center">🎤 ${lu.band}</div>
      <button class="sarrow" id="luNext" ${multi ? '' : 'disabled'}>▶</button>
    </div>
    <button class="buy" id="vBuy" style="width:100%;margin-bottom:4px" ${save.cred < nextCost ? 'disabled' : ''}>
      🎟 UNLOCK ${venueName(vm + 1).toUpperCase()} — 🤘 ${nextCost}</button>`;
  const sw = d => {
    save.venue = clamp(save.venue + d, 1, save.venueMax);
    persist(); resetCrowd(); refreshMenu();
  };
  $('vPrev').addEventListener('click', () => sw(-1));
  $('vNext').addEventListener('click', () => sw(1));
  const swl = d => {   // swap the band: new faces on stage, new setlist in the deck
    save.lineup = ((save.lineup || 0) + d + LINEUPS.length) % LINEUPS.length;
    persist(); BAND = null;
    Music.setTracks(lineupTracks(curLineup()));
    refreshMenu();
  };
  $('luPrev').addEventListener('click', () => swl(-1));
  $('luNext').addEventListener('click', () => swl(1));
  $('vBuy').addEventListener('click', () => {
    if (save.cred < nextCost) return;
    save.cred -= nextCost;
    save.venueMax++;
    save.venue = save.venueMax;
    persist(); sfx.best(); resetCrowd(); refreshMenu();
  });
}
function refreshMenu() {
  renderVenue();
  $('menuCred').textContent = save.cred;
  $('bestLine').textContent = save.bestTime > 0
    ? `Best: ${(save.bestScore || 0).toLocaleString()} score · ${fmtTime(save.bestTime)} survived · ${save.bestKos} KOs`
    : 'No sets survived yet. The pit awaits.';
  const list = $('upList');
  list.innerHTML = '';
  for (const u of UPG) {
    const l = lvl(u.id), maxed = l >= u.max, cost = upgCost(u);
    const row = document.createElement('div');
    row.className = 'uprow';
    row.innerHTML =
      `<div class="upicon">${u.icon}</div>
      <div class="upinfo">
        <div class="upname">${u.name}<span class="lvl">Lv ${l}${maxed ? ' MAX' : ''}</span></div>
        <div class="updesc">${u.desc}</div>
      </div>
      <button class="buy" ${maxed || save.cred < cost ? 'disabled' : ''}>${maxed ? 'MAX' : '🤘 ' + cost}</button>`;
    if (!maxed) {
      row.querySelector('.buy').addEventListener('click', () => {
        if (save.cred < cost) return;
        save.cred -= cost;
        save.up[u.id] = l + 1;
        persist(); sfx.buy(); refreshMenu();
      });
    }
    list.appendChild(row);
  }
  const ab = $('abList');
  ab.innerHTML = '';
  const loadoutFull = save.loadout.length >= MAX_LOADOUT;
  for (const a of ABILITIES) {
    const l = abLvl(a.id), maxed = l >= a.max, cost = abCost(a);
    const slot = save.loadout.indexOf(a.id);
    const row = document.createElement('div');
    row.className = 'uprow';
    const slotTag = slot >= 0 ? ` · <b style="color:#7bff9e">${SLOT_LABELS[slot]}</b>` : '';
    row.innerHTML =
      `<div class="upicon">${a.icon}</div>
      <div class="upinfo">
        <div class="upname">${a.name}<span class="lvl">${l === 0 ? 'LOCKED' : 'Lv ' + l + (maxed ? ' MAX' : '')}${slotTag}</span></div>
        <div class="updesc">${a.desc}</div>
      </div>
      ${l > 0 ? `<button class="buy eq" style="min-width:52px;${slot >= 0 ? 'background:linear-gradient(#57c964,#2f9e46);box-shadow:0 3px 0 #1c6e2e;color:#072b10' : ''}">${slot >= 0 ? 'ON' : (loadoutFull ? 'FULL' : 'EQUIP')}</button>` : ''}
      <button class="buy" ${maxed || save.cred < cost ? 'disabled' : ''}>${maxed ? 'MAX' : (l === 0 ? 'UNLOCK ' : '') + '🤘 ' + cost}</button>`;
    const eqBtn = row.querySelector('.eq');
    if (eqBtn) {
      eqBtn.addEventListener('click', () => {
        if (slot >= 0) save.loadout.splice(slot, 1);           // unequip
        else if (!loadoutFull) save.loadout.push(a.id);        // equip in next free slot
        else return;
        persist(); sfx.buy(); refreshMenu();
      });
    }
    if (!maxed) {
      row.querySelector('.buy:not(.eq)').addEventListener('click', () => {
        if (save.cred < cost) return;
        save.cred -= cost;
        save.ab[a.id] = l + 1;
        // only a brand-new unlock self-equips, and only into a free slot
        if (l === 0 && save.loadout.length < MAX_LOADOUT) save.loadout.push(a.id);
        persist(); sfx.buy(); refreshMenu();
      });
    }
    ab.appendChild(row);
  }
  $('menuHint').innerHTML = isTouch
    ? 'You <b>punch on your own</b> — just get close. <b>Left thumb</b> moves, the <b>round buttons</b> fire your equipped moves. Gold hits the floor — <b>walk over it</b> to scoop. Thirsty? Hit the <b>PIT STOP bar</b> (front left) — beer makes you hit harder.'
    : 'You <b>punch on your own</b> — just get close. <b>WASD</b> moves, <b>SPACE / Q / E / R</b> fire your equipped moves, <b>F</b> uses whatever you\'re holding. Gold hits the floor — <b>walk over it</b> to scoop. Thirsty? Hit the <b>PIT STOP bar</b> (front left) — beer makes you hit harder.';
}
refreshMenu();

// ---- character style picker ----
function renderStyle() {
  const box = $('styleRows');
  box.innerHTML = '';
  for (const o of STYLE_OPTS) {
    const cur = save.style[o.k];
    const row = document.createElement('div');
    row.className = 'strow';
    const label = o.color
      ? `<span class="swatch" style="background:${cur}"></span>`
      : o.k === 'beard' ? (cur ? 'Yes' : 'No')
      : o.k === 'hairStyle' ? (HAIRNAME[cur] || cur)
      : String(cur).charAt(0).toUpperCase() + String(cur).slice(1);
    row.innerHTML =
      `<div class="slabel">${o.name}</div>
      <button class="sarrow prev">◀</button>
      <div class="sval" style="text-align:center">${label}</div>
      <button class="sarrow next">▶</button>`;
    const cycle = dir => {
      let i = o.vals.findIndex(v => v === save.style[o.k]);
      if (i < 0) i = 0;
      save.style[o.k] = o.vals[(i + dir + o.vals.length) % o.vals.length];
      persist(); renderStyle();
      if (player) applyStyle(player);
    };
    row.querySelector('.prev').addEventListener('click', () => cycle(-1));
    row.querySelector('.next').addEventListener('click', () => cycle(1));
    box.appendChild(row);
  }
  drawStylePreview();
}
function drawStylePreview() {
  const c = $('stylePrev'), p = c.getContext('2d');
  const st = save.style;
  const fem = st.body === 'girl';
  p.clearRect(0, 0, c.width, c.height);
  const cx2 = 60, foot = 136, s = 1.5;
  p.lineCap = 'round';
  p.fillStyle = 'rgba(0,0,0,.35)';
  p.beginPath(); p.ellipse(cx2, foot + 4, 26, 8, 0, 0, 6.28); p.fill();
  const hipY = foot - 26 * s, neckY = foot - 45 * s, headY = foot - 52 * s;
  // legs
  p.strokeStyle = st.pants; p.lineWidth = fem ? 6 : 7;
  for (const sgn of [-1, 1]) {
    p.beginPath(); p.moveTo(cx2, hipY); p.quadraticCurveTo(cx2 + sgn * 7, (hipY + foot) / 2, cx2 + sgn * 11, foot); p.stroke();
  }
  // arms
  p.strokeStyle = st.skin; p.lineWidth = fem ? 5 : 6;
  for (const sgn of [-1, 1]) {
    p.beginPath(); p.moveTo(cx2 + sgn * 9, neckY + 8); p.quadraticCurveTo(cx2 + sgn * 17, neckY + 22, cx2 + sgn * 14, neckY + 38); p.stroke();
  }
  // torso (fem: slimmer line, wider hip)
  p.strokeStyle = st.shirt; p.lineWidth = fem ? 10 : 13;
  p.beginPath(); p.moveTo(cx2, hipY); p.lineTo(cx2, neckY); p.stroke();
  if (fem) {
    p.fillStyle = st.pants;
    p.beginPath(); p.ellipse(cx2, hipY, 10, 5.5, 0, 0, 6.28); p.fill();
  }
  // hair that hangs behind the head
  const HS = st.hairStyle;
  p.strokeStyle = st.hair;
  if (HS === 'long' || HS === 'alexi' || HS === 'glam') {
    p.lineWidth = HS === 'glam' ? 8 : 7;
    p.beginPath(); p.moveTo(cx2 - 5, headY); p.quadraticCurveTo(cx2 - 12, headY + 18, cx2 - 10, headY + 34); p.stroke();
    p.beginPath(); p.moveTo(cx2 + 5, headY); p.quadraticCurveTo(cx2 + 12, headY + 18, cx2 + 10, headY + 34); p.stroke();
    if (HS === 'glam') { p.beginPath(); p.moveTo(cx2, headY - 4); p.quadraticCurveTo(cx2 + 3, headY + 16, cx2, headY + 30); p.stroke(); }
  } else if (HS === 'ponytail' || HS === 'rattail') {
    p.lineWidth = HS === 'rattail' ? 3.5 : 5.5;
    p.beginPath(); p.moveTo(cx2 + 7, headY - 8); p.quadraticCurveTo(cx2 + 16, headY + 8, cx2 + 13, headY + 26); p.stroke();
    if (HS === 'ponytail') {
      p.fillStyle = '#3a1424';
      p.beginPath(); p.arc(cx2 + 10, headY - 2, 3, 0, 6.28); p.fill();
    }
  } else if (HS === 'braids') {
    p.lineWidth = 4.5;
    for (const sgn of [-1, 1]) {
      p.beginPath(); p.moveTo(cx2 + sgn * 8, headY - 2); p.quadraticCurveTo(cx2 + sgn * 14, headY + 12, cx2 + sgn * 12, headY + 26); p.stroke();
      p.fillStyle = '#3a1424';
      p.beginPath(); p.arc(cx2 + sgn * 12, headY + 27, 3, 0, 6.28); p.fill();
    }
  } else if (HS === 'dreads') {
    p.lineWidth = 4.5;
    for (const off of [-9, -3, 3, 9]) {
      p.beginPath(); p.moveTo(cx2 + off * 0.7, headY - 4); p.quadraticCurveTo(cx2 + off, headY + 10, cx2 + off, headY + 22); p.stroke();
    }
  } else if (HS === 'mullet' || HS === 'skullet') {
    p.lineWidth = 6;
    for (const sgn of [-1, 1]) {
      p.beginPath(); p.moveTo(cx2 + sgn * 5, headY - 1); p.quadraticCurveTo(cx2 + sgn * 10, headY + 10, cx2 + sgn * 8, headY + 21); p.stroke();
    }
  } else if (HS === 'halfshave') {
    p.lineWidth = 5.5;
    p.beginPath(); p.moveTo(cx2 - 7, headY - 4); p.quadraticCurveTo(cx2 - 13, headY + 12, cx2 - 11, headY + 26); p.stroke();
  }
  // head
  p.fillStyle = st.skin;
  p.beginPath(); p.arc(cx2, headY, 11, 0, 6.28); p.fill();
  if (st.beard) {
    p.fillStyle = st.hair;
    p.beginPath(); p.arc(cx2, headY + 6, 6.5, 0, 6.28); p.fill();
  }
  p.fillStyle = st.hair;
  if (HS === 'mohawk') {
    p.beginPath(); p.moveTo(cx2 - 9, headY - 4); p.lineTo(cx2, headY - 24); p.lineTo(cx2 + 9, headY - 4); p.closePath(); p.fill();
  } else if (HS === 'bob') {
    p.beginPath(); p.arc(cx2, headY - 3, 12, Math.PI, 0); p.fill();
    for (const sgn of [-1, 1]) {
      p.beginPath(); p.ellipse(cx2 + sgn * 9.5, headY + 2, 4.2, 8.5, 0, 0, 6.28); p.fill();
    }
  } else if (HS === 'spikes') {
    for (let k = 0; k < 5; k++) {
      const ang = -Math.PI * (0.15 + 0.7 * k / 4);
      p.beginPath();
      p.moveTo(cx2 + Math.cos(ang - 0.3) * 10, headY - 1 + Math.sin(ang - 0.3) * 10);
      p.lineTo(cx2 + Math.cos(ang) * 25, headY - 1 + Math.sin(ang) * 25);
      p.lineTo(cx2 + Math.cos(ang + 0.3) * 10, headY - 1 + Math.sin(ang + 0.3) * 10);
      p.closePath(); p.fill();
    }
  } else if (HS === 'deathhawk') {
    for (const k of [-1, 0, 1]) {
      p.beginPath();
      p.moveTo(cx2 + k * 5.5 - 5.5, headY - 6);
      p.lineTo(cx2 + k * 7 - 4, headY - 24 + Math.abs(k) * 5);
      p.lineTo(cx2 + k * 5.5 + 5.5, headY - 6);
      p.closePath(); p.fill();
    }
  } else if (HS === 'bun') {
    p.beginPath(); p.arc(cx2, headY - 4, 10.5, Math.PI, 0); p.fill();
    p.beginPath(); p.arc(cx2 - 2, headY - 15.5, 5.2, 0, 6.28); p.fill();
  } else if (HS === 'bandana') {
    p.beginPath(); p.arc(cx2, headY - 3, 10.5, Math.PI, 0); p.fill();
    p.strokeStyle = '#c43b2e'; p.lineWidth = 6;
    p.beginPath(); p.arc(cx2, headY - 4, 9.5, Math.PI * 1.03, Math.PI * 1.97); p.stroke();
    p.fillStyle = '#c43b2e';
    p.beginPath(); p.moveTo(cx2 - 9, headY - 7); p.lineTo(cx2 - 17, headY); p.lineTo(cx2 - 9, headY - 1); p.closePath(); p.fill();
  } else if (HS === 'slick') {
    p.beginPath(); p.ellipse(cx2 - 1, headY - 5, 11, 8.5, 0, Math.PI, 0); p.fill();
    p.strokeStyle = 'rgba(255,255,255,.35)'; p.lineWidth = 1.5;
    p.beginPath(); p.arc(cx2 - 2.5, headY - 5, 7.5, Math.PI * 1.15, Math.PI * 1.55); p.stroke();
  } else if (HS === 'devilock') {
    p.beginPath(); p.arc(cx2, headY - 4, 10.5, Math.PI, 0); p.fill();
    p.strokeStyle = st.hair; p.lineWidth = 5;
    p.beginPath(); p.moveTo(cx2 + 3, headY - 10); p.quadraticCurveTo(cx2 + 7, headY + 2, cx2 + 4, headY + 13); p.stroke();
  } else if (HS === 'halfshave') {
    p.beginPath();
    p.arc(cx2, headY - 3, 11, Math.PI * 0.75, Math.PI * 1.62);
    p.lineTo(cx2, headY - 3);
    p.closePath(); p.fill();
  } else if (HS === 'alexi') {
    p.beginPath(); p.arc(cx2, headY - 4, 10.5, Math.PI, 0); p.fill();
    p.strokeStyle = st.hair; p.lineWidth = 5;
    for (const sgn of [-1, 1]) {
      p.beginPath(); p.moveTo(cx2 + sgn * 8, headY - 6); p.quadraticCurveTo(cx2 + sgn * 11, headY + 4, cx2 + sgn * 9, headY + 14); p.stroke();
    }
    p.strokeStyle = 'rgba(0,0,0,.35)'; p.lineWidth = 2;
    p.beginPath(); p.moveTo(cx2, headY - 14.5); p.lineTo(cx2, headY - 7); p.stroke();
  } else if (HS !== 'bald' && HS !== 'skullet') {
    // every remaining style wears the standard cap (glam gets extra volume)
    p.beginPath(); p.arc(cx2, headY - 4, HS === 'glam' ? 12.5 : 10.5, Math.PI, 0); p.fill();
  }
}
$('styleBtn').addEventListener('click', () => {
  const box = $('styleBox');
  const open = box.style.display === 'none';
  box.style.display = open ? '' : 'none';
  if (open) renderStyle();
});

// ---- game-over panel buttons ----
$('dblBtn').addEventListener('click', () => {
  if (doubled) return;
  $('dblBtn').disabled = true;
  Ads.showRewarded({
    onReward: () => {
      doubled = true;
      save.cred += runCred; persist();
      $('earnedCred').textContent = '🤘 ' + runCred * 2;
      sfx.buy();
    },
    onClose: () => { $('dblBtn').style.display = 'none'; },
  });
});
$('againBtn').addEventListener('click', startRun);
$('menuBtn').addEventListener('click', showMenu);
$('startBtn').addEventListener('click', startRun);
