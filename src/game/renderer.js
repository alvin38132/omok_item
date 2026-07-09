// Canvas rendering and camera math. Pure drawing — given a canvas context, a
// camera and the current game view, it paints a frame. It never mutates game
// state (camera clamping returns a new object).

import { SIZE, SHARED_STONE } from './constants.js';
import { playerColor, shadeColor } from './colors.js';
import { inBounds } from './logic.js';
import { KNIGHT_OFFSETS, BIG_KNIGHT_OFFSETS } from './items.js';

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
  if (view.gameStarted && !view.gameOver && view.hover && !board[view.hover.y][view.hover.x] && !view.activeItem) {
    drawPlacementPreview(ctx, point, view.hover.x, view.hover.y, view.currentPlayer, gap);
  }

  // Placed stones.
  for (let y = range.minY; y <= range.maxY; y++) {
    for (let x = range.minX; x <= range.maxX; x++) {
      if (board[y][x]) drawStone(ctx, point, x, y, board[y][x], gap);
    }
  }

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
  for (const x of [19, 49, 79]) {
    for (const y of [19, 49, 79]) {
      const p = point(x, y);
      if (p.x >= -gap && p.x <= size + gap && p.y >= -gap && p.y <= size + gap) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2, gap * 0.09), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawStone(ctx, point, x, y, player, gap) {
  const { x: px, y: py } = point(x, y);
  const radius = gap * 0.43;

  ctx.save();
  ctx.shadowColor = 'rgba(28, 19, 13, 0.48)';
  ctx.shadowBlur = gap * 0.15;
  ctx.shadowOffsetY = gap * 0.1;

  const gradient = ctx.createRadialGradient(
    px - radius * 0.32, py - radius * 0.38, radius * 0.06,
    px, py, radius,
  );
  if (player === SHARED_STONE) {
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.2, '#ff5964');
    gradient.addColorStop(0.5, '#ffd166');
    gradient.addColorStop(0.8, '#06d6a0');
    gradient.addColorStop(1, '#118ab2');
  } else {
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.12, playerColor(player));
    gradient.addColorStop(1, shadeColor(playerColor(player), -0.32));
  }

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = player === SHARED_STONE ? '#ffffff' : 'rgba(255, 255, 255, 0.48)';
  ctx.lineWidth = Math.max(1.2, gap * 0.035);
  ctx.stroke();

  if (gap >= 20) {
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${Math.max(10, gap * 0.34)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 3;
    ctx.fillText(player === SHARED_STONE ? '★' : String(player), px, py + gap * 0.015);
  }
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
  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(2, gap * 0.11);
  ctx.lineCap = 'round';
  ctx.shadowColor = playerColor(board[cells[0].y][cells[0].x]);
  ctx.shadowBlur = gap * 0.35;

  ctx.beginPath();
  const start = point(cells[0].x, cells[0].y);
  ctx.moveTo(start.x, start.y);
  for (const cell of cells.slice(1)) {
    const p = point(cell.x, cell.y);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
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

// Interactive targeting overlays for the active item.
function drawItemOverlay(ctx, point, view, gap) {
  const { activeItem, itemState, hover, board, currentPlayer, gameOver } = view;
  if (!activeItem || gameOver) return;

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
    case 'shared_stone':
      if (hover && !board[hover.y][hover.x]) {
        drawPlacementPreview(ctx, point, hover.x, hover.y, SHARED_STONE, gap);
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
    case 'line_clear':
      if (hover && board[hover.y][hover.x]) {
        drawStoneSelectionHighlight(ctx, point, hover.x, hover.y, '#ff6b6b', gap);
        drawHighlightCell(ctx, point, hover.x, hover.y, '#ff6b6b', gap);
      }
      break;
    case 'steal_stone':
      if (hover) {
        const owner = board[hover.y][hover.x];
        if (owner && owner !== SHARED_STONE && owner !== currentPlayer) {
          drawStoneSelectionHighlight(ctx, point, hover.x, hover.y, '#ffd166', gap);
          drawHighlightCell(ctx, point, hover.x, hover.y, 'rgba(255, 209, 102, 0.6)', gap);
        }
      }
      break;
    default:
      break;
  }
}
