# Omok Multiplayer Server API

## 개요

- **서버 URL**: `http://11.190.49.96:3001`
- **WebSocket URL**: `ws://11.190.49.96:3001`
- **포트**: 3001

## REST API

### POST /api/games - 게임 생성

새로운 게임 세션을 생성합니다.

**요청:**
```json
{
  "playerCount": 2
}
```

**응답:**
```json
{
  "sessionId": "session-1",
  "state": { ... }
}
```

**파라미터:**
- `playerCount` (number, 기본값: 2): 플레이어 수 (2-12)

**응답 설명:**
- `sessionId`: 게임 세션 ID (WebSocket 연결 시 사용)
- `state`: 초기 게임 상태 (대기 상태)

**아이템 가격:**
```javascript
{
  knight_move: 200,
  big_knight_move: 250,
  area_blast: 150,
  steal_stone: 180,
  hit_stone: 300,
  time_stone: 200
}
```

---

### POST /api/purchase - 아이템 구매 결제

SADA Coin 결제를 통해 아이템을 구매합니다. 학생이 자신의 기기에서 승인해야 합니다.

**요청:**
```json
{
  "studentId": "2601",
  "itemId": "knight_move",
  "amount": 200
}
```

**응답:**
```json
{
  "requestId": 1,
  "sadaRequestId": 12,
  "status": "pending",
  "expiresAt": "2026-07-14T12:36:00"
}
```

**파라미터:**
- `studentId` (string): 학생 학번
- `itemId` (string): 아이템 ID
- `amount` (number): 결제 금액

---

### GET /api/purchase/:requestId - 결제 상태 조회

결제 요청의 상태를 조회합니다.

**응답:**
```json
{
  "requestId": 1,
  "status": "pending",
  "itemId": "knight_move",
  "amount": 200,
  "studentId": "2601"
}
```

**상태:**
- `pending` - 대기 중
- `approved` - 승인됨
- `rejected` - 거절됨
- `expired` - 만료됨

---

## WebSocket 이벤트

### 클라이언트 → 서버

#### join - 게임 입장

게임 세션에 플레이어로 참가합니다.

**발송:**
```javascript
socket.emit('join', { sessionId, name }, (response) => {
  // callback
})
```

**파라미터:**
- `sessionId` (string): POST /api/games에서 받은 sessionId
- `name` (string): 플레이어 이름

**응답 콜백:**
```json
{
  "playerNumber": 1,
  "state": { ... }
}
```

또는 에러:
```json
{
  "error": "Game not found"
}
```

---

#### ready - 준비 완료

게임 시작 준비를 완료했음을 알립니다. 모든 플레이어가 준비되어야 게임을 시작할 수 있습니다.

**발송:**
```javascript
socket.emit('ready', { sessionId }, (response) => {
  // callback
})
```

**파라미터:**
- `sessionId` (string): 게임 세션 ID

**응답 콜백:**
```json
{
  "ok": true
}
```

---

#### buy_item - 아이템 구매

게임 시작 전에 아이템을 구매합니다. 각 종류당 최대 1개씩만 구매 가능합니다.

**발송:**
```javascript
socket.emit('buy_item', { sessionId, itemId }, (response) => {
  // callback
})
```

**파라미터:**
- `sessionId` (string): 게임 세션 ID
- `itemId` (string): 구매할 아이템 ID

**응답 콜백:**
```json
{
  "ok": true,
  "coins": 800,
  "boughtItems": ["knight_move", "area_blast"]
}
```

또는 에러:
```json
{
  "error": "Not enough coins"
}
```

**가능한 에러:**
- `"Item not found"` - 존재하지 않는 아이템
- `"Already bought this item"` - 이미 구매한 아이템
- `"Not enough coins"` - 코인 부족

---

#### start_game - 게임 시작

아이템 구매가 끝나고 게임을 시작합니다.

**발송:**
```javascript
socket.emit('start_game', { sessionId }, (response) => {
  // callback
})
```

**파라미터:**
- `sessionId` (string): 게임 세션 ID

**응답 콜백:**
```json
{
  "ok": true
}
```

또는 에러:
```json
{
  "error": "모든 플레이어가 준비되지 않았습니다."
}
```

또는:
```json
{
  "error": "Game already started"
}
```

---

#### action - 액션 전송

게임 상태를 변경하는 액션을 전송합니다. 서버에서 reducer를 실행하고 모든 플레이어에게 결과를 브로드캐스트합니다.

**발송:**
```javascript
socket.emit('action', { sessionId, action }, (response) => {
  // callback
})
```

