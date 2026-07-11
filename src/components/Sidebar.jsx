// The right-hand control panel: title, turn card, status, players, items,
// stats and the "New game" button.

import TurnCard from './TurnCard.jsx';
import ItemsPanel from './ItemsPanel.jsx';
import Stats from './Stats.jsx';

export default function Sidebar({ state, stats, onActivateItem, onNewGame }) {
  const { gameStarted, currentPlayer, gameOver, status } = state;

  const kicker = gameStarted ? '2인 아이템 오목' : '새 게임 대기 중';

  return (
    <aside className="sidebar">
      <p className="kicker">{kicker}</p>
      <h1>
        아이템
        <br />
        오목
      </h1>

      <br />

      <TurnCard currentPlayer={currentPlayer} gameOver={gameOver} />

      <div className={`status ${status.kind || ''}`} role="status">
        {status.message}
      </div>

      <br />

      <div className="small-label legend-title" style={{ marginTop: 15 }}>
        아이템 (게임당 1회)
      </div>
      {gameStarted && (
        <ItemsPanel
          inventory={state.inventories[currentPlayer]}
          activeItem={state.activeItem}
          gameOver={gameOver}
          onActivate={onActivateItem}
        />
      )}

      <Stats attempts={stats.attempts} placed={stats.placed} />

      <div className="actions">
        <button id="newGame" type="button" onClick={onNewGame}>
          새 게임
        </button>
      </div>
    </aside>
  );
}
