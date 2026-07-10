import { cloneBoard, inBounds } from './logic.js';

export function directionFromCells(first, second) {
  const rawDx = second.x - first.x;
  const rawDy = second.y - first.y;
  if (rawDx === 0 && rawDy === 0) return null;

  if (rawDx !== 0 && rawDy !== 0) return null;

  return {
    dx: Math.sign(rawDx),
    dy: Math.sign(rawDy),
  };
}

export function planHitStone(board, start, direction, player) {
  const next = cloneBoard(board);
  const placements = [];
  const segments = [];
  let movingPlayer = player;
  let from = start;

  while (true) {
    let scan = { x: from.x + direction.dx, y: from.y + direction.dy };

    while (inBounds(scan.x, scan.y) && !next[scan.y][scan.x]) {
      scan = { x: scan.x + direction.dx, y: scan.y + direction.dy };
    }

    if (!inBounds(scan.x, scan.y)) {
      segments.push({
        player: movingPlayer,
        from,
        to: scan,
        removeAtEdge: true,
      });
      break;
    }

    const stop = { x: scan.x - direction.dx, y: scan.y - direction.dy };
    next[stop.y][stop.x] = movingPlayer;
    placements.push({ ...stop, player: movingPlayer });
    segments.push({
      player: movingPlayer,
      from,
      to: stop,
      removeAtEdge: false,
    });

    movingPlayer = next[scan.y][scan.x];
    next[scan.y][scan.x] = 0;
    from = scan;
  }

  return {
    start,
    direction,
    board: next,
    placements,
    segments,
  };
}
