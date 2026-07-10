// A small circular stone chip used in previews, the turn card and player list.

import { playerColor } from '../game/colors.js';

export default function Stone({ player, className = 'legend-stone' }) {
  return (
    <span
      className={className}
      style={{ background: playerColor(player) }}
      aria-label={`Player ${player}`}
    >
      {player}
    </span>
  );
}
