# Rainbow Omok

Multiplayer Omok (Gomoku) on a 100 × 100 board, with one-shot power-up items.
Rewritten from vanilla JS to **React + Vite**.

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## How to play

- 2–12 players take turns placing stones. First to connect **five** in any
  direction wins.
- Click to place, **drag** to pan the board, and **scroll** to zoom. Arrow keys
  + Enter/Space work too.
- Optional **50–50 mode**: every valid placement has a 50% chance to fail.
- Each player may use **each item once per game** (see below).

### Items

| Item | Effect |
| --- | --- |
| Line Clear | Clear an entire row, column, or diagonal through a chosen stone. |
| Knight's Move (날일자) | Place two stones in a knight's-move shape. |
| Big Knight's Move (눈목자) | Place two stones in a large knight's-move shape. |
| Wildcard Stone | Place a shared ★ stone that counts for any player. |
| Area Blast | Delete one of your stones and the 8 cells around it. |
| Random Flip | Instantly reassign ownership of 30% of all stones. |
| Stone Steal | 30% chance to convert an opponent's stone to yours. |

## Project structure

```
src/
├── main.jsx              # React entry point
├── App.jsx               # Top-level composition
├── game/                 # Pure game logic (no React, no DOM)
│   ├── constants.js      # Board size, colors, shared-stone id
│   ├── colors.js         # Player color helpers
│   ├── random.js         # Secure randomness (all impurity lives here)
│   ├── logic.js          # Board utils + win detection
│   ├── items.js          # Item catalog + move-shape offsets
│   ├── reducer.js        # Pure state machine for every game action
│   └── renderer.js       # Canvas drawing + camera math
├── hooks/
│   └── useGameEngine.js  # Binds the reducer to React; rolls randomness
└── components/           # Presentational + interactive UI
    ├── Board.jsx         # Canvas: pan / zoom / hover / click / keyboard
    ├── Sidebar.jsx       # Turn card, status, players, items, stats
    ├── SetupDialog.jsx   # New-game modal
    ├── LineClearModal.jsx
    ├── ItemsPanel.jsx  PlayerList.jsx  TurnCard.jsx  Stats.jsx  Stone.jsx
```

### Design notes

- **The reducer is pure.** Randomness (50–50 rolls, steal odds, random flip) is
  generated in `useGameEngine` and passed into actions as data, so the reducer
  stays deterministic and StrictMode-safe.
- **Camera and hover live in refs** inside `Board`, so panning and hovering
  repaint the canvas imperatively without re-rendering React.
