'use strict';
// ============================== save ==============================
const SAVE_KEY = 'pits_save';
let save = { cred: 0, up: {}, bestTime: 0, bestKos: 0, bestScore: 0, muted: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
save.style = Object.assign(
  { skin: '#e8b48c', shirt: '#a3162a', pants: '#333848', hairStyle: 'long', hair: '#171310', beard: false },
  save.style || {});
const AB_ZERO = {};
for (const a of ABILITIES) AB_ZERO[a.id] = 0;
save.ab = Object.assign(AB_ZERO, save.ab || {});
// loadout: up to MAX_LOADOUT equipped ability ids, in slot order (SPACE/Q/E/R).
// The player's choice is law: this only drops invalid/locked entries — it
// NEVER auto-fills empty slots (only a brand-new unlock self-equips, in ui.js).
function ensureLoadout() {
  const migrate = !save.loadout;   // pre-loadout saves: equip what's unlocked, once
  save.loadout = (save.loadout || []).filter(id => (save.ab[id] || 0) > 0).slice(0, MAX_LOADOUT);
  if (migrate) {
    for (const a of ABILITIES) {
      if (save.loadout.length >= MAX_LOADOUT) break;
      if ((save.ab[a.id] || 0) > 0) save.loadout.push(a.id);
    }
  }
}
ensureLoadout();
// stable anonymous player id for the leaderboard
if (!save.pid) {
  try { save.pid = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join(''); }
  catch (e) { save.pid = 'p' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8); }
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

const lvl = id => save.up[id] || 0;
const upgCost = u => Math.round(u.base * Math.pow(1.65, lvl(u.id)));
const abLvl = id => save.ab[id] || 0;
const abCost = a => abLvl(a.id) === 0 ? a.unlock : Math.round(a.base * Math.pow(1.7, abLvl(a.id) - 1));
