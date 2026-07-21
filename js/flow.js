'use strict';
// ============================== game flow ==============================
function startRun() {
  audioInit();
  Music.setMode('run');
  moshers = moshers.filter(m => !m.isPlayer);
  player = makeMosher(0, D * 0.22, true);
  moshers.push(player);
  windUsed = 0;
  for (const id in abState) { abState[id].cd = 0; abState[id].t = 0; }
  coins = [];
  ensureLoadout();
  updateAbBtns();
  runT = 0; runCred = 0; runScore = 0; runKos = 0; combo = 0; doubled = false;
  evTimer = 16 + rnd(0, 6);
  nextBossT = 90; bossIdx = 0;
  ev = null; diver = null;
  moshers = moshers.filter(m => !m.boss);   // no leftover bosses from attract mode
  state = 'run';
  $('menuOv').style.display = 'none';
  $('overOv').style.display = 'none';
  banner = { txt: 'PIT\'S OPEN', sub: 'take someone out', t: 0, dur: 1.6, color: '#ffb84d' };
}
function gameOver() {
  state = 'over';
  Music.setMode('menu');
  runScore += Math.round(runT * 10);   // survival time pays score too
  const t = runT, kos = runKos, score = runScore;
  let newBest = false;
  if (t > save.bestTime) { save.bestTime = t; newBest = true; }
  if (kos > save.bestKos) save.bestKos = kos;
  const newBestScore = score > save.bestScore;
  if (newBestScore) { save.bestScore = score; newBest = true; }
  save.cred += runCred;
  persist();
  if (newBest) sfx.best();
  Board.submit(save.bestTime);
  updateAbBtns();
  $('overStats').innerHTML =
    `SCORE <span class="big">${score.toLocaleString()}</span>${newBestScore ? ' <span class="newbest">NEW BEST!</span>' : ''}<br>` +
    `Survived <span class="big">${fmtTime(t)}</span> · <span class="big">${kos}</span> KOs<br>` +
    `Earned <span class="big" id="earnedCred">🤘 ${runCred}</span> gold`;
  $('dblBtn').style.display = Ads.hasRewarded() && runCred > 0 ? '' : 'none';
  $('dblBtn').disabled = false;
  $('overOv').style.display = '';
  Ads.showInterstitial('set-over');
}
function showMenu() {
  state = 'menu';
  Music.setMode('menu');
  moshers = moshers.filter(m => !m.isPlayer);
  player = null;
  $('overOv').style.display = 'none';
  $('menuOv').style.display = '';
  refreshMenu();
}

// between-song lull: the pit cools off, part of the crowd wanders away…
Music.onEnd = () => {
  calm = 8;
  ev = null; diver = null;
  evTimer = Math.max(evTimer, 12);
  const keep = maxNpc();          // calm cap (calm already set)
  const npcs = moshers.filter(m => !m.isPlayer && !m.ko && !m.dead && !m.boss);
  npcs.slice(keep).forEach(m => { m.leaving = true; });   // bosses never leave
  if (state === 'run') banner = { txt: 'SONG\'S DONE', sub: 'catch your breath', t: 0, dur: 2, color: '#8fd3ff' };
};
// …and floods back in when the next track kicks off
Music.onSong = title => {
  calm = 0;
  for (const m of moshers) m.leaving = false;
  songToast = { title, t: 0 };
};
