# Bands

**One folder per band. Everything they give us goes in it.**

```
bands/
  into-the-pits/          ← the house band
    banner.png              backdrop hung behind them on stage
    Iron Maw.mp3            their songs, named however they name them
    Bone Hurting Juice.mp3
    Ashes of Iron.mp3
    Pit Sermon.mp3
  some-real-band/         ← drop a new band in exactly like this
    banner.png
    Track One.mp3
    Track Two.mp3
```

Nothing else in the project needs to know where these files live — the folder is
declared once, in the band's `LINEUPS` entry in `js/lineups.js`:

```js
{
  id: 'srb',
  band: 'SOME REAL BAND',
  dir: 'bands/some-real-band/',   // ← everything below is relative to this
  banner: 'banner.png',
  tracks: [
    { src: 'Track One.mp3', title: 'Track One' },
    { src: 'Track Two.mp3', title: 'Track Two' },
  ],
  members: [ /* five people — see the house band for the shape */ ],
}
```

## What to ask a band for

**Songs** — MP3. Any number; the game shuffles through them and drops into a
between-song lull at the end of each one. No BPM needed: the game detects tempo
from the audio itself (and caches it), and that tempo drives the crowd's
headbanging, the stage strobes and the light rig. Pass `bpm: 168` in the track
entry only if you want to override the detection.

**Banner** — PNG, landscape, 1200 px wide or larger. It's the backdrop hanging
behind them on stage. Anything from about 3:2 to 3:1 works; it's fitted inside
the banner slot with its aspect ratio preserved, so it's never stretched or
cropped — wider art simply fills more of the slot. A transparent background lets
the venue's wall colour show through (the wall changes as the player climbs
venues); artwork with its own background reads as a printed banner, which is
just as good.

**Look** (optional but encouraged) — skin, shirt, jeans and hair colour plus a
hairstyle for each of their five members, so the on-stage characters resemble
the actual band. Anything not specified falls back to a fixed default; a band's
appearance never randomizes between loads.

A band with no banner still works — their name goes up on a cloth banner
instead, so they're playable the moment their songs land.

## Current bands

| Folder | Band | Banner | Songs |
|---|---|---|---|
| `into-the-pits/` | INTO THE PITS (house band) | `banner.png` (1536 × 1024) | 4 |
