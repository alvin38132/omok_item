# 멀티플레이 서버 아키텍처

## 목표
- **낙관적 업데이트**: 클라이언트에서 먼저 검증 후 로컬 상태 반영
- **서버 권위성**: 서버에서 재검증 후 canonical state 확정
- **동기화**: 양쪽 플레이어(또는 전체 게임방)에게 최종 보드 상태 브로드캐스트

---

## 엔드포인트 설계

### REST API (초기화만)

#### 1. 게임 생성
```
POST   /api/games
Body:  {
  playerName: string,
  playerCount: 2 | 3 | ... | 12,
  fiftyFifty: boolean
}

Response: {
  sessionId: string,
  playerId: string,
  playerToken: string,
  wsUrl: string     // WebSocket 연결 URL
}
```

#### 2. 게임 참여
```
POST   /api/games/:sessionId/join
Body:  {
  playerName: string
}

Response: {
  playerId: string,
  playerToken: string,
  wsUrl: string
}
```

---

### WebSocket (실시간 통신)

#### 연결
```
ws://server/ws?sessionId=abc123&playerId=p1&playerToken=token...
```

#### 클라이언트 → 서버: 액션 제출
```json
{
  "type": "action",
  "actionSeq": 42,
  "action": {
    "type": "PLACE",
    "payload": { "cell": { "x": 9, "y": 9 }, "fiftyFiftyRoll": true }
  }
}
```

#### 서버 → 클라이언트: 액션 확인
```json
{
  "type": "action_result",
  "actionSeq": 42,
  "status": "ok" | "invalid" | "stale",
  "gameState": { /* 완전한 게임 상태 */ },
  "error": "optional error message"
}
```

#### 서버 → 모든 플레이어: 게임 상태 브로드캐스트
```json
{
  "type": "game_state",
  "board": [...],
  "currentPlayer": 1,
  "status": { "message": "...", "kind": "" },
  "turnNum": 42
}
```

#### 서버 → 모든 플레이어: 게임 종료
```json
{
  "type": "game_over",
  "winner": 1,
  "winningCells": [ { "x": 9, "y": 9 }, ... ],
  "reason": "five_in_a_row" | "board_full",
  "gameId": "recorded_game_123"
}
```

---

## 액션 페이로드 규약

### 공통 구조
```json
{
  "type": "PLACE" | "ACTIVATE_ITEM" | "ITEM_CLICK" | "...",
  "payload": { /* 액션별 데이터 */ }
}
```

### 액션별 상세

#### 1. PLACE (일반 착수)
```json
{
  "type": "PLACE",
  "payload": {
    "cell": { "x": 9, "y": 9 },
    "fiftyFiftyRoll": true
  }
}
```
**클라이언트 검증:**
- 셀이 보드 범위 내
- 셀이 비어있음
- 게임이 시작됨 & 게임오버 아님

**서버 검증:**
- 위의 모든 항목 재확인
- 순번이 맞음 (스킵 불가)
- 현재 플레이어가 맞음

---

#### 2. ACTIVATE_ITEM
```json
{
  "type": "ACTIVATE_ITEM",
  "payload": {
    "itemId": "knight_move" | "area_blast" | "steal_stone" | "time_stone" | "hit_stone",
    "randomSeed": null
  }
}
```
**클라이언트 검증:**
- 아이템이 인벤토리에 있음
- 게임오버 아님

**서버 검증:**
- 위의 모든 항목 재확인
- 현재 플레이어가 맞음

---

#### 3. ITEM_CLICK (아이템 조준 → 클릭)
```json
{
  "type": "ITEM_CLICK",
  "payload": {
    "itemId": "knight_move",
    "cell": { "x": 5, "y": 5 },
    "stealRoll": null  // steal_stone일 때만: 30% 성공 여부 (boolean)
  }
}
```
**클라이언트 검증:**
- 셀이 보드 범위 내
- 아이템별 추가 규칙 (knight_move면 첫 번째 셀이 비어있는가, 등)

**서버 검증:**
- 아이템이 활성화된 상태인가
- 모든 클라이언트 검증 재실행
- steal_stone: `stealRoll`이 없으면 서버에서 30% 난수 생성

---

#### 4. TIME_STONE_CONFIRM (Time Stone 주사위 확정)
```json
{
  "type": "TIME_STONE_CONFIRM",
  "payload": {
    "dieRoll": null  // 서버에서 1~6 생성
  }
}
```

