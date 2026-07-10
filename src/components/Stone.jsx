// A small circular stone chip used in previews, the turn card and player list.

import { playerColor, playerTextColor } from '../game/colors.js';

const playerName = (player) => (player === 1 ? '흑' : '백');

export default function Stone({ player, className = 'legend-stone' }) {
  return (
    <span
      className={className}
      style={{
        background: playerColor(player),
        color: playerTextColor(player),
      }}
      aria-label={playerName(player)}
    >
      {player}
    </span>
  );
}
