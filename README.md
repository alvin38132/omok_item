# Rainbow Omok

Multiplayer Omok (Gomoku) on a 19 x 19 board, with one-shot power-up items.
Rewritten from vanilla JS to **React + Vite**.

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## How to play

- 2-12 players take turns placing stones. First to connect **five** in any
  direction wins.
- Click to place, **drag** to pan the board, and **scroll** to zoom. Arrow keys
  + Enter/Space work too.
- Optional **50/50 mode**: every valid placement has a 50% chance to fail.
- Each player may use **each item once per game**.

### Items

| Item | Effect |
| --- | --- |
| Knight's Move | Place two stones in a knight's-move shape. |
| Big Knight's Move | Place two stones in a large knight's-move shape. |
| Area Blast | Delete one of your stones and the 8 cells around it. |
| Stone Steal | 30% chance to convert an opponent's stone to yours. |
| Time Stone | Roll a die to fail or rewind 1-3 turns. |
| Hit Stone | Launch a stone orthogonally, sliding and knocking stones until one exits. |

## Project structure

```text
src/
├── main.jsx              # React entry point
├── App.jsx               # Top-level composition
├── game/                 # Pure game logic (no React, no DOM)
│   ├── constants.js      # Board size and player colors
│   ├── colors.js         # Player color helpers
│   ├── random.js         # Secure randomness
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
    └── ItemsPanel.jsx  PlayerList.jsx  TurnCard.jsx  Stats.jsx  Stone.jsx
```

### Design notes

- **The reducer is pure.** Randomness for 50/50 placement rolls, steal odds,
  and Time Stone is generated in `useGameEngine` and passed into actions as
  data, so the reducer stays deterministic and StrictMode-safe.
- **Camera and hover live in refs** inside `Board`, so panning and hovering
  repaint the canvas imperatively without re-rendering React.
