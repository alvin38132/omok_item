// The single source of truth for game state transitions.
//
// This reducer is PURE: every action carries all the data it needs (including
// pre-rolled randomness), so it never touches the DOM, `crypto`, or `Date`.
// That makes it safe under React StrictMode and easy to reason about.

import { SHARED_STONE, SIZE } from './constants.js';
import { ITEMS_BY_ID } from './items.js';
import {
  createBoard,
  cloneBoard,
  clampCount,
  nextPlayer,
  inBounds,
  isBoardFull,
  findWinningLine,
  findAnyWin,
} from './logic.js';

export const initialState = {
  board: createBoard(),
  playerCount: 2,
  currentPlayer: 1,
  history: [], // [{ x, y, player, success }]
  gameOver: false,
  winningCells: [],
  fiftyFifty: false,
  gameStarted: false,
  status: { message: 'Choose your game settings to begin.', kind: '' },
  failedFlash: null, // { x, y } | null
  // Items
  inventories: {}, // { [player]: { [itemId]: available } }
  activeItem: null, // itemId currently being targeted
  itemState: {}, // staging for multi-step items, e.g. { firstCell }
  lineClearCell: null, // { x, y } when the Line Clear direction modal is open
  session: 0, // bumped on each new game (used to reset the camera)
};

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

function status(message, kind = '') {
  return { message, kind };
}

function buildInventories(playerCount) {
  const inventories = {};
  for (let p = 1; p <= playerCount; p++) {
    inventories[p] = {};
    for (const id of Object.keys(ITEMS_BY_ID)) inventories[p][id] = true;
  }
  return inventories;
}

function consume(inventories, player, itemId) {
  return {
    ...inventories,
    [player]: { ...inventories[player], [itemId]: false },
  };
}

// Reset item targeting fields to idle.
const IDLE_ITEM = { activeItem: null, itemState: {}, lineClearCell: null };

// Evaluate the outcome after one or more stones were placed for `player` on
// `board`. Returns the state fields describing win / draw / continue.
function resolveOutcome(state, board, placements, player, winMessage) {
  for (const { x, y } of placements) {
    const line = findWinningLine(board, x, y, player);
    if (line) {
      return {
        board,
        gameOver: true,
        winningCells: line,
        status: status(winMessage(player), 'win'),
        ...IDLE_ITEM,
      };
    }
  }
  if (isBoardFull(board)) {
    return {
      board,
      gameOver: true,
      winningCells: [],
      status: status('The board is full. The game is a draw.'),
      ...IDLE_ITEM,
    };
  }
  const next = nextPlayer(player, state.playerCount);
  return {
    board,
    gameOver: false,
    currentPlayer: next,
    status: status(`Player ${player} placed a stone. Player ${next} is next.`),
    ...IDLE_ITEM,
  };
}

// End the current player's turn after an item was used. Optionally keep a
// custom status message instead of the default "next player" prompt.
function endTurn(state, board, customStatus) {
  const next = nextPlayer(state.currentPlayer, state.playerCount);
  return {
    ...state,
    board,
    currentPlayer: next,
    status: customStatus || status(`Player ${next}'s turn.`),
    ...IDLE_ITEM,
  };
}

const defaultWin = (player) => `Player ${player} connects five and wins!`;

// ---------------------------------------------------------------------------
// Item click handlers (one per targeting item)
// ---------------------------------------------------------------------------

function handleKnightMove(state, cell, itemId, offsetTest, shapeName) {
  const { board, currentPlayer: player } = state;

  if (!state.itemState.firstCell) {
    if (board[cell.y][cell.x]) {
      return {
        ...state,
        status: status(
          'Intersection occupied. Choose an empty cell for the first stone.',
          'error',
        ),
      };
    }
    return {
      ...state,
      itemState: { firstCell: cell },
      status: status(
        `First stone selected at (${cell.x}, ${cell.y}). Choose the second stone in a ${shapeName} shape.`,
      ),
    };
  }

  const first = state.itemState.firstCell;
  const dx = Math.abs(cell.x - first.x);
  const dy = Math.abs(cell.y - first.y);

  if (!offsetTest(dx, dy)) {
    return {
      ...state,
      ...IDLE_ITEM,
      status: status(
        `Invalid selection. Second stone must be in a ${shapeName} shape. Action cancelled.`,
      ),
    };
  }
  if (board[cell.y][cell.x]) {
    return {
      ...state,
      ...IDLE_ITEM,
      status: status('Occupied cell. Action cancelled.', 'error'),
    };
  }

  const next = cloneBoard(board);
  next[first.y][first.x] = player;
  next[cell.y][cell.x] = player;

  const history = [
    ...state.history,
    { x: first.x, y: first.y, player, success: true },
    { x: cell.x, y: cell.y, player, success: true },
  ];
  const inventories = consume(state.inventories, player, itemId);

  const outcome = resolveOutcome(state, next, [first, cell], player, defaultWin);
  return { ...state, history, inventories, ...outcome };
}

