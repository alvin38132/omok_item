import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { GameSession } from './gameSession.js';
import { SadaCoinClient } from './sadaCoin.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*', // 모든 도메인 및 다른 컴퓨터에서의 접속을 허용
    methods: ['GET', 'POST']
  }
});
app.use(cors());
app.use(express.json());

const sadaCoin = new SadaCoinClient(process.env.SADA_API_KEY || '');

const sessions = new Map(); // { sessionId -> GameSession }
const playerSessions = new Map(); // { socketId -> { sessionId, playerNumber } }
const paymentRequests = new Map(); // { requestId -> { studentId, amount, status, createdAt } }

let sessionIdCounter = 1;
let paymentRequestIdCounter = 1;

function generateSessionId() {
  return String(sessionIdCounter++);
}

// REST API: Create game
app.post('/api/games', (req, res) => {
  const { playerCount = 2 } = req.body;
  const sessionId = generateSessionId();
  const session = new GameSession(sessionId, playerCount);
  sessions.set(sessionId, session);
  res.json({ sessionId, state: session.getState() });
});

// REST API: Purchase item (create payment request)
app.post('/api/purchase', async (req, res) => {
  const { studentId, itemId, amount } = req.body;

  if (!studentId || !itemId || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const itemName = {
      knight_move: "날일자",
      big_knight_move: "눈목자",
      area_blast: "폭발",
      steal_stone: "돌 빼앗기",
      hit_stone: "알까기",
      time_stone: "시간석"
    }[itemId] || itemId;

    const paymentRequest = await sadaCoin.createPaymentRequest(
      studentId,
      amount,
      `오목 게임 아이템: ${itemName}`
    );

    const requestId = paymentRequestIdCounter++;
    paymentRequests.set(requestId, {
      studentId,
      itemId,
      amount,
      sadaRequestId: paymentRequest.request_id,
      status: 'pending',
      createdAt: Date.now(),
      sadaPaymentRequest: paymentRequest,
    });

    res.json({
      requestId,
      sadaRequestId: paymentRequest.request_id,
      status: 'pending',
      expiresAt: paymentRequest.expires_at,
    });
  } catch (error) {
    console.error('Payment request error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// REST API: Check payment status
app.get('/api/purchase/:requestId', (req, res) => {
  const { requestId } = req.params;
  const request = paymentRequests.get(parseInt(requestId));

  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  res.json({
    requestId: parseInt(requestId),
    status: request.status,
    itemId: request.itemId,
    amount: request.amount,
    studentId: request.studentId,
  });
});

// WebSocket: Connect to game
io.on('connection', (socket) => {
  console.log(`[${socket.id}] Connected`);

  socket.on('join', ({ sessionId, name, isGuest }, callback) => {
    const session = sessions.get(sessionId);
    if (!session) {
      callback({ error: 'Game not found' });
      return;
    }

    const playerNumber = session.addPlayer(socket.id, name);
    playerSessions.set(socket.id, { sessionId, playerNumber, isGuest: isGuest || false });
    socket.join(sessionId);

    console.log(
      `[${socket.id}] Joined ${sessionId} as Player ${playerNumber}${isGuest ? ' (Guest)' : ''}`
    );

    // Send initial state to the joining player
    callback({ playerNumber, state: session.getState() });

    // Broadcast updated player list to all in the room
    io.to(sessionId).emit('players_updated', session.getPlayers());
  });

  socket.on('ready', ({ sessionId }, callback) => {
    const session = sessions.get(sessionId);
    const playerInfo = playerSessions.get(socket.id);
    if (!session || !playerInfo) {
      callback({ error: 'Game not found' });
      return;
    }

    session.setPlayerReady(playerInfo.playerNumber, true);
    callback({ ok: true });

    // Broadcast ready status to all players
    io.to(sessionId).emit('ready_status_updated', session.getReadyStatus());
  });

  socket.on('buy_item', ({ sessionId, itemId }, callback) => {
    const session = sessions.get(sessionId);
    const playerInfo = playerSessions.get(socket.id);
    if (!session || !playerInfo) {
      callback({ error: 'Game not found' });
      return;
    }

    // For guests, allow free item selection; for regular players, process payment
    const result = playerInfo.isGuest
      ? session.buyItemFree(playerInfo.playerNumber, itemId)
      : session.buyItem(playerInfo.playerNumber, itemId);

    if (result.error) {
      callback({ error: result.error });
      return;
    }

    callback({
      ok: true,
      coins: result.coins,
      boughtItems: result.boughtItems,
    });

    // Broadcast inventory update to all players
    io.to(sessionId).emit('inventory_updated', {
      playerNumber: playerInfo.playerNumber,
      coins: result.coins,
      boughtItems: result.boughtItems,
    });
  });

  socket.on('start_game', ({ sessionId, inventories }, callback) => {
    const session = sessions.get(sessionId);
    if (!session) {
      callback({ error: 'Game not found' });
      return;
    }

    // Check if all players are ready
    if (!session.areAllPlayersReady()) {
      callback({ error: '모든 플레이어가 준비되지 않았습니다.' });
      return;
    }

    const result = session.startGame(inventories);
    if (result.error) {
      callback({ error: result.error });
      return;
    }

    const state = session.getState();
    callback({ ok: true });

    // Reset ready status for next game
    for (let p = 1; p <= session.playerCount; p++) {
      session.setPlayerReady(p, false);
    }

    // Broadcast game start and initial state to all players
    io.to(sessionId).emit('state_updated', state);
  });

  socket.on('action', ({ sessionId, action }, callback) => {
    const session = sessions.get(sessionId);
    if (!session) {
      callback({ error: 'Game not found' });
      return;
    }

    if (!session.isGameStarted()) {
      callback({ error: 'Game not started' });
      return;
    }

    const nextState = session.dispatch(action);
    if (nextState.error) {
      callback({ error: nextState.error });
      return;
    }

    // Broadcast new state to all players in the game
    io.to(sessionId).emit('state_updated', nextState);

    // If game is over, broadcast game over event with final state
    if (nextState.gameOver) {
      io.to(sessionId).emit('game_over', {
        winningCells: nextState.winningCells,
        status: nextState.status,
        finalState: nextState,
      });
    }

    callback({ ok: true });
  });

  socket.on('disconnect', () => {
    const info = playerSessions.get(socket.id);
    if (info) {
      const session = sessions.get(info.sessionId);
      if (session) {
        session.removePlayer(info.playerNumber);
        console.log(
          `[${socket.id}] Left ${info.sessionId} (Player ${info.playerNumber})`
        );

        // If session is empty, optionally clean it up (or keep for history)
        if (session.players.size === 0) {
          console.log(`[${info.sessionId}] No players left, keeping session`);
        }

        // Broadcast updated player list
        io.to(info.sessionId).emit('players_updated', session.getPlayers());
      }
      playerSessions.delete(socket.id);
    }
    console.log(`[${socket.id}] Disconnected`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
