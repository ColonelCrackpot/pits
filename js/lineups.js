'use strict';
// ============================== lineups ==============================
// WHO is playing tonight. A lineup bundles a BAND (name + five members with
// fixed styles), its ARTWORK and its SETLIST.
//
// Every band owns ONE folder under bands/ holding all of their assets:
//
//   bands/into-the-pits/
//     banner.png            ← backdrop behind them on stage
//     Iron Maw.mp3          ← their songs, whatever they're called
//     Pit Sermon.mp3
//
// so onboarding a real band is: drop their folder in, add an entry below.
// `dir` is prefixed to `banner` and every track src — paths are declared once.
//
//   role:   'lead' | 'bass' | 'drums' | 'keys' | 'vox'  (what they play)
//   x:      stage position, 0 = far left … 1 = far right
//   y:      how far downstage they stand, 0 = platform back edge … 1 = front lip
//   sc:     body scale (front-of-stage members read bigger)
//   style:  { skin, shirt, pants, hair, hairstyle } — SPELL IT OUT. A band's
//           look is part of its identity; anything omitted gets randomized,
//           which means a different face every page load.
//   dir:    the band's asset folder, e.g. 'bands/into-the-pits/'
//   banner: PNG filename inside dir (see bands/README.md). Missing or still
//           loading → their name is drawn on a cloth backdrop instead.
//   tracks: { src (filename inside dir), title, bpm? } — bpm auto-detects
const LINEUPS = [
  {
    id: 'itp',
    band: 'INTO THE PITS',
    dir: 'bands/into-the-pits/',
    banner: 'banner.png',
    tracks: [
      { src: 'Iron Maw.mp3', title: 'Iron Maw' },
      { src: 'Bone Hurting Juice.mp3', title: 'Bone Hurting Juice' },
      { src: 'Ashes of Iron.mp3', title: 'Ashes of Iron' },
      { src: 'Pit Sermon.mp3', title: 'Pit Sermon' },
    ],
    // fixed faces — this is the band, every night, same five people
    members: [
      { role: 'lead', x: 0.18, y: 0.16, sc: 1.0,
        style: { skin: '#e8b48c', shirt: '#181418', pants: '#333848', hair: '#171310', hairstyle: 'long' } },
      { role: 'drums', x: 0.37, y: 0.04, sc: 0.9,
        style: { skin: '#c98d63', shirt: '#6b1010', pants: '#1a1c22', hair: '#171310', hairstyle: 'short' } },
      { role: 'vox', x: 0.50, y: 0.40, sc: 1.15,
        style: { skin: '#f0c9a8', shirt: '#141216', pants: '#1a1c22', hair: '#0d0d0f', hairstyle: 'long' } },
      { role: 'keys', x: 0.65, y: 0.16, sc: 0.92,
        style: { skin: '#8d5b3c', shirt: '#241a2e', pants: '#333848', hair: '#171310', hairstyle: 'mohawk' } },
      { role: 'bass', x: 0.81, y: 0.20, sc: 1.0,
        style: { skin: '#e8b48c', shirt: '#3d1f52', pants: '#3a4260', hair: '#4a2c14', hairstyle: 'long' } },
    ],
  },
];
const curLineup = () => LINEUPS[(save.lineup || 0) % LINEUPS.length];
// asset paths, resolved against the band's own folder
const lineupTracks = lu => (lu.tracks || []).map(t => Object.assign({}, t, { src: (lu.dir || '') + t.src }));
const lineupBanner = lu => lu.banner ? (lu.dir || '') + lu.banner : null;

// resolve tonight's five bodies: lineup styles first, dice for the rest
let BAND = null;   // built lazily on first stage draw; null it to re-roll
// Styles come from the lineup. The fallbacks below only fire for a member with
// no style at all — headbang phase is index-derived, never random, so a band
// looks and moves identically every single load.
function buildBand() {
  return curLineup().members.map((mm, i) => Object.assign({
    role: mm.role,
    x: mm.x != null ? mm.x : 0.5,
    y: mm.y != null ? mm.y : 0.3,
    sc: mm.sc || 1,
    phase: i * 1.27,
    skin: SKINS[i % SKINS.length],
    shirt: SHIRTS[i % SHIRTS.length],
    pants: '#333848',
    hair: HAIRC[i % HAIRC.length],
    hairstyle: mm.role === 'vox' ? 'long' : 'short',
  }, mm.style || {}));
}
