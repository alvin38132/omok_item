// The single source of truth for game state transitions.
//
// This reducer is PURE: every action carries all the data it needs (including
// pre-rolled randomness), so it never touches the DOM, `crypto`, or `Date`.
// That makes it safe under React StrictMode and easy to reason about.

import { ITEMS_BY_ID } from './items.js';
import {
  createBoard,
  cloneBoard,
  clampCount,
  nextPlayer,
  inBounds,
  isBoardFull,
  findWinningLine,
} from './logic.js';
import { directionFromCells } from './hitStone.js';

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
  turnHistory: [], // board snapshots before completed turns, used by Time Stone
  // Items
  inventories: {}, // { [player]: { [itemId]: available } }
  activeItem: null, // itemId currently being targeted
  itemState: {}, // staging for multi-step items, e.g. { firstCell }
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

function rememberTurn(state) {
  return [
    ...state.turnHistory,
    {
      board: state.board,
      historyLength: state.history.length,
    },
  ];
}

// Reset item targeting fields to idle.
const IDLE_ITEM = { activeItem: null, itemState: {} };

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

function findFirstWinner(board, placements) {
  for (const { x, y, player } of placements) {
    if (!player) continue;
    const line = findWinningLine(board, x, y, player);
    if (line) return { player, line };
  }
  return null;
}

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
  const turnHistory = rememberTurn(state);

  const outcome = resolveOutcome(state, next, [first, cell], player, defaultWin);
  return { ...state, history, inventories, turnHistory, ...outcome };
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
  const turnHistory = rememberTurn(state);
  return endTurn({ ...state, inventories, turnHistory }, next);
}

function handleStealStone(state, cell, success) {
  const { board, currentPlayer: player } = state;
  const owner = board[cell.y][cell.x];
  if (!owner || owner === player) {
    return {
      ...state,
      status: status("Must select an opponent's regular stone.", 'error'),
    };
  }

  const inventories = consume(state.inventories, player, 'steal_stone');
  const turnHistory = rememberTurn(state);

  if (!success) {
    return endTurn(
      { ...state, inventories, turnHistory },
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
      turnHistory,
      gameOver: true,
      winningCells: line,
      status: status(defaultWin(player), 'win'),
      ...IDLE_ITEM,
    };
  }
  return endTurn(
    { ...state, inventories, turnHistory },
    next,
    status(`Success! Converted opponent stone at (${cell.x}, ${cell.y}) to your color.`),
  );
}

function handleHitStone(state, cell) {
  const { board, currentPlayer: player } = state;

  if (!state.itemState.firstCell) {
    if (board[cell.y][cell.x]) {
      return {
        ...state,
        status: status('Choose an empty intersection for the Hit Stone start.', 'error'),
      };
    }
    return {
      ...state,
      itemState: { firstCell: cell },
      status: status(
        `Hit Stone start selected at (${cell.x}, ${cell.y}). Click a row or column direction.`,
      ),
    };
  }

  const first = state.itemState.firstCell;
  const direction = directionFromCells(first, cell);
  if (!direction) {
    return {
      ...state,
      status: status(
        'Choose a direction in the same row or column from the start.',
        'error',
      ),
    };
  }

  return {
    ...state,
    status: status('Hit Stone is moving. The turn will end when every stone stops.'),
  };
}

function commitHitStone(state, plan) {
  const player = state.currentPlayer;
  const next = plan.board;
  const inventories = consume(state.inventories, player, 'hit_stone');
  const turnHistory = rememberTurn(state);
  const history = [...state.history, { x: plan.start.x, y: plan.start.y, player, success: true }];
  const winner = findFirstWinner(next, plan.placements);

  if (winner) {
    return {
      ...state,
      board: next,
      history,
      inventories,
      turnHistory,
      gameOver: true,
      winningCells: winner.line,
      status: status(`Player ${winner.player} connects five and wins!`, 'win'),
      ...IDLE_ITEM,
    };
  }

  if (isBoardFull(next)) {
    return {
      ...state,
      board: next,
      history,
      inventories,
      turnHistory,
      gameOver: true,
      winningCells: [],
      status: status('The board is full. The game is a draw.'),
      ...IDLE_ITEM,
    };
  }

  return endTurn(
    { ...state, history, inventories, turnHistory },
    next,
    status('Hit Stone resolved. The final stone hit the edge and was removed.'),
  );
}

