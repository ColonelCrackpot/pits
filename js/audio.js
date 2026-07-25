'use strict';
// ============================== audio ==============================
let ac = null, master = null, musicGain = null, sfxGain = null, uiGain = null;
// volume prefs live in their own key (like YPIM) so a save-wipe keeps them
const AUDIO = { muted: false, music: 0.5, fx: 0.9, ui: 0.8 };
try {
  const stored = localStorage.getItem('pits_audio');
  if (stored) Object.assign(AUDIO, JSON.parse(stored));
  else if (typeof save.muted === 'boolean') AUDIO.muted = save.muted;   // migrate the old flag
} catch (e) {}
function audioPersist() { try { localStorage.setItem('pits_audio', JSON.stringify(AUDIO)); } catch (e) {} }
let musicModeFactor = 0.5;   // menus duck the music; a run opens it up
function applyAudio() {
  if (!ac) return;
  master.gain.value = AUDIO.muted ? 0 : 1;
  musicGain.gain.value = AUDIO.music * musicModeFactor;
  sfxGain.gain.value = AUDIO.fx;
  uiGain.gain.value = AUDIO.ui;
}
function audioInit() {
  if (ac) return;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.connect(master);
    sfxGain = ac.createGain(); sfxGain.connect(master);
    uiGain = ac.createGain(); uiGain.connect(master);
    applyAudio();
    Music.start();
  } catch (e) {}
}
function beep(f0, f1, dur, type, vol, bus) {
  if (!ac) return;
  try {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), ac.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.1, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g); g.connect(bus || sfxGain);
    o.start(); o.stop(ac.currentTime + dur + 0.02);
  } catch (e) {}
}
function boom(dur, vol, freq, bus) {
  if (!ac) return;
  try {
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource(); src.buffer = buf;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = freq || 700;
    const g = ac.createGain(); g.gain.value = vol || 0.4;
    src.connect(lp); lp.connect(g); g.connect(bus || sfxGain);
    src.start();
  } catch (e) {}
}
const sfx = {
  whoosh: () => beep(900, 200, 0.08, 'sawtooth', 0.05),
  punch:  () => boom(0.09, 0.5, 500),
  ko:     () => { boom(0.3, 0.55, 350); beep(700, 120, 0.25, 'square', 0.1); },
  hurt:   () => beep(220, 90, 0.15, 'sawtooth', 0.16),
  buy:    () => { beep(660, 660, 0.07, 'square', 0.1, uiGain); setTimeout(() => beep(990, 990, 0.09, 'square', 0.1, uiGain), 70); },
  coin:   () => beep(1050, 1650, 0.07, 'square', 0.06),
  horn:   () => { beep(110, 108, 0.5, 'sawtooth', 0.2); beep(165, 162, 0.5, 'sawtooth', 0.14); },
  tick:   () => beep(1200, 1200, 0.05, 'square', 0.07),
  wind:   () => { [330, 440, 660].forEach((f, i) => setTimeout(() => beep(f, f * 1.4, 0.14, 'square', 0.12), i * 90)); },
  best:   () => { [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => beep(f, f, 0.1, 'square', 0.09, uiGain), i * 90)); },
};

