// Canvas rendering and camera math. Pure drawing — given a canvas context, a
// camera and the current game view, it paints a frame. It never mutates game
// state (camera clamping returns a new object).

import { SIZE } from './constants.js';
import { playerColor, shadeColor } from './colors.js';
import { inBounds } from './logic.js';
import { KNIGHT_OFFSETS, BIG_KNIGHT_OFFSETS, HIT_DIRECTIONS } from './items.js';

// ---------------------------------------------------------------------------
// Camera / coordinate helpers
// ---------------------------------------------------------------------------

export function screenPoint(camera, size, x, y) {
  return {
    x: size / 2 + (x - camera.x) * camera.gap,
    y: size / 2 + (y - camera.y) * camera.gap,
  };
}

// Keep the camera within the board bounds. Returns a new camera object.
export function clampCamera(camera, size) {
  const half = size / (2 * camera.gap);
  const min = half;
  const max = SIZE - 1 - half;
  if (min > max) {
    return {
      ...camera,
      x: (SIZE - 1) / 2,
      y: (SIZE - 1) / 2,
    };
  }
  return {
    ...camera,
    x: Math.max(min, Math.min(max, camera.x)),
    y: Math.max(min, Math.min(max, camera.y)),
  };
}

export function visibleRange(camera, size) {
  const half = size / (2 * camera.gap) + 1;
  return {
    minX: Math.max(0, Math.floor(camera.x - half)),
    maxX: Math.min(SIZE - 1, Math.ceil(camera.x + half)),
    minY: Math.max(0, Math.floor(camera.y - half)),
    maxY: Math.min(SIZE - 1, Math.ceil(camera.y + half)),
  };
}

// Convert a canvas-space pixel to the nearest board cell, or null if the click
// was too far from any intersection / out of bounds.
export function cellFromCanvas(camera, size, px, py) {
  const x = Math.round(camera.x + (px - size / 2) / camera.gap);
  const y = Math.round(camera.y + (py - size / 2) / camera.gap);
  if (!inBounds(x, y)) return null;

  const p = screenPoint(camera, size, x, y);
  const distance = Math.hypot(px - p.x, py - p.y);
  return distance <= camera.gap * 0.5 ? { x, y } : null;
}

// ---------------------------------------------------------------------------
// Frame rendering
// ---------------------------------------------------------------------------

export function drawGame(ctx, size, camera, view) {
  const gap = camera.gap;
  const range = visibleRange(camera, size);
  const point = (x, y) => screenPoint(camera, size, x, y);

  drawWood(ctx, size);
  drawGrid(ctx, size, point, range);
  drawStarPoints(ctx, size, point, gap);

  const { board } = view;

  // Hover preview of the stone about to be placed.
  if (
    view.gameStarted
    && !view.gameOver
    && !view.hitAnimationFrame
    && !view.timeRewindFrame
    && view.hover
    && !board[view.hover.y][view.hover.x]
    && !view.activeItem
  ) {
    drawPlacementPreview(ctx, point, view.hover.x, view.hover.y, view.currentPlayer, gap);
  }

  const hiddenCells = new Set(
    [
      ...(view.hitAnimationFrame?.hiddenCells || []),
      ...(view.timeRewindFrame?.hiddenCells || []),
    ].map((cell) => `${cell.x},${cell.y}`),
  );

  // Placed stones.
  for (let y = range.minY; y <= range.maxY; y++) {
    for (let x = range.minX; x <= range.maxX; x++) {
      if (hiddenCells.has(`${x},${y}`)) continue;
      if (board[y][x]) drawStone(ctx, point, x, y, board[y][x], gap);
    }
  }

  drawHitAnimation(ctx, point, view.hitAnimationFrame, gap);
  drawTimeRewindAnimation(ctx, point, view.timeRewindFrame, gap);
  drawItemEffectAnimation(ctx, point, view.itemEffectFrame, gap);
  drawFailedFlash(ctx, point, view.failedFlash, gap);
  drawWinningLine(ctx, point, board, view.winningCells, gap);
  drawItemOverlay(ctx, point, view, gap);
}

