# Custom music

Drop MP3s (e.g. Suno exports) in this folder, then list them in `index.html`
in the `MOSH_TRACKS` array near the top of the script:

```js
const MOSH_TRACKS = window.MOSH_TRACKS || [
  { src: 'music/pit-anthem.mp3', bpm: 152 },
  { src: 'music/wall-riff.mp3',  bpm: 168 },
];
```

- `bpm` drives the headbanging, stage strobe, and light pulse — match it to the
  track (Suno shows BPM, or count it out). Defaults to 150 if omitted.
- Tracks shuffle-start and loop through the list; they route through the game's
  mute button and duck to 50% volume in menus.
- If a file fails to load, the game falls back to the built-in procedural riff.
- Test in the console: `MOSH.music([{src:'music/test.mp3',bpm:160}])`,
  `MOSH.nowPlaying()`.