function handleSharedStone(state, cell) {
  const { board, currentPlayer: player } = state;
  if (board[cell.y][cell.x]) {
    return { ...state, status: status('Intersection occupied.', 'error') };
  }

  const next = cloneBoard(board);
  next[cell.y][cell.x] = SHARED_STONE;

  const history = [...state.history, { x: cell.x, y: cell.y, player, success: true }];
  const inventories = consume(state.inventories, player, 'shared_stone');

  const outcome = resolveOutcome(
    state,
    next,
    [cell],
    player,
    (p) => `Player ${p} connects five and wins via Wildcard!`,
  );
  return { ...state, history, inventories, ...outcome };
}

function handleAreaBlast(state, cell) {
  const { board, currentPlayer: player } = state;
  if (board[cell.y][cell.x] !== player) {
    return {
      ...state,
      status: status('Must select one of your own stones.', 'error'),
    };
  }

  const next = cloneBoard(board);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cell.x + dx;
      const ny = cell.y + dy;
      if (inBounds(nx, ny)) next[ny][nx] = 0;
    }
  }

  const inventories = consume(state.inventories, player, 'area_blast');
  return endTurn({ ...state, inventories }, next);
}

function handleStealStone(state, cell, success) {
  const { board, currentPlayer: player } = state;
  const owner = board[cell.y][cell.x];
  if (!owner || owner === player || owner === SHARED_STONE) {
    return {
      ...state,
      status: status("Must select an opponent's regular stone.", 'error'),
    };
  }

  const inventories = consume(state.inventories, player, 'steal_stone');

  if (!success) {
    return endTurn(
      { ...state, inventories },
      board,
      status(`Conversion failed for opponent stone at (${cell.x}, ${cell.y}).`, 'error'),
    );
  }

  const next = cloneBoard(board);
  next[cell.y][cell.x] = player;

  const line = findWinningLine(next, cell.x, cell.y, player);
  if (line) {
    return {
      ...state,
      inventories,
      board: next,
      gameOver: true,
      winningCells: line,
      status: status(defaultWin(player), 'win'),
      ...IDLE_ITEM,
    };
  }
  return endTurn(
    { ...state, inventories },
    next,
    status(`Success! Converted opponent stone at (${cell.x}, ${cell.y}) to your color.`),
  );
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function gameReducer(state, action) {
  switch (action.type) {
    case 'START_GAME': {
      const playerCount = clampCount(action.playerCount);
      return {
        ...initialState,
        playerCount,
        fiftyFifty: action.fiftyFifty,
        gameStarted: true,
        inventories: buildInventories(playerCount),
        session: state.session + 1,
        status: status(
          `Player 1 begins. ${
            action.fiftyFifty
              ? 'Every valid attempt is a 50–50 roll.'
              : 'Choose any empty intersection.'
          }`,
        ),
      };
    }

    case 'CLEAR_FLASH':
      return state.failedFlash ? { ...state, failedFlash: null } : state;

    // A normal stone placement. `success` is pre-rolled by the caller
    // (always true unless 50–50 mode is on).
    case 'PLACE': {
      const { cell, success } = action;
      if (!state.gameStarted || state.gameOver || !cell) return state;
      if (state.board[cell.y][cell.x]) {
        return {
          ...state,
          status: status('That intersection is occupied. Choose another one.', 'error'),
        };
      }

      const player = state.currentPlayer;
      const history = [...state.history, { x: cell.x, y: cell.y, player, success }];

      if (success) {
        const next = cloneBoard(state.board);
        next[cell.y][cell.x] = player;
        const outcome = resolveOutcome(state, next, [cell], player, defaultWin);
        return { ...state, history, failedFlash: null, ...outcome };
      }

      const nextP = nextPlayer(player, state.playerCount);
      return {
        ...state,
        history,
        failedFlash: cell,
        currentPlayer: nextP,
        status: status(
          `Player ${player}'s stone failed to appear. Player ${nextP} is next.`,
          'error',
        ),
      };
    }

    case 'ACTIVATE_ITEM': {
      const item = ITEMS_BY_ID[action.itemId];
      if (!item || state.gameOver || !state.gameStarted) return state;
      if (!state.inventories[state.currentPlayer]?.[action.itemId]) return state;

      // Toggling the active item off.
      if (state.activeItem === action.itemId) {
        return {
          ...state,
          ...IDLE_ITEM,
          status: status(
            `Player ${state.currentPlayer}'s turn. Choose any empty intersection.`,
          ),
        };
      }

      return {
        ...state,
        activeItem: action.itemId,
        itemState: {},
        lineClearCell: null,
        status: status(
          `[ITEM ACTIVE] ${item.desc} (Click the item again to cancel)`,
        ),
      };
    }

    case 'CANCEL_ITEM':
      if (!state.activeItem && !state.lineClearCell) return state;
      return {
        ...state,
        ...IDLE_ITEM,
        status: status(
          `Player ${state.currentPlayer}'s turn. Choose any empty intersection.`,
        ),
      };

    // A board click while an item is being targeted. `roll` carries any
    // pre-computed randomness the item needs (e.g. steal success).
    case 'ITEM_CLICK': {
      const { cell, roll } = action;
      if (!cell || state.gameOver || !state.gameStarted || !state.activeItem) {
        return state;
      }

      switch (state.activeItem) {
        case 'line_clear':
          if (!state.board[cell.y][cell.x]) {
            return {
              ...state,
              status: status('Must select an intersection with a stone to clear.', 'error'),
            };
          }
          return { ...state, lineClearCell: cell };

        case 'knight_move':
          return handleKnightMove(
            state,
            cell,
            'knight_move',
            (dx, dy) => (dx === 1 && dy === 2) || (dx === 2 && dy === 1),
            "Knight's move (날일자)",
          );

        case 'big_knight_move':
          return handleKnightMove(
            state,
            cell,
            'big_knight_move',
            (dx, dy) => (dx === 1 && dy === 3) || (dx === 3 && dy === 1),
            "Big Knight's move (눈목자)",
          );

        case 'shared_stone':
          return handleSharedStone(state, cell);

        case 'area_blast':
          return handleAreaBlast(state, cell);

        case 'steal_stone':
          return handleStealStone(state, cell, roll?.success ?? false);

        default:
          return state;
      }
    }

    // Apply the chosen Line Clear direction through the staged cell.
    case 'LINE_CLEAR_DIRECTION': {
      const cell = state.lineClearCell;
      if (!cell) return state;

      const next = cloneBoard(state.board);
      const clear = (x, y) => {
        if (inBounds(x, y)) next[y][x] = 0;
      };

      switch (action.direction) {
        case 'horizontal':
          for (let x = 0; x < SIZE; x++) clear(x, cell.y);
          break;
        case 'vertical':
          for (let y = 0; y < SIZE; y++) clear(cell.x, y);
          break;
        case 'diag_down': {
          const k = cell.y - cell.x;
          for (let x = 0; x < SIZE; x++) clear(x, x + k);
          break;
        }
        case 'diag_up': {
          const k = cell.y + cell.x;
          for (let x = 0; x < SIZE; x++) clear(x, k - x);
          break;
        }
        default:
          return state;
      }

      const inventories = consume(state.inventories, state.currentPlayer, 'line_clear');
      return endTurn({ ...state, inventories }, next);
    }

    // Random Flip. `flips` is a pre-computed list of { x, y, owner } produced
    // by the caller (which owns the randomness).
    case 'RANDOM_FLIP': {
      const { flips } = action;
      if (!flips || flips.length === 0) {
        return {
          ...state,
          status: status('No active stones on the board to flip.', 'error'),
        };
      }

      const next = cloneBoard(state.board);
      for (const { x, y, owner } of flips) next[y][x] = owner;

      const inventories = consume(state.inventories, state.currentPlayer, 'random_flip');
      const win = findAnyWin(next);

      if (win) {
        return {
          ...state,
          inventories,
          board: next,
          gameOver: true,
          winningCells: win.line,
          status: status(
            `Flipping complete. Player ${win.player} connects five and wins!`,
            'win',
          ),
          ...IDLE_ITEM,
        };
      }
      return endTurn(
        { ...state, inventories },
        next,
        status(`Flipped ownership of ${flips.length} stones randomly across the board.`),
      );
    }

    default:
      return state;
  }
}
