// The "current turn" card at the top of the sidebar.

import { SHARED_STONE, RAINBOW_GRADIENT } from '../game/constants.js';
import { playerColor } from '../game/colors.js';

export default function TurnCard({ currentPlayer, gameOver }) {
  const isShared = currentPlayer === SHARED_STONE;
  return (
    <div className="turn-card">
      <div
        className="turn-stone"
        aria-hidden="true"
        style={{ background: isShared ? RAINBOW_GRADIENT : playerColor(currentPlayer) }}
      >
        {isShared ? '★' : currentPlayer}
      </div>
      <div>
        <div className="small-label">Current turn</div>
        <div id="turnText">{gameOver ? 'Game over' : `Player ${currentPlayer}`}</div>
      </div>
    </div>
  );
}
