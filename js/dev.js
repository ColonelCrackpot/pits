'use strict';
// ============================== dev panel ==============================
// Toggle with ` (backquote), or load the page with #dev appended to the URL.
// Everything here is also scriptable via window.PITS in the console.
(() => {
  let panel = null;
  function build() {
    panel = document.createElement('div');
    panel.id = 'devPanel';
    panel.style.cssText =
      'position:fixed;left:10px;top:64px;z-index:30;display:flex;flex-direction:column;gap:4px;' +
      'background:rgba(20,10,16,.88);border:1px solid #7a2230;border-radius:10px;padding:8px;max-height:80vh;overflow-y:auto;';
    const head = document.createElement('div');
    head.textContent = 'DEV';
    head.style.cssText = 'font:800 10px system-ui;color:#c99aa0;letter-spacing:2px;text-align:center;';
    panel.appendChild(head);
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'font:700 11px system-ui;color:#fff;background:#4a3b52;border:0;border-radius:6px;padding:5px 9px;cursor:pointer;text-align:left;';
      b.addEventListener('click', e => { e.stopPropagation(); fn(b); });
      panel.appendChild(b);
      return b;
    };
    mk('▶ start run', () => PITS.start());
    mk('💀 boss: Gene', () => spawnBoss('gene'));
    mk('💪 boss: Shawn', () => spawnBoss('shawn'));
    mk('🧱 wall of death', () => PITS.event('wall'));
    mk('🌀 circle pit', () => PITS.event('circle'));
    mk('🤸 stage diver', () => PITS.event('diver'));
    mk('💚 power ballad', () => PITS.event('heal'));
    mk('🎵 end song (lull)', () => { if (Music.onEnd) Music.onEnd(); });
    mk('🎵 next song', () => { if (Music.onSong) Music.onSong('Dev Track'); });
    mk('🛡 god: off', b => { god = !god; b.textContent = '🛡 god: ' + (god ? 'ON' : 'off'); });
    mk('🤘 +1000 gold', () => PITS.cred(1000));
    mk('⚡ max abilities', () => PITS.abilities());
    mk('💪 full heal', () => { if (player) player.hp = player.maxhp; });
    mk('☠ kill player', () => PITS.kill());
    document.body.appendChild(panel);
  }
  function toggle() {
    if (!panel) build();
    else panel.style.display = panel.style.display === 'none' ? '' : 'none';
  }
  window.addEventListener('keydown', e => {
    if (e.code === 'Backquote' && !(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) toggle();
  });
  if (location.hash.includes('dev') || location.search.includes('dev')) toggle();
  window.PITS_DEV = toggle;
})();
