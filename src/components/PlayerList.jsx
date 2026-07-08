// Sidebar list of players in turn order, highlighting the active one.

import Stone from './Stone.jsx';

export default function PlayerList({ playerCount, currentPlayer, gameOver }) {
  return (
    <div className="players" aria-label="Players in turn order">
      {Array.from({ length: playerCount }, (_, i) => {
        const player = i + 1;
        const active = !gameOver && player === currentPlayer;
        return (
          <div key={player} className={`player-chip${active ? ' active' : ''}`}>
            <Stone player={player} />
            <span>Player {player}</span>
          </div>
        );
      })}
    </div>
  );
}
