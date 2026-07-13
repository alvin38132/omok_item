// Sidebar list of players in turn order, highlighting the active one.

import Stone from './Stone.jsx';

export default function PlayerList({
  playerCount,
  currentPlayer,
  gameOver,
  players = [],
  ownPlayerNumber,
}) {
  return (
    <div className="players" aria-label="차례 순서">
      {Array.from({ length: playerCount }, (_, i) => {
        const player = i + 1;
        const connection = players.find((item) => item.playerNumber === player);
        const active = !gameOver && player === currentPlayer;
        return (
          <div key={player} className={`player-chip${active ? ' active' : ''}`}>
            <Stone player={player} />
            <span>
              {connection?.name || `${player === 1 ? '흑' : '백'} 자리 비어 있음`}
              {player === ownPlayerNumber ? ' (나)' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
