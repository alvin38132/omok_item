// The single source of truth for game state transitions.
//
// This reducer is PURE: every action carries all the data it needs (including
// pre-rolled randomness), so it never touches the DOM, `crypto`, or `Date`.
// That makes it safe under React StrictMode and easy to reason about.

import { ITEMS_BY_ID } from './items.js';
import {
  createBoard,
  cloneBoard,
  nextPlayer,
  inBounds,
  isBoardFull,
  findWinningLine,
} from './logic.js';
import { directionFromCells } from './hitStone.js';
import { PLAYER_COUNT } from './constants.js';

export const initialState = {
  board: createBoard(),
  playerCount: PLAYER_COUNT,
  currentPlayer: 1,
  history: [], // [{ x, y, player, success }]
  gameOver: false,
  winningCells: [],
  gameStarted: false,
  status: { message: '새 게임을 시작하세요.', kind: '' },
  failedFlash: null,
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

function playerName(player) {
  return player === 1 ? '흑' : '백';
}

function buildInventories() {
  const inventories = {};
  for (let p = 1; p <= PLAYER_COUNT; p++) {
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
        status: status('판이 가득 찼습니다. 무승부입니다.'),
        ...IDLE_ITEM,
      };
    }
  const next = nextPlayer(player, state.playerCount);
  return {
    board,
    gameOver: false,
    currentPlayer: next,
    status: status(`${playerName(player)}이 돌을 놓았습니다. ${playerName(next)} 차례입니다.`),
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
    status: customStatus || status(`${playerName(next)} 차례입니다.`),
    ...IDLE_ITEM,
  };
}

const defaultWin = (player) => `${playerName(player)}이 오목을 완성해 승리했습니다!`;

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
          '이미 돌이 있는 자리입니다. 첫 돌을 둘 빈 교차점을 선택하세요.',
          'error',
        ),
      };
    }
    return {
      ...state,
      itemState: { firstCell: cell },
      status: status(
        `첫 돌: (${cell.x}, ${cell.y}). ${shapeName} 위치에 둘 두 번째 자리를 선택하세요.`,
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
        `잘못된 선택입니다. 두 번째 돌은 ${shapeName} 위치여야 합니다. 행동을 취소했습니다.`,
      ),
    };
  }
  if (board[cell.y][cell.x]) {
    return {
      ...state,
      ...IDLE_ITEM,
      status: status('이미 돌이 있는 자리입니다. 행동을 취소했습니다.', 'error'),
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
      status: status('내 돌 하나를 선택해야 합니다.', 'error'),
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
      status: status('상대의 일반 돌을 선택해야 합니다.', 'error'),
    };
  }

  const inventories = consume(state.inventories, player, 'steal_stone');
  const turnHistory = rememberTurn(state);

  if (!success) {
    return endTurn(
      { ...state, inventories, turnHistory },
      board,
      status(`(${cell.x}, ${cell.y})의 상대 돌 변환에 실패했습니다.`, 'error'),
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
    status(`성공했습니다. (${cell.x}, ${cell.y})의 상대 돌을 내 돌로 바꿨습니다.`),
  );
}