**파라미터:**
- `sessionId` (string): 게임 세션 ID
- `action` (object): 게임 액션 (reducer에 전달될 액션)

**응답 콜백:**
```json
{
  "ok": true
}
```

또는 에러:
```json
{
  "error": "Game not found"
}
```

**가능한 액션 타입:**

```javascript
// 게임 시작
{ type: 'START_GAME', playerCount: 2, fiftyFifty: false }

// 돌 놓기
{ type: 'PLACE', cell: { x: 9, y: 9 }, success: true }

// 아이템 활성화
{ type: 'ACTIVATE_ITEM', itemId: 'knight_move' }

// 아이템 취소
{ type: 'CANCEL_ITEM' }

// 셀 클릭 (아이템 사용)
{ type: 'ITEM_CLICK', cell: { x: 9, y: 9 }, roll: { success: true } }

// Time Stone 사용 (2,4,6 나오면 그 만큼 턴 되돌리기, 1,3,5는 꽝)
{ type: 'USE_TIME_STONE', roll: 4 }

// Hit Stone 애니메이션 시작
{ type: 'BEGIN_HIT_STONE_ANIMATION' }

// Hit Stone 해결
{ type: 'RESOLVE_HIT_STONE', plan: { ... } }
```

---

### 서버 → 클라이언트

#### state_updated - 상태 업데이트

액션이 처리되어 게임 상태가 변경되었습니다.

**수신:**
```javascript
socket.on('state_updated', (state) => {
  // state: 현재 게임 상태 (reducer 상태)
})
```

**상태 구조:**
```javascript
{
  board: [],                    // 19x19 게임판 (0 = 빈칸, 1-12 = 플레이어)
  playerCount: 2,
  currentPlayer: 1,
  history: [],                  // 턴 히스토리 [{ x, y, player, success }]
  gameOver: false,
  winningCells: [],            // 승리한 돌들의 좌표
  gameStarted: true,
  status: {
    message: '플레이어 1의 차례입니다.',
    kind: 'win' | 'error' | ''
  },
  failedFlash: null,           // { x, y } | null
  turnHistory: [],             // 이전 상태 스냅샷
  inventories: {               // { [player]: { [itemId]: available } }
    1: {
      knight_move: true,
      big_knight_move: true,
      area_blast: true,
      steal_stone: true,
      hit_stone: true,
      time_stone: true
    }
  },
  activeItem: null,            // 현재 활성화된 아이템
  itemState: {},               // 아이템 상태 (예: { firstCell })
  session: 1
}
```

---

#### players_updated - 플레이어 목록 업데이트

플레이어가 입장하거나 퇴장했을 때 발생합니다.

**수신:**
```javascript
socket.on('players_updated', (players) => {
  // players: 플레이어 배열
})
```

**플레이어 배열:**
```json
[
  {
    "playerNumber": 1,
    "socketId": "socket-id-123",
    "name": "Player 1"
  },
  {
    "playerNumber": 2,
    "socketId": "socket-id-456",
    "name": "Player 2"
  }
]
```

---

#### ready_status_updated - 준비 상태 업데이트

플레이어의 준비 상태가 변경되었습니다.

**수신:**
```javascript
socket.on('ready_status_updated', (readyStatus) => {
  // readyStatus: { playerNumber: boolean, ... }
})
```

**응답 구조:**
```json
{
  "1": true,
  "2": false
}
```

---

#### inventory_updated - 아이템 구매 업데이트

다른 플레이어가 아이템을 구매했을 때 발생합니다.

**수신:**
```javascript
socket.on('inventory_updated', (data) => {
  // data: 플레이어의 구매 정보
})
```

**응답 구조:**
```json
{
  "playerNumber": 1,
  "coins": 700,
  "boughtItems": ["knight_move", "area_blast", "steal_stone"]
}
```

---

#### game_over - 게임 종료

게임이 종료되었습니다 (승리 또는 무승부).

**수신:**
```javascript
socket.on('game_over', (data) => {
  // data: 게임 종료 정보
})
```

**응답 구조:**
```json
{
  "winningCells": [
    { "x": 9, "y": 9 },
    { "x": 10, "y": 9 },
    { "x": 11, "y": 9 },
    { "x": 12, "y": 9 },
    { "x": 13, "y": 9 }
  ],
  "status": {
    "message": "Player 1 connects five and wins!",
    "kind": "win"
  },
  "finalState": { ... }
}
```

---

## 데이터 타입

### Cell
```javascript
{
  x: number,  // 0-18
  y: number   // 0-18
}
```

