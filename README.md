# Ferrogger

Frogger, but you are the ferry. Cross the East River through kayaks, water taxis, tugs pushing barges, tour boats, jet skis and the Staten Island Ferry, ride out the current, and dock at all five landings.

Each level is themed on a real NYC Ferry route (East River, South Brooklyn, Astoria, St. George, Rockaway-Soundview). Its slips are real landings on that route, and its color comes from the route. Your boats are named after real vessels in the fleet. The art is original; this is a fan project and is not affiliated with NYC Ferry.

## Play

```sh
npm run serve
```

Then open http://127.0.0.1:5173/. Set `PORT` or `HOST` to change where it listens.

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrow keys or WASD | Swipe |
| Forward | Up or W | Tap |
| Pause | P or Escape | Pause button |
| Sound | M | Sound button (muted by default) |

### Rules

- **Lanes:** the lower river is plain traffic. The upper river adds a tidal current that drifts you sideways, and its direction flips every level.
- **Losing a boat:** you lose one if you hit traffic, get swept off either edge, hit the bulkhead, dock in a filled slip or one with a seagull, or run out of time.
- **Clearing a level:** fill all five slips. Traffic speeds up each level.
- **Points:**

  | Event | Points |
  | --- | --- |
  | Each new row reached | 10 |
  | Docking | 50, plus 5 per second left |
  | Waiting passengers | 200 |
  | Clearing a level | 1000 |

## Develop

Plain ES modules with no build step and no runtime dependencies.

| Path | Contents |
| --- | --- |
| `src/game.js` | The whole game as a pure, seeded simulation: `step(state, dtMs, inputs)` returns a new state |
| `src/levels.js` | Lane layouts and difficulty |
| `src/data.js` | Routes, landings and vessel names |
| `src/render.js` | Canvas drawing |
| `src/input.js` | Input |
| `src/audio.js` | Synthesized sound |
| `src/main.js` | Wires everything to the page |

Debug URL parameters:

- `?seed=N` fixes the random seed.
- `?debug` exposes `window.__ferrogger` with `state`, `paused`, `highScore` and `mutate(fn)`.
- `?debug&calm` empties the river, which is useful for testing movement and docking.

## Test

```sh
npm test               # unit tests for the simulation (node --test)
npx playwright test    # E2E on desktop Chrome and iPhone 13 WebKit
```

E2E screenshots are saved under `test-results/`, and the HTML report is in `playwright-report/`. First-time setup needs `npx playwright install chromium webkit`.