---

#### 5. HIT_STONE_CLICK (Hit Stone 방향 선택)
```json
{
  "type": "HIT_STONE_CLICK",
  "payload": {
    "startCell": { "x": 9, "y": 9 },
    "direction": [0, -1]  // [dx, dy]
  }
}
```

---

## 게임 상태 응답

### 완전한 게임 상태 (처음 또는 폴링)
```json
{
  "sessionId": "abc123",
  "players": [
    { "playerId": "p1", "name": "Alice" },
    { "playerId": "p2", "name": "Bob" }
  ],
  "board": [
    [0, 0, 0, ..., 0],
    [0, 1, 0, ..., 2],
    ...
  ],
  "currentPlayer": 1,
  "playerCount": 2,
  "gameStarted": true,
  "gameOver": false,
  "fiftyFifty": false,
  "winningCells": [],
  "history": [
    { "x": 9, "y": 9, "player": 1, "success": true, "action": "PLACE" },
    { "x": 5, "y": 5, "player": 2, "success": true, "action": "ITEM_CLICK", "itemId": "knight_move" }
  ],
  "inventories": {
    "1": { "knight_move": false, "area_blast": true, ... },
    "2": { "knight_move": true, "area_blast": true, ... }
  },
  "status": {
    "message": "Player 1 placed a stone...",
    "kind": ""
  }
}
```

---

## 클라이언트 ↔ 서버 흐름

### 시나리오: Player 1이 knight_move 아이템 사용

```
┌─────────────────────────────────────────────────────────────┐
│ 클라이언트 (Player 1)                                         │
├─────────────────────────────────────────────────────────────┤

1. 낙관적 업데이트 (로컬 reducer)
   const newState = reducer(localState, {
     type: 'ACTIVATE_ITEM',
     payload: { itemId: 'knight_move' }
   })
   setLocalState(newState)  // 즉시 UI 갱신

2. WebSocket으로 서버에 전송
   ws.send({
     type: 'action',
     actionSeq: 42,
     action: { ... }
   })
   
   [대기 중...]
   
3. 서버 응답 수신
   ws.onmessage((msg) => {
     if (msg.type === 'action_result') {
       if (msg.status === 'ok') {
         setLocalState(msg.gameState)  // 서버 상태로 확인
       } else if (msg.status === 'stale') {
         // 서버 상태로 초기화 후 재시도
         setLocalState(msg.gameState)
       }
     } else if (msg.type === 'game_state') {
       // 다른 플레이어의 액션 브로드캐스트
       setLocalState(msg.gameState)
     } else if (msg.type === 'game_over') {
       setGameOver(true)
       setWinner(msg.winner)
     }
   })

└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 서버 (Game Room)                                             │
├─────────────────────────────────────────────────────────────┤

1. 액션 수신 & 검증
   const action = parseMessage(clientMsg)
   const isValid = validateAction(action, canonicalState)
   
   if (!isValid) {
     return { status: 'invalid', error: '...' }
   }

2. Canonical state 진행
   canonicalState = gameReducer(canonicalState, action)

3. 게임오버 체크
   if (canonicalState.gameOver) {
     // 게임 기록 저장
     const gameId = await saveGameRecord(...)
     // 통계 갱신
     await updatePlayerStats(...)
     
     // 모든 클라이언트에게 브로드캐스트
     broadcast({
       type: 'game_over',
       winner, winningCells, gameId, ...
     })
   } else {
     // 일반 상태 브로드캐스트
     broadcast({
       type: 'game_state',
       board: canonicalState.board,
       currentPlayer: canonicalState.currentPlayer,
       ...
     })
   }

└─────────────────────────────────────────────────────────────┘
```

### 액션 유효성 검증 (서버)

```javascript
function validateAction(action, state) {
  // 공통 검증
  if (!state.gameStarted || state.gameOver) return false;
  
  switch (action.type) {
    case 'PLACE':
      const { cell } = action.payload;
      if (!inBounds(cell.x, cell.y)) return false;
      if (state.board[cell.y][cell.x] !== 0) return false;
      return true;
      
    case 'ACTIVATE_ITEM':
      const { itemId } = action.payload;
      if (!state.inventories[state.currentPlayer][itemId]) return false;
      return true;
      
    case 'ITEM_CLICK':
      const { cell: targetCell, itemId: activeItemId } = action.payload;
      if (state.activeItem !== activeItemId) return false;
      if (!inBounds(targetCell.x, targetCell.y)) return false;
      // 아이템별 추가 검증...
      return true;
      
    default:
      return false;
  }
}
```

