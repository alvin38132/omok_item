// A small circular stone chip used in previews, the turn card and player list.

import { SHARED_STONE, RAINBOW_GRADIENT } from '../game/constants.js';
import { playerColor } from '../game/colors.js';

export default function Stone({ player, className = 'legend-stone' }) {
  const isShared = player === SHARED_STONE;
  return (
    <span
      className={className}
      style={{ background: isShared ? RAINBOW_GRADIENT : playerColor(player) }}
      aria-label={`Player ${player}`}
    >
      {isShared ? '★' : player}
    </span>
  );
}