// Music: the current lineup's setlist (see LINEUPS in js/lineups.js) with a procedural-metal
// fallback — chugging low E through a waveshaper, straight-8s kick, snare on
// 2 & 4. Custom tracks route through musicGain (mute works) and drive the
// headbang/light beat from their bpm (auto-detected + cached when omitted).
const Music = (() => {
  const BPM = 152, SIX = 60 / BPM / 4;
  const GAP = 6.5;   // seconds of between-song lull (the pit calms down)
  let step = 0, nextT = 0, timer = null, mode = 'menu';
  const norm = t => {
    if (typeof t === 'string') t = { src: t };
    return { src: t.src, bpm: t.bpm || null, title: t.title || decodeURIComponent(t.src.split('/').pop().replace(/\.[a-z0-9]+$/i, '')) };
  };
  let tracks = (window.PITS_TRACKS || lineupTracks(curLineup())).map(norm);
  let audioEl = null, trackIdx = -1, curBpm = 150, lastBeatIdx = -1, gapTimer = null;
  let bpmCache = {};
  try { bpmCache = JSON.parse(localStorage.getItem('pits_bpm') || '{}'); } catch (e) {}
  // rough tempo estimate: onset-energy autocorrelation over the rock range
  async function detectBpm(src) {
    const buf = await (await fetch(src)).arrayBuffer();
    const au = await ac.decodeAudioData(buf);
    const sr = au.sampleRate, data = au.getChannelData(0), hop = 512;
    const s0 = Math.floor(data.length * 0.25);
    const n = Math.min(Math.floor((data.length - s0) / hop) - 1, Math.floor(40 * sr / hop));
    if (n < 500) return 150;
    const env = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0; const off = s0 + i * hop;
      for (let j = 0; j < hop; j += 4) s += Math.abs(data[off + j]);
      env[i] = s;
    }
    const on = new Float32Array(n);
    for (let i = 1; i < n; i++) on[i] = Math.max(0, env[i] - env[i - 1]);
    const fr = sr / hop;
    let best = 150, bestScore = -1;
    for (let bpm = 88; bpm <= 190; bpm++) {
      const L = Math.round(fr * 60 / bpm);
      let sc = 0;
      for (let i = 0; i + L < n; i++) sc += on[i] * on[i + L];
      sc /= (n - L);
      if (sc > bestScore) { bestScore = sc; best = bpm; }
    }
    return best;
  }
  function playNext() {
    trackIdx = (trackIdx + 1) % tracks.length;
    const t = tracks[trackIdx];
    curBpm = t.bpm || bpmCache[t.src] || 150;
    if (!t.bpm && !bpmCache[t.src]) {
      detectBpm(t.src).then(b => {
        bpmCache[t.src] = b;
        try { localStorage.setItem('pits_bpm', JSON.stringify(bpmCache)); } catch (e) {}
        if (tracks[trackIdx] === t) curBpm = b;
        console.log('[music] detected', b, 'bpm for', t.title);
      }).catch(() => {});
    }
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.addEventListener('ended', () => {
        if (api.onEnd) api.onEnd();
        clearTimeout(gapTimer);
        gapTimer = setTimeout(playNext, GAP * 1000);
      });
      audioEl.addEventListener('error', () => {
        console.warn('[music] failed to load', audioEl.src, '— falling back to procedural');
        tracks = []; audioEl.remove(); audioEl = null;
      });
      try {
        const src = ac.createMediaElementSource(audioEl);
        src.connect(musicGain);
      } catch (e) {}
    }
    audioEl.src = t.src;
    lastBeatIdx = -1;
    audioEl.play().catch(() => {});
    if (api.onSong) api.onSong(t.title);
  }
  let dist = null, chugLp = null, chugBus = null;
  const CHUG = [2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 2, 1];   // 2 = open accent
  function ensureChain() {
    if (dist) return;
    dist = ac.createWaveShaper();
    const n = 512, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(3.5 * x); }
    dist.curve = curve;
    chugLp = ac.createBiquadFilter(); chugLp.type = 'lowpass'; chugLp.frequency.value = 900;
    chugBus = ac.createGain(); chugBus.gain.value = 0.5;
    dist.connect(chugLp); chugLp.connect(chugBus); chugBus.connect(musicGain);
  }
  function chug(t, open, freq) {
    ensureChain();
    const f = freq || 82.41;
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const o2 = ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f * 1.007;
    const sub = ac.createOscillator(); sub.type = 'sine'; sub.frequency.value = f / 2;
    const g = ac.createGain();
    const dur = open ? 0.34 : 0.09;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(open ? 0.5 : 0.34, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); o2.connect(g); sub.connect(g); g.connect(dist);
    [o, o2, sub].forEach(x => { x.start(t); x.stop(t + dur + 0.05); });
  }
  function kick(t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.15);
  }
  function noiseHit(t, dur, vol, freq, type) {
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    const src = ac.createBufferSource(); src.buffer = buf;
    const flt = ac.createBiquadFilter(); flt.type = type || 'highpass'; flt.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = vol;
    src.connect(flt); flt.connect(g); g.connect(musicGain);
    src.start(t);
  }
  function schedule(s, t) {
    const i = s % 16, bar = Math.floor(s / 16);
    const run = mode === 'run';
    if (i % 2 === 0) kick(t);
    if (i === 4 || i === 12) noiseHit(t, 0.16, run ? 0.5 : 0.3, 1400);
    noiseHit(t, 0.03, run ? 0.1 : 0.05, 6000);
    if (run) {
      const riff = bar % 4 === 3 ? 98.0 : 82.41;   // shift up on the 4th bar
      if (CHUG[i]) chug(t, CHUG[i] === 2, riff);
      if (i === 0 && bar % 4 === 0) { noiseHit(t, 0.7, 0.25, 4500); chug(t, true, 82.41); chug(t, true, 123.47); }
    }
    if (i === 0) { beatAt = performance.now() + (t - ac.currentTime) * 1000; }
  }
  const api = {
    onSong: null, onEnd: null,
    start() {
      if (timer || !ac) return;
      if (tracks.length) { trackIdx = Math.floor(Math.random() * tracks.length) - 1; playNext(); }
      nextT = ac.currentTime + 0.1;
      timer = setInterval(() => {
        if (!ac) return;
        if (tracks.length && audioEl) {
          // custom track: derive the beat clock from playback position + bpm
          if (!audioEl.paused) {
            const idx = Math.floor(audioEl.currentTime * curBpm / 60);
            if (idx !== lastBeatIdx) { lastBeatIdx = idx; beatAt = performance.now(); }
          }
          nextT = ac.currentTime + 0.1;   // park the procedural clock in case we fall back
          return;
        }
        while (nextT < ac.currentTime + 0.14) { schedule(step, nextT); nextT += SIX; step++; }
      }, 30);
    },
    setMode(m) { mode = m; musicModeFactor = m === 'run' ? 1 : 0.5; applyAudio(); },
    setTracks(list) {
      tracks = (list || []).map(norm);
      clearTimeout(gapTimer);
      if (audioEl) { audioEl.pause(); }
      trackIdx = -1;
      if (tracks.length && ac) playNext();
    },
    now() { return audioEl && !audioEl.paused ? { src: audioEl.src, t: audioEl.currentTime, bpm: curBpm } : null; },
  };
  return api;
})();
let beatAt = 0;   // performance.now() timestamp of the last downbeat (for lights/banging)
const beatPulse = () => Math.max(0, 1 - (performance.now() - beatAt) / 300);

$('muteBtn').textContent = AUDIO.muted ? '🔇' : '🔊';
$('muteBtn').addEventListener('click', e => {
  e.stopPropagation();
  AUDIO.muted = !AUDIO.muted; audioPersist();
  $('muteBtn').textContent = AUDIO.muted ? '🔇' : '🔊';
  applyAudio();
});