function handleHitStone(state, cell) {
  const { board, currentPlayer: player } = state;

  if (!state.itemState.firstCell) {
    if (board[cell.y][cell.x]) {
      return {
        ...state,
        status: status('알까기 시작점으로 빈 교차점을 선택하세요.', 'error'),
      };
    }
    return {
      ...state,
      itemState: { firstCell: cell },
      status: status(
        `시작점: (${cell.x}, ${cell.y}). 가로 또는 세로 방향을 선택하세요.`,
      ),
    };
  }

  const first = state.itemState.firstCell;
  const direction = directionFromCells(first, cell);
  if (!direction) {
    return {
      ...state,
      status: status(
        '시작점과 같은 행 또는 열에서 방향을 선택하세요.',
        'error',
      ),
    };
  }

  return {
    ...state,
    status: status('돌을 밀어내는 중입니다. 모든 돌이 멈추면 차례가 끝납니다.'),
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
      status: status(`${playerName(winner.player)}이 오목을 완성해 승리했습니다!`, 'win'),
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
      status: status('판이 가득 찼습니다. 무승부입니다.'),
      ...IDLE_ITEM,
    };
  }

  return endTurn(
    { ...state, history, inventories, turnHistory },
    next,
    status('알까기가 끝났습니다. 마지막 돌은 바깥으로 밀려 제거되었습니다.'),
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
      status('시간 되돌리기가 실패했습니다. 되돌린 차례가 없습니다.', 'error'),
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
      status: status('시간 되돌리기가 숫자를 냈지만 되돌릴 이전 차례가 없습니다.'),
      ...IDLE_ITEM,
    };
  }

  const targetIndex = state.turnHistory.length - undoCount;
  const snapshot = state.turnHistory[targetIndex];
  const label = undoCount === roll
    ? `${undoCount}차례`
    : `${roll}차례 중 가능한 ${undoCount}차례`;

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
    status: status(`시간 되돌리기 결과: ${roll}. ${label}를 되돌렸습니다. ${playerName(nextPlayerAfterUse)} 차례입니다.`),
    ...IDLE_ITEM,
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function gameReducer(state, action) {
  switch (action.type) {
    case 'START_GAME': {
      return {
        ...initialState,
        playerCount: PLAYER_COUNT,
        gameStarted: true,
        inventories: buildInventories(),
        turnHistory: [],
        session: state.session + 1,
        status: status('흑부터 시작합니다. 빈 교차점을 선택해 돌을 놓으세요.'),
      };
    }

    case 'CLEAR_FLASH':
      return state.failedFlash ? { ...state, failedFlash: null } : state;

    // A normal stone placement.
    case 'PLACE': {
      const { cell } = action;
      if (!state.gameStarted || state.gameOver || !cell) return state;
      if (state.board[cell.y][cell.x]) {
        return {
          ...state,
          status: status('이미 돌이 있는 자리입니다. 다른 곳을 선택하세요.', 'error'),
        };
      }

      const player = state.currentPlayer;
      const history = [...state.history, { x: cell.x, y: cell.y, player, success: true }];
      const turnHistory = rememberTurn(state);
      const next = cloneBoard(state.board);
      next[cell.y][cell.x] = player;
      const outcome = resolveOutcome(state, next, [cell], player, defaultWin);
      return { ...state, history, turnHistory, failedFlash: null, ...outcome };
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
            `${playerName(state.currentPlayer)} 차례입니다. 빈 교차점을 선택하세요.`,
          ),
        };
      }

      return {
        ...state,
        activeItem: action.itemId,
        itemState: {},
        status: status(
          `[아이템 활성화] ${item.desc} (아이템을 다시 누르면 취소)`,
        ),
      };
    }

    case 'CANCEL_ITEM':
      if (!state.activeItem) return state;
      return {
        ...state,
        ...IDLE_ITEM,
        status: status(
          `${playerName(state.currentPlayer)} 차례입니다. 빈 교차점을 선택하세요.`,
        ),
      };

    case 'USE_TIME_STONE':
      return handleTimeStone(state, action.roll);

    case 'BEGIN_TIME_STONE_ANIMATION':
      return {
        ...state,
        status: status('시간 되돌리기로 시간을 되감는 중입니다. 제거될 돌이 사라지고 있습니다.'),
      };

    case 'BEGIN_HIT_STONE_ANIMATION':
      if (state.activeItem !== 'hit_stone') return state;
      return {
        ...state,
        status: status('돌을 밀어내는 중입니다. 모든 돌이 멈추면 차례가 끝납니다.'),
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
            '날일자',
          );

        case 'big_knight_move':
          return handleKnightMove(
            state,
            cell,
            'big_knight_move',
            (dx, dy) => (dx === 1 && dy === 3) || (dx === 3 && dy === 1),
            '큰 날일자',
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
