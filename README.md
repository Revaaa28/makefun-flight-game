[![Bounty: Make the best flight game](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/Revaaa28/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/Revaaa28/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard)

# Goldenhour Airmail

You are the evening mail pilot of Amber Valley, flying the cream-and-red Kestrel K-1 high-wing prop plane at golden hour — over a winding river and its stone bridge, terraced fields, a village, a camp, a lighthouse on the lake point and wind turbines turning on the ridge. Three sorties before dark: thread nine glowing rings down the valley, drop three mail bags onto their pads, then bring her home to Kestrel Field and land well enough to be proud of — scored on touchdown zone, sink rate and centreline. The flight model is honest about lift and stall, a gusting crosswind works the airframe and shows on the panel, the fuel burns faster at full throttle, and every sound is synthesized live with WebAudio. No assets, no network: the whole valley is procedural, and identical on every load.

## Controls

- **Shift / Ctrl** — throttle up / down
- **Arrow keys or WASD** — pitch and roll (Down / S pulls the nose up, like a yoke)
- **Mouse hold** — steer toward the pointer
- **F** — release a mail bag (Sortie 2)
- **Space** — brake on the runway, wheel brake on the ground
- **C** — swap between chase camera and the cockpit, with its lit 3D instrument panel
- **Enter** — start, brief, and advance through the screens

## Run it locally

```
node serve.ts
```

Then open `localhost:8080` in a desktop browser. Everything is static files under `game/`; `serve.ts` is only a convenience for local play.

## Layout

- `game/src/config.js` — world, flight tuning and colours
- `game/src/terrain.js` — the heightfield valley and everything standing in it
- `game/src/aircraft.js` — the Kestrel K-1 and its lift-and-stall flight model
- `game/src/wind.js` — the valley's gusting, veering crosswind
- `game/src/cockpit.js` — the 3D instrument panel: canvas-drawn gauges, throttle quadrant, yoke
- `game/src/missions.js` — the three sorties and all scoring
- `game/src/hud.js` — the canvas instrument overlay
- `game/src/camera.js` — chase and cockpit cameras
- `game/src/shots.js` — the `?shot=` composed scenes behind the screenshots
- `main.ts` — assembles the bounty entry (game + screenshots + dossier.json)
