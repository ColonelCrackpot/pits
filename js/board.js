'use strict';
// ============================== leaderboard (PIT LEGENDS) ==============================
const Board = (() => {
  const on = () => !!(SB.url && SB.anon);
  const headers = () => ({ apikey: SB.anon, Authorization: 'Bearer ' + SB.anon, 'Content-Type': 'application/json' });
  let lastSubmitted = 0;
  return {
    on,
    async submit(secs) {
      if (!on() || !save.playerName || !(secs > 0) || secs <= lastSubmitted) return false;
      try {
        const res = await fetch(SB.url + '/rest/v1/rpc/' + SB.rpc, {
          method: 'POST', headers: headers(),
          body: JSON.stringify({ p_id: save.pid, p_name: save.playerName, p_secs: Math.min(Math.round(secs), SB.maxSecs) }),
        });
        if (res.ok) { lastSubmitted = secs; return true; }
      } catch (e) {}
      return false;
    },
    async top(limit) {
      if (!on()) return null;
      try {
        const res = await fetch(`${SB.url}/rest/v1/${SB.table}?select=name,secs,player_id&order=secs.desc&limit=${limit || 25}`, { headers: headers() });
        if (res.ok) return await res.json();
      } catch (e) {}
      return null;
    },
  };
})();

// ---- board panel UI ----
let boardReturn = 'menuOv';
function openBoard(from) {
  boardReturn = from;
  $(from).style.display = 'none';
  $('boardOv').style.display = 'flex';
  $('nameInp').value = save.playerName || '';
  renderBoard();
}
async function renderBoard() {
  const el = $('boardList');
  if (!Board.on()) { el.innerHTML = '<div style="color:#c99aa0;padding:10px">Leaderboard offline.</div>'; return; }
  el.textContent = 'loading…';
  const rows = await Board.top(25);
  if (!rows) { el.innerHTML = '<div style="color:#ffb3a0;padding:10px">Could not reach the leaderboard — try again in a moment.</div>'; return; }
  el.innerHTML = '';
  if (!rows.length) {
    el.innerHTML = '<div style="color:#c99aa0;padding:10px">No legends yet — be the first! Set a pit name above; your best survival time posts automatically after each set.</div>';
  } else {
    rows.forEach((r, i) => {
      const d = document.createElement('div');
      d.className = 'brow' + (r.player_id === save.pid ? ' me' : '');
      d.innerHTML = `<span class="rk">${i + 1}</span><span class="nm"></span><span class="sc">${fmtTime(r.secs)}</span>`;
      d.querySelector('.nm').textContent = r.name || 'Anonymous';
      el.appendChild(d);
    });
  }
  const mine = document.createElement('div');
  mine.style.cssText = 'margin-top:8px;color:#c99aa0;font-size:12px;text-align:center';
  mine.textContent = save.playerName
    ? `You (${save.playerName}) — best: ${fmtTime(save.bestTime)}`
    : 'Set a pit name above to join the board!';
  el.appendChild(mine);
}
$('nameSave').addEventListener('click', () => {
  const v = $('nameInp').value.trim().slice(0, 16);
  if (!v) return;
  save.playerName = v;
  persist(); sfx.buy();
  Board.submit(save.bestTime).then(() => renderBoard());
});
$('boardBtnM').addEventListener('click', () => openBoard('menuOv'));
$('boardBtnO').addEventListener('click', () => openBoard('overOv'));
$('boardBack').addEventListener('click', () => { $('boardOv').style.display = 'none'; $(boardReturn).style.display = 'flex'; });
