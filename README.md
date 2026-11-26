# DEAD STICK

**The captain is down. Land her yourself.**

A 3D cockpit survival flight game for desktop browsers. You are a
passenger in the right seat of Meridian Air flight 207, a Kestrel K-200
twinjet descending into Port Alba, when the captain passes out at
9,800 ft. The autopilot lets go. What breaks next is yours to fix —
from the seat, with the mouse, on the real controls:

- **Engine fire** — pull the red ENG 1 fire handle, wait for the
  extinguisher, restart the engine while smoke trails past the window
- **Electrical failure** — look up: reset the tripped breakers on the
  overhead panel before the instruments die to red emergency power
- **Hydraulic loss** — she rolls hard right; hold her level with the
  yoke until the system steadies
- **Cabin pressure** — drop the oxygen masks, open the crossfeed valve

Survive the chain and the last job is the hardest: fly a powered
descent profile down to runway 27 and touch down inside the envelope —
gear down, 105–165 kt, wings level, on the centreline. Every unfixed
emergency burns hull integrity by the second.

*Dead-stick*: the aviator's word for landing a plane whose engines
have quit. Also what the captain is, and what the yoke feels like
in your hands.

## Play

Open `game/index.html` in a desktop browser — or serve the folder:

```sh
node serve.ts   # then http://localhost:8080
```

Fully offline: Three.js is vendored under `game/vendor/`, the world,
cockpit and every sound are procedural (Web Audio synthesis), and no
file in the game ever makes a network request.

**The full experience**

- **Menu** — New Game, Continue (a flight in progress is autosaved),
  How to Play, and Exit, over the live cockpit.
- **Cutscene** — every New Game opens on the flight deck in the last
  calm minute: the radio call, the captain's hand on his chest, the
  slump over the yoke. Skippable.
- **Terrain** — a procedural heightmap coastline: rolling patchwork
  hills, a cratered volcano with a smoke column, a lighthouse island,
  and the graded-flat airfield at Port Alba.
- **Progress card** — distance to runway 27, above/below the descent
  profile, ETA, and the **sim gears** (×1/×2/×4). Linger at ×4 and
  turbulence arrives as a fifth emergency: drop back to ×1 and ride
  it out.
- **Music** — a synthesised pad score that follows the story: calm
  chords in cruise, darker harmony while a system burns.
- **End screens** — landing or wreck, you choose: fly again, back to
  the menu, or exit.

**Controls**

| Input | Action |
| --- | --- |
| Drag mouse | Look around the cockpit |
| Click a control | Use it (fire handle, breakers, levers…) |
| A / D or ← / → | Bank left / right |
| W / S or ↑ / ↓ | Pitch (trade speed against glide angle) |
| R / F | Throttle up / down |
| SPACE | Speedbrakes (steepen the descent) |
| G | Landing gear |
| C | Tail camera |
| − / = | Sim gear down / up (×1, ×2, ×4) |
| P or Esc | Pause |
| M | Mute |

## Layout

- `main.ts` — hands the entry in: copies `game/` and `screenshots/`
  to the output folder and writes the dossier with the vendored
  make.fun library (`vendor/makefun-game.ts`, unchanged from the kit)
- `game/src/main.js` — the flight model, the emergency chain, the landing
- `game/src/render.js` — the cockpit: live canvas-texture instruments
  (attitude, ALT / SPD / HDG), every clickable control, the captain
- `game/src/world.js` — Port Alba and its coast: sea, island lighthouse,
  volcano, patchwork fields, the lit city, runway 27, the aircraft
- `game/src/audio.js` — all sound, synthesised: engine rumble, warning
  chimes, fire bell, the touchdown thump
- `game/src/input.js`, `config.js`, `random.js`, `shots.js` — desktop
  input, tuning, the seeded crisis deal, the screenshot scenes
  (`?shot=start|fire|approach|tail`)

## License

MIT — see `LICENSE`.
