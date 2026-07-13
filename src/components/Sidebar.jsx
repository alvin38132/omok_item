// The right-hand control panel: title, turn card, status, items and the
// "New game" button.

import TurnCard from './TurnCard.jsx';
import ItemsPanel from './ItemsPanel.jsx';
import PlayerList from './PlayerList.jsx';

export default function Sidebar({
  state,
  multiplayer,
  canAct,
  enoughPlayers,
  onActivateItem,
  onNewGame,
}) {
  const { gameStarted, currentPlayer, gameOver, status } = state;
  const displayStatus = multiplayer.error
    ? { message: multiplayer.error, kind: 'error' }
    : !multiplayer.connected
      ? { message: '서버 연결이 끊어졌습니다.', kind: 'error' }
      : !enoughPlayers
        ? { message: '상대가 참가하기를 기다리는 중입니다.', kind: '' }
        : !canAct && !gameOver
          ? { message: `상대 차례입니다. 현재 ${currentPlayer === 1 ? '흑' : '백'}이 둡니다.`, kind: '' }
          : status;

  const kicker = multiplayer.connected ? '온라인 대국' : '연결 끊김';

  const copySessionId = () => {
    if (multiplayer.sessionId) navigator.clipboard?.writeText(multiplayer.sessionId);
  };

  return (
    <aside className="sidebar">
      <p className="kicker">{kicker}</p>
      <h1>아이템 오목</h1>

      <div className="session-panel">
        <div>
          <span className="small-label">게임 코드</span>
          <strong>{multiplayer.sessionId || '-'}</strong>
        </div>
        <button type="button" className="secondary compact" onClick={copySessionId}>
          코드 복사
        </button>
      </div>

      <div className="small-label player-list-title">접속 플레이어</div>
      <PlayerList
        playerCount={state.playerCount}
        currentPlayer={currentPlayer}
        gameOver={gameOver}
        players={multiplayer.players}
        ownPlayerNumber={multiplayer.playerNumber}
      />

      <TurnCard currentPlayer={currentPlayer} gameOver={gameOver} />

      <div className={`status ${displayStatus.kind || ''}`} role="status">
        {displayStatus.message}
      </div>

      <div className="small-label legend-title">
        보유 아이템
      </div>
      {gameStarted && (
        <ItemsPanel
          inventory={state.inventories[currentPlayer]}
          activeItem={state.activeItem}
          gameOver={gameOver}
          disabled={!canAct}
          onActivate={onActivateItem}
        />
      )}

      <div className="actions">
        <button id="newGame" type="button" onClick={onNewGame}>
          대국 나가기
        </button>
      </div>
    </aside>
  );
}
