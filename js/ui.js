'use strict';
// ============================== menu / shop / style UI ==============================
// ---- settings: volume sliders (YPIM pattern: live preview, own storage key) ----
{
  const volMusic = $('volMusic'), volFx = $('volFx'), volUi = $('volUi');
  volMusic.value = Math.round(AUDIO.music * 100);
  volFx.value = Math.round(AUDIO.fx * 100);
  volUi.value = Math.round(AUDIO.ui * 100);
  let fxPrev = 0, uiPrev = 0;
  volMusic.addEventListener('input', () => { AUDIO.music = volMusic.value / 100; audioPersist(); applyAudio(); });
  volFx.addEventListener('input', () => {
    AUDIO.fx = volFx.value / 100; audioPersist(); applyAudio();
    clearTimeout(fxPrev); fxPrev = setTimeout(() => sfx.punch(), 120);
  });
  volUi.addEventListener('input', () => {
    AUDIO.ui = volUi.value / 100; audioPersist(); applyAudio();
    clearTimeout(uiPrev); uiPrev = setTimeout(() => sfx.buy(), 120);
  });
}
// ---- danger zone: wipe the save (volumes + ad consent survive on purpose) ----
$('resetBtn').addEventListener('click', () => {
  if (!confirm('Wipe ALL progress — gold, upgrades, abilities, venues, scoreboard name — and start over?')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  location.reload();
});

// venue switcher + next-venue unlock
function renderVenue() {
  const box = $('venueBox');
  const v = save.venue, vm = save.venueMax;
  const nextCost = VENUE_COST(vm);
  box.innerHTML =
    `<div class="strow">
      <button class="sarrow" id="vPrev" ${v <= 1 ? 'disabled' : ''}>◀</button>
      <div class="sval" style="text-align:center">${venueName(v)}<br>
        <span style="font-size:10.5px;color:#c99aa0;font-weight:600">venue ${v} · crowd ×${venueMult('hp') >= 100 ? Math.round(venueMult('hp')) : +venueMult('hp').toFixed(1)} tough</span></div>
      <button class="sarrow" id="vNext" ${v >= vm ? 'disabled' : ''}>▶</button>
    </div>
    <button class="buy" id="vBuy" style="width:100%;margin-bottom:4px" ${save.cred < nextCost ? 'disabled' : ''}>
      🎟 UNLOCK ${venueName(vm + 1).toUpperCase()} — 🤘 ${nextCost}</button>`;
  const sw = d => {
    save.venue = clamp(save.venue + d, 1, save.venueMax);
    persist(); resetCrowd(); refreshMenu();
  };
  $('vPrev').addEventListener('click', () => sw(-1));
  $('vNext').addEventListener('click', () => sw(1));
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
    ? 'You <b>punch on your own</b> — just get close. <b>Left thumb</b> moves, the <b>round buttons</b> fire your equipped moves. Gold hits the floor — <b>walk over it</b> to scoop.'
    : 'You <b>punch on your own</b> — just get close. <b>WASD</b> moves, <b>SPACE / Q / E / R</b> fire your equipped moves. Gold hits the floor — <b>walk over it</b> to scoop.';
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
      : (o.k === 'beard' ? (cur ? 'Yes' : 'No') : String(cur).charAt(0).toUpperCase() + String(cur).slice(1));
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
  p.clearRect(0, 0, c.width, c.height);
  const cx2 = 60, foot = 136, s = 1.5;
  p.lineCap = 'round';
  p.fillStyle = 'rgba(0,0,0,.35)';
  p.beginPath(); p.ellipse(cx2, foot + 4, 26, 8, 0, 0, 6.28); p.fill();
  const hipY = foot - 26 * s, neckY = foot - 45 * s, headY = foot - 52 * s;
  // legs
  p.strokeStyle = st.pants; p.lineWidth = 7;
  for (const sgn of [-1, 1]) {
    p.beginPath(); p.moveTo(cx2, hipY); p.quadraticCurveTo(cx2 + sgn * 7, (hipY + foot) / 2, cx2 + sgn * 11, foot); p.stroke();
  }
  // arms
  p.strokeStyle = st.skin; p.lineWidth = 6;
  for (const sgn of [-1, 1]) {
    p.beginPath(); p.moveTo(cx2 + sgn * 9, neckY + 8); p.quadraticCurveTo(cx2 + sgn * 17, neckY + 22, cx2 + sgn * 14, neckY + 38); p.stroke();
  }
  // torso
  p.strokeStyle = st.shirt; p.lineWidth = 13;
  p.beginPath(); p.moveTo(cx2, hipY); p.lineTo(cx2, neckY); p.stroke();
  // long hair behind the head
  if (st.hairStyle === 'long') {
    p.strokeStyle = st.hair; p.lineWidth = 7;
    p.beginPath(); p.moveTo(cx2 - 5, headY); p.quadraticCurveTo(cx2 - 12, headY + 18, cx2 - 10, headY + 34); p.stroke();
    p.beginPath(); p.moveTo(cx2 + 5, headY); p.quadraticCurveTo(cx2 + 12, headY + 18, cx2 + 10, headY + 34); p.stroke();
  }
  // head
  p.fillStyle = st.skin;
  p.beginPath(); p.arc(cx2, headY, 11, 0, 6.28); p.fill();
  if (st.beard) {
    p.fillStyle = st.hair;
    p.beginPath(); p.arc(cx2, headY + 6, 6.5, 0, 6.28); p.fill();
  }
  if (st.hairStyle === 'mohawk') {
    p.fillStyle = st.hair;
    p.beginPath(); p.moveTo(cx2 - 9, headY - 4); p.lineTo(cx2, headY - 24); p.lineTo(cx2 + 9, headY - 4); p.closePath(); p.fill();
  } else if (st.hairStyle === 'long' || st.hairStyle === 'short') {
    p.fillStyle = st.hair;
    p.beginPath(); p.arc(cx2, headY - 4, st.hairStyle === 'long' ? 10.5 : 10, Math.PI, 0); p.fill();
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
