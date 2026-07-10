// Pure game logic: board construction, coordinate helpers and win detection.
// No DOM, no randomness, no React — trivially testable.

import { SIZE } from './constants.js';

export function createBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function nextPlayer(player, playerCount) {
  return (player % playerCount) + 1;
}

export function inBounds(x, y) {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

export function isBoardFull(board) {
  return board.every((row) => row.every((cell) => cell !== 0));
}

// Scan the four directions through (x, y) for a run of five or more stones
// owned by `player`.
// Returns the array of winning cells, or null if there is no win.
export function findWinningLine(board, x, y, player) {
  const directions = [
    [1, 0], // horizontal
    [0, 1], // vertical
    [1, 1], // diagonal "\"
    [1, -1], // diagonal "/"
  ];

  for (const [dx, dy] of directions) {
    const line = [{ x, y }];

    for (const sign of [-1, 1]) {
      let nx = x + dx * sign;
      let ny = y + dy * sign;

      while (inBounds(nx, ny) && board[ny][nx] === player) {
        if (sign < 0) line.unshift({ x: nx, y: ny });
        else line.push({ x: nx, y: ny });
        nx += dx * sign;
        ny += dy * sign;
      }
    }

    if (line.length >= 5) return line;
  }
  return null;
}
