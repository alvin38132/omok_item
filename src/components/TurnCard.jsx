// The "current turn" card at the top of the sidebar.

import { playerColor } from '../game/colors.js';

const playerName = (player) => (player === 1 ? '흑' : '백');

export default function TurnCard({ currentPlayer, gameOver }) {
  return (
    <div className="turn-card">
      <div
        className="turn-stone"
        aria-hidden="true"
        style={{
          background: playerColor(currentPlayer),
        }}
      />
      <div>
        <div className="small-label">현재 차례</div>
        <div id="turnText">{gameOver ? '게임 종료' : playerName(currentPlayer)}</div>
      </div>
    </div>
  );
}