---

## 동시성 제어

### 문제점
플레이어 1과 2가 동시에 액션을 보냈을 때, 서버가 어느 것을 먼저 실행할 것인가?

### 해법: Strict Turn-Based + ActionSeq
```
- actionSeq: 클라이언트가 0부터 시작해 증가시키는 로컬 액션 번호
- serverActionCount: 서버의 처리된 액션 총 개수
  
클라이언트가 actionSeq=42를 보냄 (로컬 actionCount=40일 때)
→ 서버가 받았을 때 canonical actionCount=40인가 확인
→ 맞으면 처리, 아니면 stale 응답 (클라이언트가 서버 상태를 받고 초기화)
```

### Stale Action 처리
```json
{
  "type": "action_result",
  "status": "stale",
  "serverActionCount": 41,
  "gameState": { /* 현재 서버 상태 */ },
  "message": "Your action is ahead of server state. Syncing..."
}
```
→ 클라이언트: 서버 gameState를 받고 로컬을 초기화한 뒤 필요시 재전송

### 같은 차례 두 플레이어가 동시에 액션
- Player 1이 먼저 도착 → 처리, actionCount++
- Player 2가 도착 → stale 응답 (actionCount 안 맞음)
- Player 2가 gameState 받고 초기화 → 다음 차례니까 자동으로 자기 차례가 됨

---

## 재검증 체크리스트 (서버)

모든 액션에 대해:
- [ ] `playerId`와 `playerToken` 유효한가
- [ ] 게임이 시작됨 & 게임오버 아님
- [ ] 현재 차례가 이 플레이어인가
- [ ] `actionSeq`가 맞음 (스킵 없음)

PLACE:
- [ ] 셀이 보드 범위 내
- [ ] 셀이 비어있음

ACTIVATE_ITEM:
- [ ] 아이템이 인벤토리에 있음
- [ ] 게임오버 아님

ITEM_CLICK:
- [ ] 아이템이 활성화됨
- [ ] 셀이 보드 범위 내
- [ ] 아이템별 추가 규칙

TIME_STONE_CONFIRM:
- [ ] 아이템이 활성화됨
- [ ] dieRoll 서버에서 1~6 생성

---

---

## 승/패 처리

### 게임 오버 조건

#### 1. 5연속 (승리)
```javascript
// reducer.js의 findWinningLine()이 감지
if (winningCells.length >= 5) {
  gameOver = true;
  winner = currentPlayer;
  reason = "five_in_a_row";
}
```

#### 2. 보드 가득참 (무승부)
```javascript
if (isBoardFull(board)) {
  gameOver = true;
  winner = null;  // 무승부
  reason = "board_full";
}
```

### 게임 기록 저장

#### 데이터베이스 스키마
```sql
CREATE TABLE games (
  id UUID PRIMARY KEY,
  sessionId VARCHAR(50) UNIQUE,
  createdAt TIMESTAMP,
  endedAt TIMESTAMP,
  playerCount INT,
  fiftyFiftyMode BOOLEAN,
  
  winner INT NULL,        -- 우승자 playerNumber (1~12, NULL면 무승부)
  reason VARCHAR(50),     -- 'five_in_a_row' | 'board_full'
  winningCells JSON,      -- [{ x, y }, ...]
  
  finalBoard JSON,        -- 최종 보드 상태
  totalTurns INT,
  
  createdBy VARCHAR(255)  -- 게임 생성자 ID (선택)
);

CREATE TABLE game_players (
  id UUID PRIMARY KEY,
  gameId UUID REFERENCES games(id),
  playerId VARCHAR(255),
  playerNumber INT,       -- 1~12 (현재 차례)
  playerName VARCHAR(255),
  
  won BOOLEAN,            -- 이 플레이어가 이겼는가
  placement INT NULL,     -- 최종 순위 (winner=1, 무승부면 NULL)
  
  UNIQUE (gameId, playerId)
);

CREATE TABLE turn_history (
  id UUID PRIMARY KEY,
  gameId UUID REFERENCES games(id),
  turnNum INT,
  playerId VARCHAR(255),
  playerNumber INT,
  action JSON,            -- { type, payload }
  boardAfter JSON,
  timestamp TIMESTAMP,
  
  UNIQUE (gameId, turnNum)
);
```

