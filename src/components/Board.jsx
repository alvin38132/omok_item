// The interactive canvas board: rendering plus pan / zoom / hover / click /
// keyboard input. Camera and hover live in refs (not React state) so that
// dragging and hovering repaint the canvas directly without re-rendering the
// whole component tree.

import { useEffect, useLayoutEffect, useRef } from 'react';
import { DEFAULT_CAMERA, SIZE } from '../game/constants.js';
import {
  drawGame,
  clampCamera,
  cellFromCanvas,
  screenPoint,
} from '../game/renderer.js';

const CANVAS_SIZE = 950;

export default function Board({ state, onCellClick }) {
  const canvasRef = useRef(null);
  const cameraRef = useRef({ ...DEFAULT_CAMERA });
  const hoverRef = useRef(null);
  const keyboardCellRef = useRef({ x: 50, y: 50 });
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);

  // Latest game state, readable from imperative event handlers.
  const viewRef = useRef(state);
  viewRef.current = state;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const s = viewRef.current;
    drawGame(ctx, CANVAS_SIZE, cameraRef.current, {
      board: s.board,
      hover: hoverRef.current,
      currentPlayer: s.currentPlayer,
      gameStarted: s.gameStarted,
      gameOver: s.gameOver,
      winningCells: s.winningCells,
      failedFlash: s.failedFlash,
      activeItem: s.activeItem,
      itemState: s.itemState,
    });
  };

  // Repaint whenever any visible piece of game state changes.
  useLayoutEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.board,
    state.currentPlayer,
    state.gameStarted,
    state.gameOver,
    state.winningCells,
    state.failedFlash,
    state.activeItem,
    state.itemState,
  ]);

  // Reset the camera to center on each new game.
  useEffect(() => {
    cameraRef.current = { ...DEFAULT_CAMERA };
    hoverRef.current = null;
    keyboardCellRef.current = { x: 50, y: 50 };
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.session]);

  // Convert a pointer event to canvas-space pixels.
  const canvasPixels = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = CANVAS_SIZE / rect.width;
    return {
      x: (event.clientX - rect.left) * scale,
      y: (event.clientY - rect.top) * scale,
      scale,
    };
  };

  const cellFromEvent = (event) => {
    const p = canvasPixels(event);
    return cellFromCanvas(cameraRef.current, CANVAS_SIZE, p.x, p.y);
  };

  // Attach the wheel listener manually so we can call preventDefault (React's
  // synthetic wheel handler is passive by default).
  useEffect(() => {
    const canvas = canvasRef.current;
    const onWheel = (event) => {
      event.preventDefault();
      const p = canvasPixels(event);
      const cam = cameraRef.current;
      const anchorX = cam.x + (p.x - CANVAS_SIZE / 2) / cam.gap;
      const anchorY = cam.y + (p.y - CANVAS_SIZE / 2) / cam.gap;

      const gap = Math.max(10, Math.min(90, cam.gap * Math.exp(-event.deltaY * 0.0015)));
      let next = {
        gap,
        x: anchorX - (p.x - CANVAS_SIZE / 2) / gap,
        y: anchorY - (p.y - CANVAS_SIZE / 2) / gap,
      };
      next = clampCamera(next, CANVAS_SIZE);
      cameraRef.current = next;
      hoverRef.current = cellFromCanvas(next, CANVAS_SIZE, p.x, p.y);
      draw();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    canvasRef.current.setPointerCapture(event.pointerId);
    const cam = cameraRef.current;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cameraX: cam.x,
      cameraY: cam.y,
    };
    suppressClickRef.current = false;
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (drag && event.pointerId === drag.pointerId) {
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (distance > 5) {
        const rect = canvasRef.current.getBoundingClientRect();
        const scale = CANVAS_SIZE / rect.width;
        suppressClickRef.current = true;
        canvasRef.current.classList.add('panning');
        const cam = cameraRef.current;
        let next = {
          ...cam,
          x: drag.cameraX - ((event.clientX - drag.startX) * scale) / cam.gap,
          y: drag.cameraY - ((event.clientY - drag.startY) * scale) / cam.gap,
        };
        next = clampCamera(next, CANVAS_SIZE);
        cameraRef.current = next;
        hoverRef.current = null;
        draw();
      }
    } else {
      hoverRef.current = cellFromEvent(event);
      draw();
    }
  };

  const endDrag = (event) => {
    const drag = dragRef.current;
    if (drag && event.pointerId === drag.pointerId) {
      canvasRef.current.releasePointerCapture(event.pointerId);
      dragRef.current = null;
      canvasRef.current.classList.remove('panning');
    }
  };

  const handlePointerCancel = () => {
    dragRef.current = null;
    suppressClickRef.current = true;
    canvasRef.current.classList.remove('panning');
  };

  const handlePointerLeave = () => {
    if (!dragRef.current) {
      hoverRef.current = null;
      draw();
    }
  };

  const handleClick = (event) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onCellClick(cellFromEvent(event));
  };

  const handleKeyDown = (event) => {
    const s = viewRef.current;
    if (!s.gameStarted || s.gameOver) return;

    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (directions[event.key]) {
      event.preventDefault();
      const [dx, dy] = directions[event.key];
      const cell = keyboardCellRef.current;
      keyboardCellRef.current = {
        x: Math.max(0, Math.min(SIZE - 1, cell.x + dx)),
        y: Math.max(0, Math.min(SIZE - 1, cell.y + dy)),
      };
      // Keep the keyboard cursor in view and reflect it as the hover cell.
      hoverRef.current = keyboardCellRef.current;
      ensureVisible(keyboardCellRef.current);
      draw();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onCellClick(keyboardCellRef.current);
    }
  };

  // Pan the camera so a cell stays on-screen (used for keyboard navigation).
  const ensureVisible = (cell) => {
    const cam = cameraRef.current;
    const p = screenPoint(cam, CANVAS_SIZE, cell.x, cell.y);
    const margin = cam.gap;
    let { x, y } = cam;
    if (p.x < margin) x -= (margin - p.x) / cam.gap;
    if (p.x > CANVAS_SIZE - margin) x += (p.x - (CANVAS_SIZE - margin)) / cam.gap;
    if (p.y < margin) y -= (margin - p.y) / cam.gap;
    if (p.y > CANVAS_SIZE - margin) y += (p.y - (CANVAS_SIZE - margin)) / cam.gap;
    cameraRef.current = clampCamera({ ...cam, x, y }, CANVAS_SIZE);
  };

  return (
    <section className="board-panel" aria-label="Multiplayer Omok game board">
      <canvas
        ref={canvasRef}
        id="board"
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        tabIndex={0}
        aria-label="100 by 100 Omok board. Click to place, drag to pan, or use the wheel to zoom."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      />
    </section>
  );
}
