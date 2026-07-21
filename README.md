# INTO THE PITS

Game-a-week #4: you're a metalhead at a metal show. Wade into the pit, swing at
whoever's closest, rack up CRED, survive the pit events. Human Fall Flat-style
wobbly ragdoll vibe in a fake-3D (2.5D) venue. (Working folder: `~/Desktop/PITS`.)

## Status: PROTOTYPE — not deployed, no GitHub repo yet

## Code structure

No build step — classic `<script>` tags sharing top-level scope, loaded in
order (each file may use anything ABOVE it at load time, anything at call time):

| file | owns |
|---|---|
| `js/util.js` | tiny helpers ($, rnd, clamp, fmtTime, shade…) |
| `js/config.js` | ALL tuning knobs: world geometry, upgrade/ability/style defs, Supabase + ads config, music playlist |
| `js/save.js` | localStorage save (`pits_save`), cost/level helpers, player id |
| `js/world.js` | canvas + 2.5D projection (proj, bound, screenToWorld) |
| `js/audio.js` | sfx, Music (custom MP3s w/ BPM autodetect + procedural fallback) |
| `js/ads.js` | stub Ads API (same architecture as YPIM/JETT) |
| `js/board.js` | leaderboard API + panel UI |
| `js/state.js` | shared mutable state (moshers, player, ev, calm…) |
| `js/moshers.js` | **MOSHER_TYPES registry** (bosses go here), body factory, player style, pStats |
| `js/combat.js` | swings, hit/KO, ragdoll verlet, combat FX |
| `js/abilities.js` | **ABILITY_IMPL registry** (new moves go here) + activation/cooldowns |
| `js/ai.js` | NPC decisions + steering modes |
| `js/sim.js` | per-frame update: bodies, arms/hair verlet, collisions, spawning |
| `js/events.js` | **EVENTS registry** (new pit events go here): wall/circle/diver/heal |
| `js/render.js` | stage, floor, crowd, bodies, HUD, banners |
| `js/input.js` | keyboard/mouse/touch, ability buttons |
| `js/flow.js` | startRun/gameOver/menu + song-lull hooks |
| `js/ui.js` | menu panel, shops, style picker |
| `js/main.js` | boot, main loop, `window.PITS` debug API |

### Adding content (each is ONE file):
- **New boss/mosher type** → entry in `MOSHER_TYPES` (js/moshers.js) with
  optional `init(m)` / `think(m)` / `draw(m, pr, s)` hooks, then
  `spawnNpc(true, 'yourType')`.
- **New ability** → def in `ABILITIES` (js/config.js) + entry in `ABILITY_IMPL`
  (js/abilities.js) with `use()` and optional `tick()`.
- **New pit event** → entry in `EVENTS` (js/events.js) with `weight`, `start`,
  `update`, optional `steer`/`drawFloor`/`drawWorld`.

## Features
- 2.5D venue: band + light rig on stage, barrier crowd, pit below. Procedural
  stick moshers with verlet arms/hair, full ragdoll on KO, headbang synced to beat.
- Combat: punch (auto-aim), bump physics; NPCs brawl each other (max 2 hunt the
  player) AND use kick/windmill moves themselves (~every 9-16s when engaged).
  Instant KO replacement (paused during walls); crowd ramps 12→26 over the set.
- Economy split: SCORE (100×combo per KO, +40 flow, event bonus ×10, +10/sec
  survived — the bragging number, bestScore saved) vs GOLD (flat 10/KO ×
  Pit Presence — buys upgrades). Combo never multiplies gold.
- Arena: spectator ring encloses the pit (stage barrier + side columns + front
  row backs); anyone drifting to an edge gets shoved back in — no hiding
  outside events. Player has a follow spotlight.
- Events: Wall of Death (even lines, 3x charge damage), Circle Pit (even slots,
  spiral inward, closes on the center at the end), Stage Diver (marked landing),
  Power Ballad (rare healing circle).
- Abilities: 🦵 Big Boot (E), 🌀 Windmill (Q), 😤 Berserk (R) — unlock + 3 levels.
- Meta: CRED → 6 upgrades + abilities; character style picker (free); best
  time/KOs; between-song crowd lulls + NOW PLAYING toasts.
- Music: MP3s in `music/` listed in `PITS_TRACKS` (config.js); BPM auto-detected
  and cached (`pits_bpm`); ducks in menus; procedural chug-riff fallback.
- Leaderboard "PIT LEGENDS": Supabase `pits_scores` via locked
  `pits_submit_score` RPC (LIVE — created 2026-07-20; SQL below for reference).
  Score = best survival seconds. Anon key is public by design.
- Debug: `window.PITS` — start/menu/over/event(type)/god/abilities(n)/use(id)/
  music(list)/nowPlaying/cred(n)/kill/state.

## Leaderboard SQL (already run — reference only)

```sql
create table public.pits_scores (
  player_id  text primary key,
  name       text not null default 'Anonymous',
  secs       double precision not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.pits_scores enable row level security;
create policy "public read" on public.pits_scores for select using (true);

create or replace function public.pits_submit_score(
  p_id text, p_name text, p_secs double precision
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  max_secs constant double precision := 86400;   -- MUST match SB.maxSecs
  clean_name text := left(coalesce(nullif(btrim(p_name), ''), 'Anonymous'), 16);
begin
  if p_id is null or length(p_id) < 8 or p_secs is null or not (p_secs >= 0 and p_secs <= max_secs) then
    return;
  end if;
  insert into public.pits_scores (player_id, name, secs, updated_at)
  values (p_id, clean_name, p_secs, now())
  on conflict (player_id) do update set
    name       = excluded.name,
    secs       = greatest(public.pits_scores.secs, excluded.secs),
    updated_at = now();
end;
$$;

grant execute on function public.pits_submit_score(text, text, double precision) to anon, authenticated;
```

## At launch (checklist)
- Set `adsenseClient` + `live: true` in ADS_CFG (js/config.js), add ads.txt
- guide.html / privacy.html / sitemap.xml / robots.txt (copy JETT's pattern)
- GitHub repo + Cloudflare Pages (push = deploy), custom domain
- Version + What's New popup (JETT pattern)

## Ideas not yet built
- Bosses: the Big Lad, the Windmiller, Crowd Killer (MOSHER_TYPES is ready)
- Crowd surfing (KO'd near the barrier → minigame instead of death)
- More events: spiral pit, braveheart standoff, gap in the wall
- Music-synced breakdowns (music intensity ↔ pit intensity)
- Cosmetics shop expansion (vests, tattoos — house wardrobe pattern)

## Dev
Serve the folder statically. Preview: `pits` launch config serves the scratchpad
mirror — re-copy changed files there after edits.