#### 게임 저장 로직
```javascript
// 게임오버 감지 시
async function saveGameRecord(gameState, players) {
  const game = await db.games.create({
    sessionId: gameState.sessionId,
    createdAt: gameState.createdAt,
    endedAt: new Date(),
    playerCount: gameState.playerCount,
    fiftyFiftyMode: gameState.fiftyFifty,
    
    winner: gameState.winner,
    reason: gameState.reason,  // 'five_in_a_row' | 'board_full'
    winningCells: gameState.winningCells,
    
    finalBoard: gameState.board,
    totalTurns: gameState.history.length,
  });

  // 각 플레이어 기록
  for (const player of players) {
    await db.game_players.create({
      gameId: game.id,
      playerId: player.playerId,
      playerNumber: player.playerNumber,
      playerName: player.playerName,
      won: gameState.winner === player.playerNumber,
      placement: gameState.winner === player.playerNumber ? 1 : null,
    });
  }

  // 전체 턴 히스토리
  for (const [i, turn] of gameState.history.entries()) {
    await db.turn_history.create({
      gameId: game.id,
      turnNum: i,
      playerId: players[turn.player - 1].playerId,
      playerNumber: turn.player,
      action: turn.action,
      boardAfter: gameState.board,  // 또는 각 턴 후 보드
      timestamp: new Date(),
    });
  }

  return game.id;
}
```

### 플레이어 통계

#### 데이터베이스
```sql
CREATE TABLE player_stats (
  playerId VARCHAR(255) PRIMARY KEY,
  playerName VARCHAR(255),
  
  gamesPlayed INT DEFAULT 0,
  gamesWon INT DEFAULT 0,
  winRate DECIMAL(5, 2),       -- 승률 %
  
  totalTurns INT DEFAULT 0,
  averageTurnsPerGame DECIMAL(7, 2),
  
  lastGameAt TIMESTAMP,
  
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

#### 갱신 로직
```javascript
async function updatePlayerStats(playerId, gameResult) {
  const stats = await db.player_stats.findOrCreate(playerId);
  
  stats.gamesPlayed += 1;
  if (gameResult.won) stats.gamesWon += 1;
  stats.winRate = (stats.gamesWon / stats.gamesPlayed * 100).toFixed(2);
  
  stats.totalTurns += gameResult.totalTurns;
  stats.averageTurnsPerGame = (stats.totalTurns / stats.gamesPlayed).toFixed(2);
  
  stats.lastGameAt = new Date();
  await stats.save();
}
```

### 게임 종료 플로우

#### 서버
```javascript
// 1. reducer에서 gameOver 감지
if (newState.gameOver) {
  
  // 2. 게임 기록 저장
  const recordedGameId = await saveGameRecord(newState, connectedPlayers);
  
  // 3. 플레이어 통계 갱신
  for (const player of connectedPlayers) {
    const won = newState.winner === player.playerNumber;
    await updatePlayerStats(player.playerId, {
      won,
      totalTurns: newState.history.length,
    });
  }
  
  // 4. 모든 클라이언트에게 브로드캐스트
  broadcast({
    type: 'game_over',
    winner: newState.winner,
    winningCells: newState.winningCells,
    reason: newState.reason,
    gameId: recordedGameId,
    finalStats: {
      [playerId1]: { gamesWon: 15, winRate: 53.2 },
      [playerId2]: { gamesWon: 14, winRate: 48.3 },
    }
  });
}
```

#### 클라이언트
```javascript
// WebSocket 수신
socket.on('game_over', (msg) => {
  console.log(`Player ${msg.winner} wins!`);
  
  // UI 표시
  setGameOver(true);
  setWinner(msg.winner);
  setWinningCells(msg.winningCells);
  
  // 플레이어 통계 표시
  setFinalStats(msg.finalStats);
  
  // 게임 기록 링크 제공
  // → /replays/{gameId}로 재관전 가능
});
```

### 게임 목록 & 통계 조회 API

#### 플레이어 프로필
```
GET /api/players/:playerId/stats
Response: {
  playerId,
  playerName,
  gamesPlayed,
  gamesWon,
  winRate,
  averageTurnsPerGame,
  lastGameAt,
  recentGames: [
    { gameId, opponent, won, date }
  ]
}
```

#### 게임 재관전 (선택사항)
```
GET /api/games/:gameId/replay
Response: {
  players,
  turnHistory: [
    { turnNum, action, boardAfter, timestamp }
  ],
  winner,
  reason
}
```

---

## 저장 & 플레이백

### 게임 기록 구조
```json
{
  "gameId": "game_123",
  "sessionId": "session_abc",
  "createdAt": "2026-07-10T12:34:56Z",
  "endedAt": "2026-07-10T12:45:30Z",
  
  "players": [
    { "playerId": "p1", "playerNumber": 1, "playerName": "Alice", "won": true },
    { "playerId": "p2", "playerNumber": 2, "playerName": "Bob", "won": false }
  ],
  
  "settings": {
    "playerCount": 2,
    "fiftyFiftyMode": false,
    "boardSize": 19
  },
  
  "result": {
    "winner": 1,
    "reason": "five_in_a_row",
    "winningCells": [ { "x": 9, "y": 9 }, ... ]
  },
  
  "turnHistory": [
    {
      "turnNum": 0,
      "playerId": "p1",
      "playerNumber": 1,
      "action": { "type": "PLACE", "payload": { "cell": { "x": 9, "y": 9 } } },
      "timestamp": "2026-07-10T12:34:58Z"
    },
    ...
  ]
}
```

→ 게임 끝 후 저장 + 재관전 지원

---

---

## Database 설계

### 게임 세션
```sql
CREATE TABLE game_sessions (
  id VARCHAR(50) PRIMARY KEY,
  createdAt TIMESTAMP,
  recordedGameId UUID UNIQUE REFERENCES games(id) ON DELETE SET NULL,
  
  status VARCHAR(20),        -- 'waiting' | 'in_progress' | 'finished'
  playerCount INT,
  fiftyFiftyMode BOOLEAN,
  currentPlayerNumber INT,
  
  board JSON,                -- 현재 보드 상태
  history JSON,              -- 전체 턴 히스토리
  gameOver BOOLEAN DEFAULT false,
  winner INT NULL,
  
  actionCount INT DEFAULT 0  -- 처리된 액션 총 개수 (동시성 제어)
);

