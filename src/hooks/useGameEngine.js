// Wraps the pure game reducer with an ergonomic API. This is where all the
// impure bits live (randomness), so the reducer itself stays deterministic.

import { useCallback, useMemo, useReducer } from 'react';
import { gameReducer, initialState } from '../game/reducer.js';
import { ITEMS_BY_ID } from '../game/items.js';
import { SIZE, SHARED_STONE } from '../game/constants.js';
import { fiftyFiftyRoll, chance, randomInt, shuffle } from '../game/random.js';

export function useGameEngine() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const startGame = useCallback((playerCount, fiftyFifty) => {
    dispatch({ type: 'START_GAME', playerCount, fiftyFifty });
  }, []);

  const clearFlash = useCallback(() => dispatch({ type: 'CLEAR_FLASH' }), []);

  // Place a normal stone. The 50–50 roll (if enabled) is decided here.
  const place = useCallback((cell) => {
    if (!cell) return;
    const success = !state.fiftyFifty || fiftyFiftyRoll();
    dispatch({ type: 'PLACE', cell, success });
  }, [state.fiftyFifty]);

  // Random Flip: choose ~30% of regular stones and reassign each to a random
  // different player. Randomness is resolved here and handed to the reducer.
  const runRandomFlip = useCallback(() => {
    const { board, playerCount } = state;
    const stones = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (board[y][x] && board[y][x] !== SHARED_STONE) {
          stones.push({ x, y, owner: board[y][x] });
        }
      }
    }
    if (stones.length === 0) {
      dispatch({ type: 'RANDOM_FLIP', flips: [] });
      return;
    }

    shuffle(stones);
    const flipCount = Math.max(1, Math.round(stones.length * 0.3));
    const flips = stones.slice(0, flipCount).map((stone) => {
      let owner = randomInt(playerCount - 1) + 1;
      if (owner >= stone.owner) owner += 1; // ensure a different owner
      return { x: stone.x, y: stone.y, owner };
    });
    dispatch({ type: 'RANDOM_FLIP', flips });
  }, [state]);

  // Activate an item. Instant items fire immediately; targeting items enter
  // targeting mode via the reducer.
  const activateItem = useCallback((itemId) => {
    const item = ITEMS_BY_ID[itemId];
    if (!item) return;
    if (item.actionType === 'instant' && state.activeItem !== itemId) {
      if (itemId === 'random_flip') runRandomFlip();
      return;
    }
    dispatch({ type: 'ACTIVATE_ITEM', itemId });
  }, [state.activeItem, runRandomFlip]);

  const cancelItem = useCallback(() => dispatch({ type: 'CANCEL_ITEM' }), []);

  // A board cell click. Routes to item targeting or a normal placement.
  const clickCell = useCallback((cell) => {
    if (!cell || state.gameOver || !state.gameStarted) return;
    if (state.activeItem) {
      const roll =
        state.activeItem === 'steal_stone' ? { success: chance(30) } : undefined;
      dispatch({ type: 'ITEM_CLICK', cell, roll });
    } else {
      place(cell);
    }
  }, [state.activeItem, state.gameOver, state.gameStarted, place]);

  const chooseLineClearDirection = useCallback(
    (direction) => dispatch({ type: 'LINE_CLEAR_DIRECTION', direction }),
    [],
  );
  const cancelLineClear = useCallback(() => dispatch({ type: 'CANCEL_ITEM' }), []);

  // Derived stats.
  const stats = useMemo(() => {
    const placed = state.history.filter((turn) => turn.success).length;
    return {
      attempts: state.history.length,
      placed,
      failed: state.history.length - placed,
    };
  }, [state.history]);

  return {
    state,
    stats,
    startGame,
    clearFlash,
    clickCell,
    activateItem,
    cancelItem,
    chooseLineClearDirection,
    cancelLineClear,
  };
}
