'use strict';
// ============================== boot & main loop ==============================
for (let i = 0; i < 12; i++) spawnNpc(false);   // menu attract crowd

let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.05) dt = 0.05;
  if (W !== innerWidth || H !== innerHeight) relayout();   // embeds can start 0-sized without firing resize
  update(dt);
  render();
  if (isTouch) { updateAbBtns(); updateItemBtn(); }
}
requestAnimationFrame(frame);

// ---- debug / test API ----
window.PITS = {
  start: startRun,
  menu: showMenu,
  over: gameOver,
  event: t => { if (state === 'run') { ev = null; triggerEvent(t); } },
  boss: t => spawnBoss(t || 'jarrad'),
  venue: n => { n = Math.max(1, n || 1); save.venueMax = Math.max(save.venueMax, n); save.venue = n; persist(); resetCrowd(); refreshMenu(); },
  god: v => { god = v !== false; },
  abilities: n => { for (const a of ABILITIES) save.ab[a.id] = Math.min(a.max, n == null ? a.max : n); ensureLoadout(); persist(); refreshMenu(); updateAbBtns(); },
  loadout: ids => { save.loadout = ids || []; ensureLoadout(); persist(); refreshMenu(); },
  use: id => useAbility(id),
  music: list => Music.setTracks(list),
  nowPlaying: () => Music.now(),
  cred: n => { save.cred += (n || 500); persist(); refreshMenu(); },
  kill: () => { if (player) { player.hp = 0; playerDown(); } },
  drunk: n => { drunk = clamp(n == null ? 100 : n, 0, 100); },
  item: t => { if (player) spawnItem(t || 'beer', player.x + 34, player.z); },
  state: () => ({
    state, runT: Math.round(runT), runScore, runCred, runKos,
    hp: player ? Math.round(player.hp) : null,
    moshers: moshers.length, ev: ev && ev.type, cred: save.cred,
  }),
};