CREATE TABLE game_session_players (
  id UUID PRIMARY KEY,
  sessionId VARCHAR(50) REFERENCES game_sessions(id) ON DELETE CASCADE,
  playerId VARCHAR(255),
  playerNumber INT,          -- 1~12 (착수 순서)
  playerName VARCHAR(255),
  playerToken VARCHAR(255) UNIQUE,  -- 세션별 일회용 토큰
  
  connectedAt TIMESTAMP,
  lastSeenAt TIMESTAMP,
  
  UNIQUE (sessionId, playerId)
);
```

### 게임 기록 (위에서 정의한 대로)
```sql
games, game_players, turn_history  -- 승/패 처리 섹션 참조
```

### 플레이어 통계
```sql
player_stats  -- 승/패 처리 섹션 참조
```

### 데이터베이스 초기화
```javascript
const Knex = require('knex');

const db = Knex({
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'omok',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'omok_game',
  }
});

module.exports = db;
```

---

## 보안

### 필수 조치

#### 1. Player Token 검증
```javascript
// 게임 참여 시 생성
const playerToken = crypto.randomBytes(32).toString('hex');
await db.game_session_players.create({
  sessionId, playerId, playerToken, ...
});

// WebSocket 연결 시 검증
function authenticateConnection(sessionId, playerId, playerToken) {
  const record = await db.game_session_players.findOne({
    sessionId, playerId, playerToken
  });
  if (!record) throw new Error('Unauthorized');
  return record;
}

// 모든 액션 전에 검증
ws.on('message', async (msg) => {
  const auth = authenticateConnection(msg.sessionId, msg.playerId, msg.playerToken);
  if (!auth) return ws.send({ error: 'Unauthorized' });
  // ... 처리
});
```

#### 2. HTTPS + Secure WebSocket (WSS)
```javascript
// Express
const https = require('https');
const fs = require('fs');
const app = require('./app');

https.createServer({
  cert: fs.readFileSync('cert.pem'),
  key: fs.readFileSync('key.pem'),
}, app).listen(443);