function handleTimeStone(state, roll) {
  const player = state.currentPlayer;
  if (!state.inventories[player]?.time_stone || state.gameOver || !state.gameStarted) {
    return state;
  }

  const inventories = consume(state.inventories, player, 'time_stone');

  if (!roll) {
    return endTurn(
      { ...state, inventories, failedFlash: null },
      state.board,
      status('Time Stone failed. No turns were undone.', 'error'),
    );
  }

  const undoCount = Math.min(roll, state.turnHistory.length);
  const nextPlayerAfterUse = nextPlayer(player, state.playerCount);

  if (!undoCount) {
    return {
      ...state,
      inventories,
      currentPlayer: nextPlayerAfterUse,
      failedFlash: null,
      status: status('Time Stone rolled a number, but there are no previous turns to undo.'),
      ...IDLE_ITEM,
    };
  }

  const targetIndex = state.turnHistory.length - undoCount;
  const snapshot = state.turnHistory[targetIndex];
  const label = undoCount === roll
    ? `${undoCount} turn${undoCount === 1 ? '' : 's'}`
    : `${undoCount} available turn${undoCount === 1 ? '' : 's'} of ${roll}`;

  return {
    ...state,
    board: snapshot.board,
    history: state.history.slice(0, snapshot.historyLength),
    turnHistory: state.turnHistory.slice(0, targetIndex),
    inventories,
    currentPlayer: nextPlayerAfterUse,
    gameOver: false,
    winningCells: [],
    failedFlash: null,
    status: status(`Time Stone rolled ${roll}. Undid ${label}. Player ${nextPlayerAfterUse} is next.`),
    ...IDLE_ITEM,
  };
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
        turnHistory: [],
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
      const turnHistory = rememberTurn(state);

      if (success) {
        const next = cloneBoard(state.board);
        next[cell.y][cell.x] = player;
        const outcome = resolveOutcome(state, next, [cell], player, defaultWin);
        return { ...state, history, turnHistory, failedFlash: null, ...outcome };
      }

      const nextP = nextPlayer(player, state.playerCount);
      return {
        ...state,
        history,
        turnHistory,
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
        status: status(
          `[ITEM ACTIVE] ${item.desc} (Click the item again to cancel)`,
        ),
      };
    }

    case 'CANCEL_ITEM':
      if (!state.activeItem) return state;
      return {
        ...state,
        ...IDLE_ITEM,
        status: status(
          `Player ${state.currentPlayer}'s turn. Choose any empty intersection.`,
        ),
      };

    case 'USE_TIME_STONE':
      return handleTimeStone(state, action.roll);

    case 'BEGIN_TIME_STONE_ANIMATION':
      return {
        ...state,
        status: status('Time Stone is rewinding. Removed stones are fading out.'),
      };

    case 'BEGIN_HIT_STONE_ANIMATION':
      if (state.activeItem !== 'hit_stone') return state;
      return {
        ...state,
        status: status('Hit Stone is moving. The turn will end when every stone stops.'),
      };

    case 'RESOLVE_HIT_STONE':
      if (state.activeItem !== 'hit_stone' || !action.plan) return state;
      return commitHitStone(state, action.plan);

    // A board click while an item is being targeted. `roll` carries any
    // pre-computed randomness the item needs (e.g. steal success).
    case 'ITEM_CLICK': {
      const { cell, roll } = action;
      if (!cell || state.gameOver || !state.gameStarted || !state.activeItem) {
        return state;
      }

      switch (state.activeItem) {
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

        case 'area_blast':
          return handleAreaBlast(state, cell);

        case 'steal_stone':
          return handleStealStone(state, cell, roll?.success ?? false);

        case 'hit_stone':
          return handleHitStone(state, cell);

        default:
          return state;
      }
    }

    default:
      return state;
  }
}
