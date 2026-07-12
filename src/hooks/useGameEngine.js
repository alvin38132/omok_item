// Wraps the pure game reducer with an ergonomic API. This is where all the
// impure bits live (randomness), so the reducer itself stays deterministic.

import { useCallback, useReducer, useState } from 'react';
import { gameReducer, initialState } from '../game/reducer.js';
import { chance } from '../game/random.js';
import { directionFromCells, planHitStone } from '../game/hitStone.js';
import { SIZE } from '../game/constants.js';
import { BIG_KNIGHT_OFFSETS, KNIGHT_OFFSETS } from '../game/items.js';
import { inBounds } from '../game/logic.js';

function isOffsetTarget(first, cell, offsets) {
  return offsets.some(([dx, dy]) => first.x + dx === cell.x && first.y + dy === cell.y);
}

function areaStones(board, center) {
  const stones = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = center.x + dx;
      const y = center.y + dy;
      if (inBounds(x, y) && board[y][x]) {
        stones.push({ x, y, player: board[y][x] });
      }
    }
  }
  return stones;
}

function buildRewindChanges(currentBoard, targetBoard) {
  const fadingStones = [];
  const appearingStones = [];
  const hiddenCells = [];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const current = currentBoard[y][x];
      const target = targetBoard[y][x];
      if (current === target) continue;

      hiddenCells.push({ x, y });
      if (current) fadingStones.push({ x, y, player: current });
      if (target) appearingStones.push({ x, y, player: target });
    }
  }

  return { fadingStones, appearingStones, hiddenCells };
}

export function useGameEngine() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [hitAnimation, setHitAnimation] = useState(null);
  const [timeRewindAnimation, setTimeRewindAnimation] = useState(null);
  const [itemAnimation, setItemAnimation] = useState(null);

  const startGame = useCallback(() => {
    setHitAnimation(null);
    setTimeRewindAnimation(null);
    setItemAnimation(null);
    dispatch({ type: 'START_GAME' });
  }, []);

  const clearFlash = useCallback(() => dispatch({ type: 'CLEAR_FLASH' }), []);

  // Place a normal stone.
  const place = useCallback((cell) => {
    if (!cell) return;
    dispatch({ type: 'PLACE', cell });
  }, []);

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

    const targetIndex = state.turnHistory.length - undoCount;
    const snapshot = state.turnHistory[targetIndex];
    const changes = buildRewindChanges(state.board, snapshot.board);
    const latestRevertedTurn = state.turnHistory[state.turnHistory.length - 1];
    const reverseHitPlan = latestRevertedTurn?.undoEffect?.type === 'hit_stone'
      ? latestRevertedTurn.undoEffect.plan
      : null;

    if (!changes.hiddenCells.length) {
      dispatch({ type: 'USE_TIME_STONE', roll });
      return;
    }

    dispatch({ type: 'BEGIN_TIME_STONE_ANIMATION' });
    setTimeRewindAnimation({
      id: crypto.randomUUID(),
      roll,
      ...changes,
      reverseHitPlan,
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

  const finishItemAnimation = useCallback((animationId) => {
    setItemAnimation((animation) => {
      if (!animation || animation.id !== animationId) return animation;
      return null;
    });
  }, []);

  const playItemAnimation = useCallback((animation) => {
    setItemAnimation({
      id: crypto.randomUUID(),
      ...animation,
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

      if (state.activeItem === 'knight_move' && state.itemState.firstCell) {
        if (
          !state.board[cell.y][cell.x]
          && isOffsetTarget(state.itemState.firstCell, cell, KNIGHT_OFFSETS)
        ) {
          playItemAnimation({
            type: 'knight_move',
            player: state.currentPlayer,
            from: state.itemState.firstCell,
            to: cell,
            duration: 760,
          });
        }
      } else if (state.activeItem === 'big_knight_move' && state.itemState.firstCell) {
        if (
          !state.board[cell.y][cell.x]
          && isOffsetTarget(state.itemState.firstCell, cell, BIG_KNIGHT_OFFSETS)
        ) {
          playItemAnimation({
            type: 'big_knight_move',
            player: state.currentPlayer,
            from: state.itemState.firstCell,
            to: cell,
            duration: 940,
          });
        }
      } else if (
        state.activeItem === 'area_blast'
        && state.board[cell.y][cell.x] === state.currentPlayer
      ) {
        playItemAnimation({
          type: 'area_blast',
          player: state.currentPlayer,
          center: cell,
          affectedStones: areaStones(state.board, cell),
          duration: 900,
        });
      } else if (state.activeItem === 'steal_stone') {
        const owner = state.board[cell.y][cell.x];
        if (owner && owner !== state.currentPlayer) {
          playItemAnimation({
            type: 'steal_stone',
            target: cell,
            fromPlayer: owner,
            toPlayer: state.currentPlayer,
            success: roll.success,
            duration: roll.success ? 980 : 720,
          });
        }
      }

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
    playItemAnimation,
  ]);

  return {
    state,
    hitAnimation,
    timeRewindAnimation,
    itemAnimation,
    startGame,
    clearFlash,
    clickCell,
    activateItem,
    cancelItem,
    useTimeStone,
    finishHitAnimation,
    finishTimeRewindAnimation,
    finishItemAnimation,
  };
}
