(() => {
  'use strict';

  // ==========================================
  // CONFIGURATION & CONSTANTS
  // ==========================================
  const SIZE = 100;
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 12;

  // Curated color palette for up to 12 players
  const COLORS = [
    '#ef476f', // Red
    '#f07828', // Orange
    '#d6a600', // Yellow
    '#68ad38', // Light Green
    '#13a57a', // Green
    '#00a6a6', // Teal
    '#168de2', // Light Blue
    '#4361ee', // Blue
    '#7654d6', // Indigo
    '#a846d1', // Purple
    '#d83c9b', // Magenta
    '#b85c70'  // Rose
  ];

  // ==========================================
  // DOM ELEMENTS
  // ==========================================
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  
  const dialog = document.getElementById('setupDialog');
  const setupForm = document.getElementById('setupForm');
  const countInput = document.getElementById('playerCount');
  const modeInput = document.getElementById('fiftyFiftyMode');
  
  const preview = document.getElementById('preview');
  const playersEl = document.getElementById('players');
  
  const turnStone = document.getElementById('turnStone');
  const turnText = document.getElementById('turnText');
  const status = document.getElementById('status');
  const kicker = document.getElementById('kicker');
  
  const attemptCount = document.getElementById('attemptCount');
  const successCount = document.getElementById('successCount');
  const failureCount = document.getElementById('failureCount');

  // ==========================================
  // STATE VARIABLES
  // ==========================================
  let board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  let playerCount = 2;
  let currentPlayer = 1;
  let history = [];
  let gameOver = false;
  let winningCells = [];
  let hover = null;
  
  let keyboardCell = { x: 50, y: 50 };
  let gameStarted = false;
  let fiftyFifty = false;
  let failedFlash = null;
  let flashTimer = null;
  
  // Camera system (panning & zooming)
  let camera = { x: 49.5, y: 49.5, gap: 38 };
  let drag = null;
  let suppressClick = false;

  // ==========================================
  // UTILITY FUNCTIONS
  // ==========================================
  const clampCount = (value) => {
    return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Number.parseInt(value, 10) || MIN_PLAYERS));
  };

  const playerColor = (player) => {
    return COLORS[(player - 1) % COLORS.length];
  };

  // Secure 50-50 roll generator
  function fiftyFiftyRoll() {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] < 0x80000000;
  }

  // Create individual stone element for previews or UI chips
  function makeStone(player, className) {
    const stone = document.createElement('span');
    stone.className = className;
    stone.style.background = playerColor(player);
    stone.textContent = player;
    stone.setAttribute('aria-label', `Player ${player}`);
    return stone;
  }

  // Update preview stone container inside setup dialog
  function updatePreview() {
    const count = clampCount(countInput.value);
    countInput.value = count;
    
    const stones = Array.from({ length: count }, (_, i) => makeStone(i + 1, 'legend-stone'));
    preview.replaceChildren(...stones);
  }

  // ==========================================
  // GAME ENGINE ACTIONS
  // ==========================================
  function startGame(count, useFiftyFifty) {
    playerCount = clampCount(count);
    fiftyFifty = useFiftyFifty;
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    
    currentPlayer = 1;
    history = [];
    gameOver = false;
    winningCells = [];
    hover = null;
    failedFlash = null;
    keyboardCell = { x: 50, y: 50 };
    camera = { x: 49.5, y: 49.5, gap: 38 };
    gameStarted = true;
    
    clearTimeout(flashTimer);
    renderPlayerList();
    
    kicker.textContent = fiftyFifty ? '50–50 multiplayer' : 'Classic multiplayer';
    setStatus(`Player 1 begins. ${fiftyFifty ? 'Every valid attempt is a 50–50 roll.' : 'Choose any empty intersection.'}`);
    updateUI();
    draw();
  }

  // Populate active players sidebar
  function renderPlayerList() {
    const chips = Array.from({ length: playerCount }, (_, i) => {
      const player = i + 1;
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.dataset.player = player;
      
      chip.append(makeStone(player, 'legend-stone'));
      
      const name = document.createElement('span');
      name.textContent = `Player ${player}`;
      chip.append(name);
      
      return chip;
    });
    playersEl.replaceChildren(...chips);
  }

  // ==========================================
  // CAMERA & COORDINATE CONVERSIONS
  // ==========================================
  function clampCamera() {
    const half = canvas.width / (2 * camera.gap);
    const min = half;
    const max = SIZE - 1 - half;
    camera.x = Math.max(min, Math.min(max, camera.x));
    camera.y = Math.max(min, Math.min(max, camera.y));
  }

  function screenPoint(x, y) {
    return {
      x: canvas.width / 2 + (x - camera.x) * camera.gap,
      y: canvas.height / 2 + (y - camera.y) * camera.gap
    };
  }

  function visibleRange() {
    const half = canvas.width / (2 * camera.gap) + 1;
    return {
      minX: Math.max(0, Math.floor(camera.x - half)),
      maxX: Math.min(SIZE - 1, Math.ceil(camera.x + half)),
      minY: Math.max(0, Math.floor(camera.y - half)),
      maxY: Math.min(SIZE - 1, Math.ceil(camera.y + half))
    };
  }

  // ==========================================
  // CANVAS RENDERING
  // ==========================================
  function draw() {
    const gap = camera.gap;
    const w = canvas.width;
    const range = visibleRange();
    
    // Draw wood board background
    const wood = ctx.createLinearGradient(0, 0, w, w);
    wood.addColorStop(0, '#e9be73');
    wood.addColorStop(0.5, '#dca65c');
    wood.addColorStop(1, '#c98c45');
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, w, w);
    
    // Draw wood grain texture lines
    ctx.save();
    ctx.globalAlpha = 0.11;
    ctx.strokeStyle = '#71451f';
    ctx.lineWidth = 2;
    for (let y = 25; y < w; y += 31) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.28, y - 7, w * 0.69, y + 8, w, y - 2);
      ctx.stroke();
    }
    ctx.restore();
    
    // Draw board intersections (grid lines)
    const first = screenPoint(range.minX, range.minY);
    const last = screenPoint(range.maxX, range.maxY);
    ctx.strokeStyle = 'rgba(52, 34, 20, 0.82)';
    ctx.lineWidth = Math.max(1.2, w / 650);
    
    for (let y = range.minY; y <= range.maxY; y++) {
      const p = screenPoint(0, y).y;
      ctx.beginPath();
      ctx.moveTo(first.x, p);
      ctx.lineTo(last.x, p);
      ctx.stroke();
    }
    for (let x = range.minX; x <= range.maxX; x++) {
      const p = screenPoint(x, 0).x;
      ctx.beginPath();
      ctx.moveTo(p, first.y);
      ctx.lineTo(p, last.y);
      ctx.stroke();
    }
    
    // Draw standard grid dot markings (Star points / Hoshi)
    ctx.fillStyle = '#382517';
    for (const x of [19, 49, 79]) {
      for (const y of [19, 49, 79]) {
        const p = screenPoint(x, y);
        if (p.x >= -gap && p.x <= w + gap && p.y >= -gap && p.y <= w + gap) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(2, gap * 0.09), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    
    // Draw stone preview on hover
    if (gameStarted && !gameOver && hover && !board[hover.y][hover.x]) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      drawStone(hover.x, hover.y, currentPlayer, gap);
      ctx.restore();
    }
    
    // Draw placed stones
    for (let y = range.minY; y <= range.maxY; y++) {
      for (let x = range.minX; x <= range.maxX; x++) {
        if (board[y][x]) {
          drawStone(x, y, board[y][x], gap);
        }
      }
    }
    
    // Draw placement failure visual flash (X)
    if (failedFlash) {
      const p = screenPoint(failedFlash.x, failedFlash.y);
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
    
    // Draw winning line connection
    if (winningCells.length) {
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(2, gap * 0.11);
      ctx.lineCap = 'round';
      ctx.shadowColor = playerColor(board[winningCells[0].y][winningCells[0].x]);
      ctx.shadowBlur = gap * 0.35;
      
      ctx.beginPath();
      const start = screenPoint(winningCells[0].x, winningCells[0].y);
      ctx.moveTo(start.x, start.y);
      for (const cell of winningCells.slice(1)) {
        const p = screenPoint(cell.x, cell.y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw 3D-gradient styled stones
  function drawStone(x, y, player, gap) {
    const p = screenPoint(x, y);
    const px = p.x;
    const py = p.y;
    const radius = gap * 0.43;
    
    ctx.save();
    ctx.shadowColor = 'rgba(28, 19, 13, 0.48)';
    ctx.shadowBlur = gap * 0.15;
    ctx.shadowOffsetY = gap * 0.1;
    
    // Radial light gradient reflection
    const gradient = ctx.createRadialGradient(
      px - radius * 0.32,
      py - radius * 0.38,
      radius * 0.06,
      px,
      py,
      radius
    );
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.12, playerColor(player));
    gradient.addColorStop(1, shadeColor(playerColor(player), -0.32));
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Stroke/outer shine ring
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.lineWidth = Math.max(1.2, gap * 0.035);
    ctx.stroke();
    
    // Draw player label number inside stone if board zoomed close enough
    if (gap >= 20) {
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${Math.max(10, gap * 0.34)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = 3;
      ctx.fillText(player, px, py + gap * 0.015);
    }
    ctx.restore();
  }

  // Darken color helper
  function shadeColor(hex, amount) {
    const value = Number.parseInt(hex.slice(1), 16);
    const adjust = (channel) => Math.round(Math.max(0, Math.min(255, channel * (1 + amount))));
    
    const r = value >> 16;
    const g = (value >> 8) & 255;
    const b = value & 255;
    
    return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
  }

  // ==========================================
  // INPUT & MOVEMENT HANDLING
  // ==========================================
  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    return {
      x: (event.clientX - rect.left) * scale,
      y: (event.clientY - rect.top) * scale,
      scale
    };
  }

  function pointFromEvent(event) {
    const p = canvasPoint(event);
    const x = Math.round(camera.x + (p.x - canvas.width / 2) / camera.gap);
    const y = Math.round(camera.y + (p.y - canvas.height / 2) / camera.gap);
    
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) {
      return null;
    }
    
    const screen = screenPoint(x, y);
    const distanceToIntersection = Math.hypot(p.x - screen.x, p.y - screen.y);
    
    return distanceToIntersection <= camera.gap * 0.5 ? { x, y } : null;
  }

  function nextPlayer(player) {
    return (player % playerCount) + 1;
  }

  function attemptMove(cell) {
    if (!gameStarted || gameOver || !cell) {
      return;
    }
    if (board[cell.y][cell.x]) {
      setStatus('That intersection is occupied. Choose another one.', 'error');
      return;
    }
    
    const player = currentPlayer;
    const success = !fiftyFifty || fiftyFiftyRoll();
    history.push({ x: cell.x, y: cell.y, player, success });
    
    if (success) {
      board[cell.y][cell.x] = player;
      const line = findWinningLine(cell.x, cell.y, player);
      
      if (line) {
        gameOver = true;
        winningCells = line;
        setStatus(`Player ${player} connects five and wins!`, 'win');
      } else if (history.filter(turn => turn.success).length === SIZE * SIZE) {
        gameOver = true;
        setStatus('The board is full. The game is a draw.');
      } else {
        currentPlayer = nextPlayer(player);
        setStatus(`Player ${player} placed a stone. Player ${currentPlayer} is next.`);
      }
    } else {
      failedFlash = cell;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        failedFlash = null;
        draw();
      }, 700);
      
      currentPlayer = nextPlayer(player);
      setStatus(`Player ${player}'s stone failed to appear. Player ${currentPlayer} is next.`, 'error');
    }
    
    updateUI();
    draw();
  }

  // Scan four directions (horizontal, vertical, diagonal / and \) for win lines
  function findWinningLine(x, y, player) {
    const directions = [
      [1, 0],  // Horizontal
      [0, 1],  // Vertical
      [1, 1],  // Diagonal \
      [1, -1]  // Diagonal /
    ];
    
    for (const [dx, dy] of directions) {
      const line = [{ x, y }];
      
      for (const sign of [-1, 1]) {
        let nx = x + dx * sign;
        let ny = y + dy * sign;
        
        while (
          nx >= 0 && nx < SIZE &&
          ny >= 0 && ny < SIZE &&
          board[ny][nx] === player
        ) {
          if (sign < 0) {
            line.unshift({ x: nx, y: ny });
          } else {
            line.push({ x: nx, y: ny });
          }
          nx += dx * sign;
          ny += dy * sign;
        }
      }
      
      if (line.length >= 5) {
        return line;
      }
    }
    return null;
  }

  function setStatus(message, kind = '') {
    status.textContent = message;
    status.className = `status ${kind}`.trim();
    status.style.borderColor = playerColor(currentPlayer);
  }

  function updateUI() {
    const successes = history.filter(turn => turn.success).length;
    const failures = history.length - successes;
    
    turnStone.textContent = currentPlayer;
    turnStone.style.background = playerColor(currentPlayer);
    turnText.textContent = gameOver ? 'Game over' : `Player ${currentPlayer}`;
    
    attemptCount.textContent = history.length;
    successCount.textContent = successes;
    failureCount.textContent = failures;
    
    document.querySelectorAll('.player-chip').forEach((chip) => {
      const isCurrent = !gameOver && Number(chip.dataset.player) === currentPlayer;
      chip.classList.toggle('active', isCurrent);
    });
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  
  // Drag to Pan
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y
    };
    suppressClick = false;
  });

  canvas.addEventListener('pointermove', event => {
    if (drag && event.pointerId === drag.pointerId) {
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (distance > 5) {
        const rect = canvas.getBoundingClientRect();
        const scale = canvas.width / rect.width;
        
        suppressClick = true;
        canvas.classList.add('panning');
        camera.x = drag.cameraX - (event.clientX - drag.startX) * scale / camera.gap;
        camera.y = drag.cameraY - (event.clientY - drag.startY) * scale / camera.gap;
        
        clampCamera();
        hover = null;
        draw();
      }
    } else {
      hover = pointFromEvent(event);
      draw();
    }
  });

  canvas.addEventListener('pointerup', event => {
    if (drag && event.pointerId === drag.pointerId) {
      canvas.releasePointerCapture(event.pointerId);
      drag = null;
      canvas.classList.remove('panning');
    }
  });

  canvas.addEventListener('pointercancel', () => {
    drag = null;
    suppressClick = true;
    canvas.classList.remove('panning');
  });

  canvas.addEventListener('pointerleave', () => {
    if (!drag) {
      hover = null;
      draw();
    }
  });

  // Tap or Click to Place
  canvas.addEventListener('click', event => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    attemptMove(pointFromEvent(event));
  });

  // Wheel to Zoom
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const p = canvasPoint(event);
    
    const anchorX = camera.x + (p.x - canvas.width / 2) / camera.gap;
    const anchorY = camera.y + (p.y - canvas.height / 2) / camera.gap;
    
    camera.gap = Math.max(10, Math.min(90, camera.gap * Math.exp(-event.deltaY * 0.0015)));
    camera.x = anchorX - (p.x - canvas.width / 2) / camera.gap;
    camera.y = anchorY - (p.y - canvas.height / 2) / camera.gap;
    
    clampCamera();
    hover = pointFromEvent(event);
    draw();
  }, { passive: false });

  canvas.addEventListener('focus', draw);
  canvas.addEventListener('blur', draw);

  // Keyboard navigation for accessibility/alternative input
  canvas.addEventListener('keydown', event => {
    if (!gameStarted || gameOver) return;
    
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    };
    
    if (directions[event.key]) {
      event.preventDefault();
      keyboardCell.x = Math.max(0, Math.min(SIZE - 1, keyboardCell.x + directions[event.key][0]));
      keyboardCell.y = Math.max(0, Math.min(SIZE - 1, keyboardCell.y + directions[event.key][1]));
      draw();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      attemptMove(keyboardCell);
    }
  });

  // Dialog Controls
  document.getElementById('decrease').addEventListener('click', () => {
    countInput.value = clampCount(Number(countInput.value) - 1);
    updatePreview();
  });
  
  document.getElementById('increase').addEventListener('click', () => {
    countInput.value = clampCount(Number(countInput.value) + 1);
    updatePreview();
  });
  
  countInput.addEventListener('input', updatePreview);
  
  setupForm.addEventListener('submit', event => {
    event.preventDefault();
    startGame(countInput.value, modeInput.checked);
    dialog.close();
  });
  
  dialog.addEventListener('cancel', event => {
    if (!gameStarted) {
      event.preventDefault();
    }
  });

  document.getElementById('newGame').addEventListener('click', () => {
    countInput.value = playerCount;
    modeInput.checked = fiftyFifty;
    updatePreview();
    dialog.showModal();
  });

  // ==========================================
  // INITIAL GAME STARTUP
  // ==========================================
  updatePreview();
  draw();
  dialog.showModal();
})();