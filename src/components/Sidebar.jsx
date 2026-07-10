// The right-hand control panel: title, turn card, status, players, items,
// stats and the "New game" button.

import TurnCard from './TurnCard.jsx';
import ItemsPanel from './ItemsPanel.jsx';
import Stats from './Stats.jsx';

export default function Sidebar({ state, stats, onActivateItem, onNewGame }) {
  const { gameStarted, fiftyFifty, currentPlayer, gameOver, status } = state;

  const kicker = !gameStarted
    ? 'Custom multiplayer'
    : fiftyFifty
      ? '50–50 multiplayer'
      : 'Classic multiplayer';

  return (
    <aside className="sidebar">
      <p className="kicker">{kicker}</p>
      <h1>
        Rainbow
        <br />
        Omok
      </h1>

      <br />

      <TurnCard currentPlayer={currentPlayer} gameOver={gameOver} />

      <div className={`status ${status.kind || ''}`} role="status">
        {status.message}
      </div>

      <br />

      <div className="small-label legend-title" style={{ marginTop: 15 }}>
        Use Item (Once per game)
      </div>
      {gameStarted && (
        <ItemsPanel
          inventory={state.inventories[currentPlayer]}
          activeItem={state.activeItem}
          gameOver={gameOver}
          onActivate={onActivateItem}
        />
      )}

      <Stats attempts={stats.attempts} placed={stats.placed} failed={stats.failed} />

      <div className="actions">
        <button id="newGame" type="button" onClick={onNewGame}>
          New game
        </button>
      </div>
    </aside>
  );
}