### Item IDs
```javascript
'knight_move'      // 날일자 (1칸 x, 2칸 y 이동)
'big_knight_move'  // 눈목자 (1칸 x, 3칸 y 이동)
'area_blast'       // 폭발 (중심 주변 3x3 제거)
'steal_stone'      // 돌 빼앗기 (30% 성공율)
'hit_stone'        // 알까기 (방향 선택)
'time_stone'       // 시간 되돌리기 (주사위)
```

---

## 사용 예제

### 게임 시작 플로우

**1단계: 게임 생성**
```javascript
const res = await fetch('http://11.190.49.96:3001/api/games', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ playerCount: 2 })
});
const { sessionId, state } = await res.json();
```

**2단계: WebSocket 연결 및 게임 입장**
```javascript
import { io } from 'socket.io-client';

const socket = io('http://11.190.49.96:3001');

socket.on('connect', () => {
  socket.emit('join', { sessionId, name: 'Player 1' }, (response) => {
    if (response.error) {
      console.error('Failed to join:', response.error);
      return;
    }
    console.log('Joined as Player', response.playerNumber);
    console.log('Initial state:', response.state);
  });
});
```

**3단계: 이벤트 수신**
```javascript
socket.on('state_updated', (state) => {
  console.log('Game state updated:', state);
  // UI 업데이트
});

socket.on('players_updated', (players) => {
  console.log('Players:', players);
  // 플레이어 목록 업데이트
});

socket.on('inventory_updated', (data) => {
  console.log('Player', data.playerNumber, 'bought:', data.boughtItems);
  // 플레이어 아이템 구매 정보 업데이트
});

socket.on('ready_status_updated', (readyStatus) => {
  console.log('Ready status:', readyStatus);
  // 플레이어 준비 상태 업데이트
});

socket.on('game_over', (data) => {
  console.log('Game over:', data.status.message);
  // 게임 종료 처리
});
```

**4단계: 아이템 구매 (게임 시작 전)**
```javascript
// 아이템 구매
socket.emit('buy_item', {
  sessionId,
  itemId: 'knight_move'
}, (response) => {
  if (response.error) {
    console.error('Purchase failed:', response.error);
    return;
  }
  console.log('Remaining coins:', response.coins);
  console.log('Bought items:', response.boughtItems);
});

// 준비 완료
socket.emit('ready', { sessionId }, (response) => {
  if (response.error) {
    console.error('Ready failed:', response.error);
    return;
  }
  console.log('Ready!');
});

// 모든 플레이어가 준비 완료되면 게임 시작
socket.emit('start_game', { sessionId }, (response) => {
  if (response.error) {
    console.error('Start failed:', response.error);
    return;
  }
  console.log('Game started!');
  // state_updated 이벤트에서 게임 상태를 받게 됩니다
});
```

**5단계: 액션 전송 (게임 시작 후)**
```javascript
// 돌 놓기
socket.emit('action', {
  sessionId,
  action: { type: 'PLACE', cell: { x: 9, y: 9 }, success: true }
}, (response) => {
  if (response.ok) {
    console.log('Action sent successfully');
  }
});

// 아이템 활성화
socket.emit('action', {
  sessionId,
  action: { type: 'ACTIVATE_ITEM', itemId: 'knight_move' }
}, (response) => {
  if (response.ok) {
    console.log('Item activated');
  }
});
```

---

## 주의사항

- 모든 액션은 서버에서 검증되고 결과는 모든 플레이어에게 브로드캐스트됩니다.
- `state_updated` 이벤트를 받은 상태가 **현재 게임의 참 상태**입니다.
- 클라이언트의 로컬 상태가 서버 상태와 다를 수 있으므로, 서버에서 온 상태로 항상 동기화하세요.
- 게임판은 19×19이므로 좌표는 0-18 범위입니다.
- `playerNumber`는 1부터 시작하며, 플레이어마다 고유합니다.

---

## 서버 설정

### 환경 변수 (.env)

서버 디렉토리에 `.env` 파일을 생성하고 SADA Coin API Key를 설정하세요:

```
SADA_API_KEY=your_sada_coin_api_key
```

`.env.example` 파일을 참고하세요.

### 서버 실행

```bash
cd server
npm install
npm start
```

개발 모드:
```bash
npm run dev
```

---

## 배포 환경

프로덕션에서는:
- `http://11.190.49.96:3001` → `https://your-domain.com`
- `ws://11.190.49.96:3001` → `wss://your-domain.com`
- SADA_API_KEY는 환경 변수로 설정
