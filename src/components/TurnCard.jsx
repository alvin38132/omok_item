// The "current turn" card at the top of the sidebar.

import { playerColor } from '../game/colors.js';

export default function TurnCard({ currentPlayer, gameOver }) {
  return (
    <div className="turn-card">
      <div
        className="turn-stone"
        aria-hidden="true"
        style={{ background: playerColor(currentPlayer) }}
      >
        {currentPlayer}
      </div>
      <div>
        <div className="small-label">Current turn</div>
        <div id="turnText">{gameOver ? 'Game over' : `Player ${currentPlayer}`}</div>
      </div>
    </div>
  );
}
