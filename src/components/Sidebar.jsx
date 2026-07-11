// The right-hand control panel: title, turn card, status, items and the
// "New game" button.

import TurnCard from './TurnCard.jsx';
import ItemsPanel from './ItemsPanel.jsx';

export default function Sidebar({ state, onActivateItem, onNewGame }) {
  const { gameStarted, currentPlayer, gameOver, status } = state;

  const kicker = gameStarted ? '대국 진행 중' : '대국 준비';

  return (
    <aside className="sidebar">
      <p className="kicker">{kicker}</p>
      <h1>아이템 오목</h1>

      <TurnCard currentPlayer={currentPlayer} gameOver={gameOver} />

      <div className={`status ${status.kind || ''}`} role="status">
        {status.message}
      </div>

      <div className="small-label legend-title">
        보유 아이템
      </div>
      {gameStarted && (
        <ItemsPanel
          inventory={state.inventories[currentPlayer]}
          activeItem={state.activeItem}
          gameOver={gameOver}
          onActivate={onActivateItem}
        />
      )}

      <div className="actions">
        <button id="newGame" type="button" onClick={onNewGame}>
          새 대국
        </button>
      </div>
    </aside>
  );
}