// WebSocket (secure)
const server = https.createServer(...);
const io = require('socket.io')(server, {
  secure: true,
  rejectUnauthorized: false
});
```

#### 3. Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const actionLimiter = rateLimit({
  windowMs: 1000,       // 1초
  max: 10,              // 최대 10개 액션/초
  message: 'Too many actions, please slow down'
});

app.post('/api/games/:sessionId/action', actionLimiter, (req, res) => {
  // ...
});

// WebSocket도 rate limit
const wsRateLimit = new Map();
ws.on('message', (msg) => {
  const key = `${sessionId}_${playerId}`;
  const count = (wsRateLimit.get(key) || 0) + 1;
  wsRateLimit.set(key, count);
  
  if (count > 10) {
    return ws.send({ error: 'Rate limited' });
  }
  
  setTimeout(() => {
    const current = wsRateLimit.get(key) || 1;
    wsRateLimit.set(key, Math.max(0, current - 10));
  }, 1000);
  
  // ... 처리
});
```

#### 4. Server-Side Random (필수)
```javascript
// 서버만 난수 생성
const steal_stone_success = Math.random() < 0.3;

// 클라이언트가 보낸 `stealRoll` 무시
const action = {
  type: 'ITEM_CLICK',
  payload: {
    itemId: 'steal_stone',
    cell: { x: 5, y: 5 },
    stealRoll: true  // ← 이거 무시, 서버가 다시 생성
  }
};

// 서버에서 강제로 덮어씀
const serverAction = {
  ...action,
  payload: {
    ...action.payload,
    stealRoll: Math.random() < 0.3  // 서버 난수
  }
};
```

#### 5. Input Validation
```javascript
function validateAction(action) {
  // 액션 타입 확인
  if (!['PLACE', 'ACTIVATE_ITEM', 'ITEM_CLICK', ...].includes(action.type)) {
    throw new Error('Invalid action type');
  }
  
  // 셀 범위 확인
  if (action.payload.cell) {
    const { x, y } = action.payload.cell;
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new Error('Cell coordinates must be integers');
    }
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) {
      throw new Error('Cell out of bounds');
    }
  }
  
  // JSON 크기 제한
  const maxSize = 1024;  // 1KB
  if (JSON.stringify(action).length > maxSize) {
    throw new Error('Action too large');
  }
  
  return true;
}
```

#### 6. 연결 타임아웃
```javascript
const CONNECTION_TIMEOUT = 5 * 60 * 1000;  // 5분

for (const [sessionId, room] of activeSessions) {
  for (const [playerId, ws] of room.players) {
    const lastSeen = room.playerLastSeen.get(playerId);
    if (Date.now() - lastSeen > CONNECTION_TIMEOUT) {
      ws.close();
      room.removePlayer(playerId);
    }
  }
}

setInterval(checkTimeouts, 30000);  // 30초마다 체크
```

---

## 에러 처리

### 서버 → 클라이언트 에러 응답
```json
{
  "type": "error",
  "code": "INVALID_ACTION" | "STALE_STATE" | "UNAUTHORIZED" | "RATE_LIMITED",
  "message": "Human-readable error message",
  "details": {}
}
```

### 클라이언트 처리
```javascript
ws.on('message', (msg) => {
  if (msg.type === 'error') {
    switch (msg.code) {
      case 'STALE_STATE':
        // 서버 상태로 초기화 + 재시도
        syncWithServer(msg.gameState);
        break;
      case 'RATE_LIMITED':
        // 경고 표시, 사용자가 더 느리게 플레이하도록 유도
        showWarning('You are playing too fast');
        break;
      case 'UNAUTHORIZED':
        // 세션 만료, 다시 로그인
        redirectToLogin();
        break;
      default:
        console.error('Unknown error:', msg);
    }
  }
});
```

---

## 구현 체크리스트

### Phase 1: 기본 서버 & DB (1주)
- [ ] Node.js/Express 프로젝트 초기화
- [ ] PostgreSQL 데이터베이스 생성 및 테이블 마이그레이션
- [ ] 간단한 REST API 엔드포인트
  - [ ] `POST /api/games` (게임 생성)
  - [ ] `POST /api/games/:sessionId/join` (게임 참여)
- [ ] WebSocket 연결 기본 구조 (`socket.io` 또는 `ws`)
- [ ] Player Token 생성 및 검증

### Phase 2: 게임 상태 동기화 (1-2주)
- [ ] 서버의 canonical `gameReducer` 구현 (클라이언트와 동일)
- [ ] WebSocket 액션 핸들러
  - [ ] `action` 메시지 수신 → 검증 → reducer 실행
  - [ ] `action_result` 응답 (ok / invalid / stale)
  - [ ] `game_state` 브로드캐스트
