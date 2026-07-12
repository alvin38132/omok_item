import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { GameSession } from './gameSession.js';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

const sessions = new Map(); // { sessionId -> GameSession }
const playerSessions = new Map(); // { socketId -> { sessionId, playerNumber } }

let sessionIdCounter = 1;

function generateSessionId() {
  return `session-${sessionIdCounter++}`;
}

// REST API: Create game
app.post('/api/games', (req, res) => {
  const { playerCount = 2 } = req.body;
  const sessionId = generateSessionId();
  const session = new GameSession(sessionId, playerCount);
  sessions.set(sessionId, session);
  res.json({ sessionId, state: session.getState() });
});

// WebSocket: Connect to game
io.on('connection', (socket) => {
  console.log(`[${socket.id}] Connected`);

  socket.on('join', ({ sessionId, name }, callback) => {
    const session = sessions.get(sessionId);
    if (!session) {
      callback({ error: 'Game not found' });
      return;
    }

    const playerNumber = session.addPlayer(socket.id, name);
    playerSessions.set(socket.id, { sessionId, playerNumber });
    socket.join(sessionId);

    console.log(
      `[${socket.id}] Joined ${sessionId} as Player ${playerNumber}`
    );

    // Send initial state to the joining player
    callback({ playerNumber, state: session.getState() });

    // Broadcast updated player list to all in the room
    io.to(sessionId).emit('players_updated', session.getPlayers());
  });

  socket.on('action', ({ sessionId, action }, callback) => {
    const session = sessions.get(sessionId);
    if (!session) {
      callback({ error: 'Game not found' });
      return;
    }

    const nextState = session.dispatch(action);

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
