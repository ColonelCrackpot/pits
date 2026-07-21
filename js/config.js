'use strict';
// ============================== config & tuning ==============================
// All the knobs in one place: world geometry, shop/ability definitions,
// leaderboard + ads endpoints, music playlist, style options.

// 2.5D world: floor plane (x, z), z=0 at the front edge, z=D at the stage.
const D = 620, HALFW = 400, CD = 760;

const UPG = [
  { id: 'fists', icon: '👊', name: 'Iron Fists',    desc: '+8 punch damage',              base: 40,  max: 6 },
  { id: 'fast',  icon: '🥁', name: 'Fast Hands',    desc: '+12% punch speed',             base: 55,  max: 6 },
  { id: 'skull', icon: '🪖', name: 'Thick Skull',   desc: '+25 max health',               base: 40,  max: 6 },
  { id: 'boots', icon: '🥾', name: 'Steel Toes',    desc: '+10% move speed',              base: 50,  max: 5 },
  { id: 'reach', icon: '💪', name: 'Windmill Arms', desc: '+15% punch reach & knockback', base: 60,  max: 5 },
  { id: 'pres',  icon: '🤘', name: 'Pit Presence',  desc: '+20% gold earned',             base: 80,  max: 4 },
  { id: 'wind',  icon: '⚡', name: 'Second Wind',   desc: 'Get back up once per set',     base: 150, max: 2 },
];

// You punch automatically; abilities are the buttons. Equip up to 4 — they map
// to SPACE / Q / E / R in loadout order (touch: the four round buttons).
const SLOT_CODES = ['Space', 'KeyQ', 'KeyE', 'KeyR'];
const SLOT_LABELS = ['SPACE', 'Q', 'E', 'R'];
const MAX_LOADOUT = 4;
const PUNCH_CD = 0.52;   // base seconds between auto-punches (Fast Hands shrinks it)

// Ability DEFINITIONS (cost/cooldown/duration curves). The behavior lives in
// js/abilities.js (ABILITY_IMPL) — add a new move by adding one entry to each.
const ABILITIES = [
  { id: 'kick', icon: '🦵', name: 'Big Boot',
    desc: 'Heavy kick — huge damage, sends them flying', unlock: 120, base: 150, max: 3,
    cd: l => 8 - l },
  { id: 'elbow', icon: '💢', name: 'Excessive Elbows',
    desc: 'A flurry of elbows for whoever is in front', unlock: 150, base: 160, max: 3,
    cd: l => 10 - l, dur: l => 1.1 + 0.2 * l },
  { id: 'cart', icon: '🤸', name: 'Hardcore Cartwheel',
    desc: 'Untouchable roll — through bodies, out of trouble', unlock: 180, base: 170, max: 3,
    cd: l => 9 - l, dur: () => 0.5 },
  { id: 'mower', icon: '🚜', name: 'The Lawnmower',
    desc: 'Rev up and mow a straight path through the pit', unlock: 200, base: 180, max: 3,
    cd: l => 16 - 1.5 * l, dur: () => 0.75 },
  { id: 'wind', icon: '🌀', name: 'Windmill',
    desc: 'Spin your arms, hit everyone around you', unlock: 250, base: 220, max: 3,
    cd: l => 22 - 2 * l, dur: l => 1.8 + 0.4 * l },
  { id: 'spin', icon: '🌪️', name: 'Spin Kick',
    desc: 'One full spin — boot everyone around you', unlock: 300, base: 240, max: 3,
    cd: l => 12 - l },
  { id: 'change', icon: '🪙', name: 'Throw Change',
    desc: 'Fling 5 gold in their faces — staggers the crowd', unlock: 100, base: 140, max: 3,
    cd: l => 6 - 0.5 * l },
  { id: 'berserk', icon: '😤', name: 'Berserk',
    desc: 'See red — hit harder, move faster, feel less', unlock: 400, base: 320, max: 3,
    cd: l => 55 - 5 * l, dur: l => 5 + l },
];

// NPC flavor moves — pit dancing between brawls (heavy rotation during lulls).
const FLAVORS = ['stirpot', 'twostep', 'possess', 'buttfire', 'demons'];

// leaderboard: same Supabase project as YPIM/JETT, its own locked table —
// writes only through the pits_submit_score RPC (one-time SQL in the README).
const SB = {
  url: 'https://ucoupqzhsfiefnjfqkmh.supabase.co',
  anon: 'sb_publishable_EOsD2Wd8EPUTmMqhcfBQRQ_Fl-O4UKF',
  table: 'pits_scores',
  rpc: 'pits_submit_score',
  maxSecs: 86400,   // MUST match max_secs in the SQL
};

// Same architecture as YPIM/JETT: one Ads API with a STUB backend.
// adsenseClient set = consent bar + AdSense script load (needed for review);
// flip live: true once AdSense/H5 Games Ads approves the site.
const ADS_CFG = {
  interstitialMinGap: 240,
  web: { adsenseClient: 'ca-pub-6716374157787378', sideBannerSlot: '', h5: true, live: false },
};

// Custom tracks (drop MP3s in music/ and list them here). bpm optional — the
// game detects it from the audio and caches it. Falls back to the procedural riff.
const PITS_TRACKS = window.PITS_TRACKS || [
  { src: 'music/Iron Maw.mp3', title: 'Iron Maw' },
  { src: 'music/Bone Hurting Juice.mp3', title: 'Bone Hurting Juice' },
  { src: 'music/Ashes of Iron.mp3', title: 'Ashes of Iron' },
  { src: 'music/Pit Sermon.mp3', title: 'Pit Sermon' },
];

const SKINS = ['#e8b48c', '#c98d63', '#8d5b3c', '#5f3d28', '#f0c9a8'];
const SHIRTS = ['#2a2230', '#241c26', '#33202a', '#1e2630', '#3a1424', '#2c2c34', '#402a18'];
const HAIRC = ['#171310', '#2b1d12', '#0d0d0f', '#4a2c14', '#666', '#8a1f1f'];

const STYLE_OPTS = [
  { k: 'skin', name: 'Skin', vals: SKINS, color: true },
  { k: 'shirt', name: 'Shirt', vals: ['#a3162a', '#181418', '#241a2e', '#0f2f24', '#1e2630', '#6b1010', '#e8e4da', '#3d1f52', '#5c4a12'], color: true },
  { k: 'pants', name: 'Jeans', vals: ['#333848', '#3a4260', '#4a3a34', '#1a1c22', '#5a2430'], color: true },
  { k: 'hairStyle', name: 'Hair', vals: ['long', 'mohawk', 'short', 'bald'] },
  { k: 'hair', name: 'Hair color', vals: ['#171310', '#2b1d12', '#4a2c14', '#666', '#8a1f1f', '#b8862e', '#2a5c8f', '#d94fb0'], color: true },
  { k: 'beard', name: 'Beard', vals: [false, true] },
];