- [ ] 동시성 제어 (`actionCount` 기반)
- [ ] Rate limiting

### Phase 3: 게임 오버 & 기록 (1주)
- [ ] 게임 오버 감지 → `games` 테이블 저장
- [ ] 플레이어 통계 (`player_stats`) 갱신
- [ ] `turn_history` 저장 (재관전용)
- [ ] `game_over` 메시지 브로드캐스트

### Phase 4: 클라이언트 통합 (2주)
- [ ] WebSocket 클라이언트 라이브러리 (socket.io-client)
- [ ] `useGameEngine` 수정: 로컬 reducer + 서버 dispatch
  - [ ] 낙관적 업데이트
  - [ ] stale action 처리
  - [ ] 네트워크 상태 표시
- [ ] 게임 생성/참여 UI
- [ ] 게임 로비 UI (대기 중인 플레이어 목록)
- [ ] 게임 오버 화면 (최종 통계)

### Phase 5: 선택사항
- [ ] 게임 재관전 기능 (`GET /api/games/:gameId/replay`)
- [ ] 플레이어 프로필 & 통계 페이지
- [ ] 리더보드 / 순위
- [ ] 채팅 (같은 방의 플레이어들)
- [ ] AI 봇 (자동 플레이)

---

## 배포 체크리스트

### 개발 환경
```bash
# .env
DB_HOST=localhost
DB_PORT=5432
DB_USER=omok
DB_PASSWORD=secret
DB_NAME=omok_game

NODE_ENV=development
PORT=5000
WS_URL=ws://localhost:5000/ws
```

### 프로덕션 환경
```bash
# .env.production
DB_HOST=db.example.com
DB_PORT=5432
DB_USER=omok_prod
DB_PASSWORD=<strong password>
DB_NAME=omok_prod

NODE_ENV=production
PORT=443
WS_URL=wss://omok.example.com/ws

HTTPS_CERT=/etc/ssl/certs/omok.pem
HTTPS_KEY=/etc/ssl/private/omok-key.pem
```

### 서버 배포
1. [ ] Docker 이미지 빌드
2. [ ] PostgreSQL 백업 전략
3. [ ] 로깅 설정 (Winston, Pino 등)
4. [ ] 모니터링 설정 (신우 언제 내려가는지 감시)
5. [ ] CI/CD 파이프라인

### 클라이언트 배포
1. [ ] `npm run build` (Vite)
2. [ ] 빌드 결과물을 서버에 serve (`/dist` 폴더)
3. [ ] CDN 캐싱 설정 (`.js`, `.css`)

---

## 아키텍처 다이어그램

```
┌────────────────────────────────────────────────────────────┐
│                      클라이언트 (Browser)                    │
├────────────────────────────────────────────────────────────┤
│  React + Vite                                              │
│  ├─ useGameEngine (로컬 state)                             │
│  ├─ WebSocket client (socket.io-client)                   │
│  └─ UI Components                                          │
└────────────────────────────────────────────────────────────┘
           ↕ (WebSocket: wss://...)
┌────────────────────────────────────────────────────────────┐
│                      서버 (Node.js/Express)                 │
├────────────────────────────────────────────────────────────┤
│  ├─ HTTP API (게임 생성/참여)                              │
│  ├─ WebSocket Handler (socket.io)                         │
│  │  ├─ 액션 검증                                          │
│  │  ├─ gameReducer (canonical state)                      │
│  │  └─ 모든 플레이어에게 브로드캐스트                       │
│  └─ Game Service                                           │
│     ├─ saveGameRecord()                                    │
│     └─ updatePlayerStats()                                │
└────────────────────────────────────────────────────────────┘
           ↕ (PostgreSQL)
┌────────────────────────────────────────────────────────────┐
│                  PostgreSQL (Database)                      │
├────────────────────────────────────────────────────────────┤
│  game_sessions          (현재 게임)                         │
│  game_session_players   (플레이어 + 토큰)                   │
│  games                  (완료된 게임)                       │
│  game_players           (게임별 플레이어 기록)               │
│  turn_history           (턴 히스토리)                       │
│  player_stats           (플레이어 통계)                     │
└────────────────────────────────────────────────────────────┘
```
