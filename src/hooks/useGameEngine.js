// Wraps the pure game reducer with an ergonomic API. This is where all the
// impure bits live (randomness), so the reducer itself stays deterministic.

import { useCallback, useMemo, useReducer, useState } from 'react';
import { gameReducer, initialState } from '../game/reducer.js';
import { fiftyFiftyRoll, chance } from '../game/random.js';
import { directionFromCells, planHitStone } from '../game/hitStone.js';
import { SIZE } from '../game/constants.js';

export function useGameEngine() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [hitAnimation, setHitAnimation] = useState(null);
  const [timeRewindAnimation, setTimeRewindAnimation] = useState(null);

  const startGame = useCallback((playerCount, fiftyFifty) => {
    setHitAnimation(null);
    setTimeRewindAnimation(null);
    dispatch({ type: 'START_GAME', playerCount, fiftyFifty });
  }, []);

  const clearFlash = useCallback(() => dispatch({ type: 'CLEAR_FLASH' }), []);

  // Place a normal stone. The 50–50 roll (if enabled) is decided here.
  const place = useCallback((cell) => {
    if (!cell) return;
    const success = !state.fiftyFifty || fiftyFiftyRoll();
    dispatch({ type: 'PLACE', cell, success });
  }, [state.fiftyFifty]);

  // Activate a targeting item.
  const activateItem = useCallback((itemId) => {
    if (hitAnimation || timeRewindAnimation) return;
    dispatch({ type: 'ACTIVATE_ITEM', itemId });
  }, [hitAnimation, timeRewindAnimation]);

  const cancelItem = useCallback(() => dispatch({ type: 'CANCEL_ITEM' }), []);

  const useTimeStone = useCallback((roll) => {
    if (hitAnimation || timeRewindAnimation) return;
    if (!roll) {
      dispatch({ type: 'USE_TIME_STONE', roll });
      return;
    }

    const undoCount = Math.min(roll, state.turnHistory.length);
    if (!undoCount) {
      dispatch({ type: 'USE_TIME_STONE', roll });
      return;
    }

    const snapshot = state.turnHistory[state.turnHistory.length - undoCount];
    const fadingStones = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const current = state.board[y][x];
        const target = snapshot.board[y][x];
        if (current && current !== target) {
          fadingStones.push({ x, y, player: current });
        }
      }
    }

    if (!fadingStones.length) {
      dispatch({ type: 'USE_TIME_STONE', roll });
      return;
    }

    dispatch({ type: 'BEGIN_TIME_STONE_ANIMATION' });
    setTimeRewindAnimation({
      id: crypto.randomUUID(),
      roll,
      fadingStones,
    });
  }, [hitAnimation, timeRewindAnimation, state.board, state.turnHistory]);

  const finishTimeRewindAnimation = useCallback((animationId) => {
    setTimeRewindAnimation((animation) => {
      if (!animation || animation.id !== animationId) return animation;
      dispatch({ type: 'USE_TIME_STONE', roll: animation.roll });
      return null;
    });
  }, []);

  const finishHitAnimation = useCallback((animationId) => {
    setHitAnimation((animation) => {
      if (!animation || animation.id !== animationId) return animation;
      dispatch({ type: 'RESOLVE_HIT_STONE', plan: animation.plan });
      return null;
    });
  }, []);

  // A board cell click. Routes to item targeting or a normal placement.
  const clickCell = useCallback((cell) => {
    if (!cell || state.gameOver || !state.gameStarted || hitAnimation || timeRewindAnimation) return;
    if (state.activeItem) {
      if (state.activeItem === 'hit_stone' && state.itemState.firstCell) {
        const direction = directionFromCells(state.itemState.firstCell, cell);
        if (direction) {
          const plan = planHitStone(
            state.board,
            state.itemState.firstCell,
            direction,
            state.currentPlayer,
          );
          dispatch({ type: 'BEGIN_HIT_STONE_ANIMATION' });
          setHitAnimation({
            id: crypto.randomUUID(),
            plan,
          });
          return;
        }
      }

      const roll =
        state.activeItem === 'steal_stone' ? { success: chance(30) } : undefined;
      dispatch({ type: 'ITEM_CLICK', cell, roll });
    } else {
      place(cell);
    }
  }, [
    hitAnimation,
    timeRewindAnimation,
    state.activeItem,
    state.board,
    state.currentPlayer,
    state.gameOver,
    state.gameStarted,
    state.itemState,
    place,
  ]);

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
    hitAnimation,
    timeRewindAnimation,
    startGame,
    clearFlash,
    clickCell,
    activateItem,
    cancelItem,
    useTimeStone,
    finishHitAnimation,
    finishTimeRewindAnimation,
  };
}