function drawWood(ctx, size) {
  const wood = ctx.createLinearGradient(0, 0, size, size);
  wood.addColorStop(0, '#e9be73');
  wood.addColorStop(0.5, '#dca65c');
  wood.addColorStop(1, '#c98c45');
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.strokeStyle = '#71451f';
  ctx.lineWidth = 2;
  for (let y = 25; y < size; y += 31) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.28, y - 7, size * 0.69, y + 8, size, y - 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGrid(ctx, size, point, range) {
  const first = point(range.minX, range.minY);
  const last = point(range.maxX, range.maxY);
  ctx.strokeStyle = 'rgba(52, 34, 20, 0.82)';
  ctx.lineWidth = Math.max(1.2, size / 650);

  for (let y = range.minY; y <= range.maxY; y++) {
    const py = point(0, y).y;
    ctx.beginPath();
    ctx.moveTo(first.x, py);
    ctx.lineTo(last.x, py);
    ctx.stroke();
  }
  for (let x = range.minX; x <= range.maxX; x++) {
    const px = point(x, 0).x;
    ctx.beginPath();
    ctx.moveTo(px, first.y);
    ctx.lineTo(px, last.y);
    ctx.stroke();
  }
}

function drawStarPoints(ctx, size, point, gap) {
  ctx.fillStyle = '#382517';
  for (const x of [3, 9, 15]) {
    for (const y of [3, 9, 15]) {
      const p = point(x, y);
      if (p.x >= -gap && p.x <= size + gap && p.y >= -gap && p.y <= size + gap) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2, gap * 0.09), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value) {
  const t = clamp01(value);
  return 1 - ((1 - t) ** 3);
}

function easeInOutCubic(value) {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function drawStone(ctx, point, x, y, player, gap, scale = 1) {
  const { x: px, y: py } = point(x, y);
  drawStoneAt(ctx, px, py, player, gap, scale);
}

function drawStoneAt(ctx, px, py, player, gap, scale = 1) {
  const radius = gap * 0.43 * scale;
  const baseColor = playerColor(player);
  const isWhite = player === 2;

  ctx.save();
  ctx.shadowColor = 'rgba(28, 19, 13, 0.48)';
  ctx.shadowBlur = gap * 0.15;
  ctx.shadowOffsetY = gap * 0.1;

  const gradient = ctx.createRadialGradient(
    px - radius * 0.32, py - radius * 0.38, radius * 0.06,
    px, py, radius,
  );
  gradient.addColorStop(0, isWhite ? '#ffffff' : '#6f6f6f');
  gradient.addColorStop(0.16, baseColor);
  gradient.addColorStop(1, isWhite ? shadeColor(baseColor, -0.18) : '#000000');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = isWhite ? 'rgba(0, 0, 0, 0.38)' : 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = Math.max(1.2, gap * 0.035);
  ctx.stroke();

  ctx.restore();
}

function drawFailedFlash(ctx, point, flash, gap) {
  if (!flash) return;
  const p = point(flash.x, flash.y);
  const r = gap * 0.23;
  ctx.save();
  ctx.strokeStyle = '#c9272c';
  ctx.lineWidth = Math.max(2, gap * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p.x - r, p.y - r);
  ctx.lineTo(p.x + r, p.y + r);
  ctx.moveTo(p.x + r, p.y - r);
  ctx.lineTo(p.x - r, p.y + r);
  ctx.stroke();
  ctx.restore();
}

function drawWinningLine(ctx, point, board, cells, gap) {
  if (!cells || !cells.length) return;
  const winner = board[cells[0].y][cells[0].x];
  const glowColor = playerColor(winner);
  const points = cells.map((cell) => point(cell.x, cell.y));

  ctx.save();
  ctx.lineCap = 'round';

  ctx.strokeStyle = 'rgba(255, 209, 102, 0.32)';
  ctx.lineWidth = Math.max(8, gap * 0.48);
  ctx.shadowColor = '#ffd166';
  ctx.shadowBlur = gap * 0.75;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) {
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  ctx.strokeStyle = '#fff7d6';
  ctx.lineWidth = Math.max(2, gap * 0.13);
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = gap * 0.45;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) {
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  for (const p of points) {
    const pulse = gap * 0.57;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.86)';
    ctx.lineWidth = Math.max(1.5, gap * 0.045);
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = gap * 0.34;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const p of [points[0], points[points.length - 1]]) {
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = gap * 0.42;
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10;
      const inner = gap * 0.58;
      const outer = gap * 0.82;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(angle) * inner, p.y + Math.sin(angle) * inner);
      ctx.lineTo(p.x + Math.cos(angle) * outer, p.y + Math.sin(angle) * outer);
      ctx.lineWidth = Math.max(1.2, gap * 0.035);
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.88)';
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawHighlightCell(ctx, point, x, y, color, gap, dashed = false) {
  const p = point(x, y);
  const s = gap * 0.8;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, gap * 0.06);
  if (dashed) ctx.setLineDash([4, 2]);
  ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
  ctx.restore();
}

function drawPlacementPreview(ctx, point, x, y, player, gap) {
  ctx.save();
  ctx.globalAlpha = 0.45;
  drawStone(ctx, point, x, y, player, gap);
  ctx.restore();
}

function drawHitAnimation(ctx, point, frame, gap) {
  if (!frame) return;
  for (const stone of frame.settledStones || []) {
    drawStone(ctx, point, stone.x, stone.y, stone.player, gap);
  }
  if (frame.movingStone) {
    const segment = frame.segment;
    const progress = frame.progress ?? 0;
    if (segment) {
      const from = point(segment.from.x, segment.from.y);
      const current = point(frame.movingStone.x, frame.movingStone.y);
      const flash = Math.sin(progress * Math.PI);

      ctx.save();
      ctx.strokeStyle = `rgba(6, 214, 160, ${0.2 + flash * 0.38})`;
      ctx.lineWidth = Math.max(2, gap * 0.09);
      ctx.lineCap = 'round';
      ctx.shadowColor = '#06d6a0';
      ctx.shadowBlur = gap * 0.3;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(current.x, current.y);
      ctx.stroke();

      for (let i = 0; i < 4; i++) {
        const offset = (i + 1) * gap * 0.22;
        ctx.globalAlpha = (1 - progress) * 0.22;
        ctx.beginPath();
        ctx.arc(current.x - segment.direction?.dx * offset, current.y - segment.direction?.dy * offset, gap * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawStone(
      ctx,
      point,
      frame.movingStone.x,
      frame.movingStone.y,
      frame.movingStone.player,
      gap,
    );
  }
}

function drawTimeRewindAnimation(ctx, point, frame, gap) {
  if (!frame) return;
  if (frame.mode === 'reverse_hit') {
    drawReverseHitRewind(ctx, point, frame, gap);
    return;
  }

  drawDiffRewind(ctx, point, frame, gap);
}

function drawRewindClock(ctx, x, y, progress, gap, alpha = 1) {
  const radius = gap * (0.58 + progress * 0.42);

  ctx.save();
  ctx.strokeStyle = `rgba(98, 182, 255, ${0.34 * alpha * (1 - progress * 0.3)})`;
  ctx.lineWidth = Math.max(1.5, gap * 0.05);
  ctx.lineCap = 'round';
  ctx.shadowColor = '#62b6ff';
  ctx.shadowBlur = gap * 0.22;
  ctx.beginPath();
  ctx.arc(x, y, radius, -Math.PI / 2 - progress * Math.PI * 2, Math.PI * 0.9 - progress * Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(
    x + Math.cos(-Math.PI / 2 - progress * Math.PI * 4) * radius * 0.65,
    y + Math.sin(-Math.PI / 2 - progress * Math.PI * 4) * radius * 0.65,
  );
  ctx.stroke();
  ctx.restore();
}

function drawDiffRewind(ctx, point, frame, gap) {
  const progress = frame.progress ?? 0;
  const fading = frame.fadingStones || [];
  const appearing = frame.appearingStones || [];
  const marked = frame.hiddenCells || [...fading, ...appearing];

  for (const stone of marked) {
    const p = point(stone.x, stone.y);
    drawRewindClock(ctx, p.x, p.y, progress, gap);
  }

  ctx.save();
  ctx.globalAlpha = 1 - progress;
  for (const stone of fading) {
    drawStone(ctx, point, stone.x, stone.y, stone.player, gap, 1 - progress * 0.55);
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = easeOutCubic(progress);
  for (const stone of appearing) {
    drawStone(ctx, point, stone.x, stone.y, stone.player, gap, 0.48 + easeOutCubic(progress) * 0.52);
  }
  ctx.restore();
}

function cellKey(cell) {
  return `${cell.x},${cell.y}`;
}

function drawReverseHitRewind(ctx, point, frame, gap) {
  const progress = frame.progress ?? 0;
  const pulse = Math.sin(progress * Math.PI);
  const hitCellKeys = new Set((frame.hitCells || []).map(cellKey));

  drawDiffRewind(ctx, point, {
    ...frame,
    hiddenCells: (frame.hiddenCells || []).filter((cell) => !hitCellKeys.has(cellKey(cell))),
    fadingStones: (frame.fadingStones || []).filter((cell) => !hitCellKeys.has(cellKey(cell))),
    appearingStones: (frame.appearingStones || []).filter((cell) => !hitCellKeys.has(cellKey(cell))),
  }, gap);

  for (const stone of frame.pendingStones || []) {
    drawStone(ctx, point, stone.x, stone.y, stone.player, gap);
  }
  for (const stone of frame.settledStones || []) {
    drawStone(ctx, point, stone.x, stone.y, stone.player, gap);
  }

  if (!frame.movingStone) return;

  const segment = frame.segment;
  const from = point(segment.from.x, segment.from.y);
  const to = point(segment.to.x, segment.to.y);
  const current = point(frame.movingStone.x, frame.movingStone.y);

  ctx.save();
  ctx.strokeStyle = `rgba(98, 182, 255, ${0.28 + pulse * 0.36})`;
  ctx.lineWidth = Math.max(2, gap * 0.09);
  ctx.lineCap = 'round';
  ctx.shadowColor = '#62b6ff';
  ctx.shadowBlur = gap * 0.32;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(current.x, current.y);
  ctx.stroke();
  drawRewindClock(ctx, current.x, current.y, progress, gap, 0.9);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = frame.movingStone.fromEdge ? easeOutCubic(progress) : 1;
  drawStoneAt(ctx, current.x, current.y, frame.movingStone.player, gap, 0.78 + pulse * 0.16);
  ctx.restore();
}

function curvedPoint(a, b, bend, t) {
  const mid = {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const control = {
    x: mid.x - (dy / length) * bend,
    y: mid.y + (dx / length) * bend,
  };
  const one = 1 - t;
  return {
    x: one * one * a.x + 2 * one * t * control.x + t * t * b.x,
    y: one * one * a.y + 2 * one * t * control.y + t * t * b.y,
  };
}

function drawCurvedTrail(ctx, a, b, bend, progress, color, gap) {
  const steps = 28;
  const end = Math.max(1, Math.floor(steps * progress));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, gap * 0.08);
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = gap * 0.35;
  ctx.beginPath();
  for (let i = 0; i <= end; i++) {
    const t = i / steps;
    const p = curvedPoint(a, b, bend, t);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawKnightEffect(ctx, point, frame, gap, big = false) {
  const progress = easeInOutCubic(frame.progress ?? 0);
  const from = point(frame.from.x, frame.from.y);
  const to = point(frame.to.x, frame.to.y);
  const bend = gap * (big ? 1.55 : 1.05);
  const color = big ? '#8ec5ff' : '#06d6a0';
  const pulse = Math.sin((frame.progress ?? 0) * Math.PI);
  const ghost = curvedPoint(from, to, bend, progress);

  drawCurvedTrail(ctx, from, to, bend, progress, color, gap);

  ctx.save();
  ctx.globalAlpha = 0.82;
  drawStoneAt(ctx, ghost.x, ghost.y - pulse * gap * (big ? 0.38 : 0.24), frame.player, gap, 0.9 + pulse * 0.18);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, gap * 0.055);
  ctx.shadowColor = color;
  ctx.shadowBlur = gap * 0.32;
  for (const p of [from, to]) {
    const radius = gap * (0.44 + pulse * (big ? 0.46 : 0.32));
    ctx.globalAlpha = 0.22 + pulse * 0.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (big) {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + progress;
      ctx.globalAlpha = 0.25 + pulse * 0.35;
      ctx.beginPath();
      ctx.moveTo(to.x + Math.cos(angle) * gap * 0.55, to.y + Math.sin(angle) * gap * 0.55);
      ctx.lineTo(to.x + Math.cos(angle) * gap * 0.95, to.y + Math.sin(angle) * gap * 0.95);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawAreaBlastEffect(ctx, point, frame, gap) {
  const progress = frame.progress ?? 0;
  const eased = easeOutCubic(progress);
  const center = point(frame.center.x, frame.center.y);
  const radius = gap * (0.7 + eased * 2.3);

  ctx.save();
  ctx.strokeStyle = `rgba(239, 71, 111, ${0.78 * (1 - progress)})`;
  ctx.lineWidth = Math.max(2, gap * 0.1);
  ctx.shadowColor = '#ef476f';
  ctx.shadowBlur = gap * 0.55;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = `rgba(255, 209, 102, ${0.12 * (1 - progress)})`;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 0.72, 0, Math.PI * 2);
  ctx.fill();

  for (const stone of frame.affectedStones || []) {
    const p = point(stone.x, stone.y);
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const length = Math.hypot(dx, dy) || 1;
    const travel = gap * 0.72 * eased;
    const px = p.x + (dx / length) * travel;
    const py = p.y + (dy / length) * travel;
    ctx.globalAlpha = 1 - eased;
    drawStoneAt(ctx, px, py, stone.player, gap, 1 + eased * 0.72);
  }
  ctx.restore();
}

function drawStealEffect(ctx, point, frame, gap) {
  const progress = frame.progress ?? 0;
  const eased = easeOutCubic(progress);
  const p = point(frame.target.x, frame.target.y);

  ctx.save();
  ctx.lineWidth = Math.max(2, gap * 0.075);
  ctx.lineCap = 'round';
  ctx.shadowBlur = gap * 0.35;

  if (frame.success) {
    ctx.strokeStyle = '#ffd166';
    ctx.shadowColor = '#ffd166';
    ctx.globalAlpha = 1 - progress * 0.25;
    ctx.beginPath();
    ctx.arc(p.x, p.y, gap * (0.52 + Math.sin(progress * Math.PI) * 0.2), progress * Math.PI * 4, progress * Math.PI * 4 + Math.PI * 1.55);
    ctx.stroke();

    ctx.globalAlpha = 1 - eased;
    drawStoneAt(ctx, p.x, p.y, frame.fromPlayer, gap, 1 + eased * 0.25);
    ctx.globalAlpha = eased;
    drawStoneAt(ctx, p.x, p.y, frame.toPlayer, gap, 0.72 + eased * 0.28);

    ctx.strokeStyle = '#06d6a0';
    ctx.shadowColor = '#06d6a0';
    ctx.globalAlpha = Math.sin(progress * Math.PI);
    ctx.beginPath();
    ctx.arc(p.x, p.y, gap * (0.72 + eased * 0.42), 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#ef476f';
    ctx.shadowColor = '#ef476f';
    ctx.globalAlpha = 0.8 * (1 - progress * 0.35);
    ctx.beginPath();
    ctx.arc(p.x, p.y, gap * (0.56 + Math.sin(progress * Math.PI) * 0.16), 0, Math.PI * 2);
    ctx.stroke();

    const r = gap * (0.26 + eased * 0.16);
    ctx.lineWidth = Math.max(2, gap * 0.1);
    ctx.beginPath();
    ctx.moveTo(p.x - r, p.y - r);
    ctx.lineTo(p.x + r, p.y + r);
    ctx.moveTo(p.x + r, p.y - r);
    ctx.lineTo(p.x - r, p.y + r);
    ctx.stroke();
  }
  ctx.restore();
}

function drawItemEffectAnimation(ctx, point, frame, gap) {
  if (!frame) return;
  switch (frame.type) {
    case 'knight_move':
      drawKnightEffect(ctx, point, frame, gap);
      break;
    case 'big_knight_move':
      drawKnightEffect(ctx, point, frame, gap, true);
      break;
    case 'area_blast':
      drawAreaBlastEffect(ctx, point, frame, gap);
      break;
    case 'steal_stone':
      drawStealEffect(ctx, point, frame, gap);
      break;
    default:
      break;
  }
}

function drawStoneSelectionHighlight(ctx, point, x, y, color, gap) {
  const p = point(x, y);
  const radius = gap * 0.52;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2.2, gap * 0.08);
  ctx.shadowColor = color;
  ctx.shadowBlur = gap * 0.28;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function isKnightTarget(first, cell, offsets) {
  return offsets.some(([dx, dy]) => first.x + dx === cell.x && first.y + dy === cell.y);
}

function drawDirectionGuide(ctx, point, from, direction, color, gap) {
  let end = from;
  let next = { x: from.x + direction.dx, y: from.y + direction.dy };
  while (inBounds(next.x, next.y)) {
    end = next;
    next = { x: next.x + direction.dx, y: next.y + direction.dy };
  }

  const a = point(from.x, from.y);
  const b = point(end.x, end.y);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, gap * 0.08);
  ctx.lineCap = 'round';
  ctx.setLineDash([gap * 0.28, gap * 0.18]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

// Interactive targeting overlays for the active item.
function drawItemOverlay(ctx, point, view, gap) {
  const { activeItem, itemState, hover, board, currentPlayer, gameOver } = view;
  if (!activeItem || gameOver || view.hitAnimationFrame || view.timeRewindFrame) return;

  const highlightKnight = (offsets) => {
    if (!itemState.firstCell) return;
    drawPlacementPreview(
      ctx,
      point,
      itemState.firstCell.x,
      itemState.firstCell.y,
      currentPlayer,
      gap,
    );
    drawHighlightCell(ctx, point, itemState.firstCell.x, itemState.firstCell.y, '#ffd166', gap);
    for (const [dx, dy] of offsets) {
      const nx = itemState.firstCell.x + dx;
      const ny = itemState.firstCell.y + dy;
      if (inBounds(nx, ny) && !board[ny][nx]) {
        drawHighlightCell(ctx, point, nx, ny, 'rgba(6, 214, 160, 0.4)', gap, true);
      }
    }
  };

  switch (activeItem) {
    case 'knight_move':
      highlightKnight(KNIGHT_OFFSETS);
      if (hover && !board[hover.y][hover.x]) {
        if (!itemState.firstCell || isKnightTarget(itemState.firstCell, hover, KNIGHT_OFFSETS)) {
          drawPlacementPreview(ctx, point, hover.x, hover.y, currentPlayer, gap);
        }
      }
      break;
    case 'big_knight_move':
      highlightKnight(BIG_KNIGHT_OFFSETS);
      if (hover && !board[hover.y][hover.x]) {
        if (!itemState.firstCell || isKnightTarget(itemState.firstCell, hover, BIG_KNIGHT_OFFSETS)) {
          drawPlacementPreview(ctx, point, hover.x, hover.y, currentPlayer, gap);
        }
      }
      break;
    case 'area_blast':
      if (hover && board[hover.y][hover.x] === currentPlayer) {
        drawStoneSelectionHighlight(ctx, point, hover.x, hover.y, '#ef476f', gap);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = hover.x + dx;
            const ny = hover.y + dy;
            if (inBounds(nx, ny)) {
              drawHighlightCell(ctx, point, nx, ny, 'rgba(239, 71, 111, 0.4)', gap);
            }
          }
        }
      }
      break;
    case 'steal_stone':
      if (hover) {
        const owner = board[hover.y][hover.x];
        if (owner && owner !== currentPlayer) {
          drawStoneSelectionHighlight(ctx, point, hover.x, hover.y, '#ffd166', gap);
          drawHighlightCell(ctx, point, hover.x, hover.y, 'rgba(255, 209, 102, 0.6)', gap);
        }
      }
      break;
    case 'hit_stone':
      if (!itemState.firstCell) {
        if (hover && !board[hover.y][hover.x]) {
          drawPlacementPreview(ctx, point, hover.x, hover.y, currentPlayer, gap);
          drawHighlightCell(ctx, point, hover.x, hover.y, 'rgba(6, 214, 160, 0.55)', gap);
        }
        break;
      }

      drawPlacementPreview(
        ctx,
        point,
        itemState.firstCell.x,
        itemState.firstCell.y,
        currentPlayer,
        gap,
      );
      drawHighlightCell(
        ctx,
        point,
        itemState.firstCell.x,
        itemState.firstCell.y,
        '#ffd166',
        gap,
      );

      for (const [dx, dy] of HIT_DIRECTIONS) {
        const nx = itemState.firstCell.x + dx;
        const ny = itemState.firstCell.y + dy;
        if (inBounds(nx, ny)) {
          drawHighlightCell(ctx, point, nx, ny, 'rgba(255, 209, 102, 0.35)', gap, true);
        }
      }

      if (hover) {
        const rawDx = hover.x - itemState.firstCell.x;
        const rawDy = hover.y - itemState.firstCell.y;
        const direction = rawDx === 0 && rawDy === 0
          ? null
          : rawDx === 0 || rawDy === 0
            ? { dx: Math.sign(rawDx), dy: Math.sign(rawDy) }
            : null;
        if (direction) {
          drawDirectionGuide(ctx, point, itemState.firstCell, direction, '#06d6a0', gap);
        }
      }
      break;
    default:
      break;
  }
}
