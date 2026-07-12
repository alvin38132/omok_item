// Color helpers shared between canvas rendering and HTML stone chips.

import { COLORS } from './constants.js';

// Resolve the display color for a given player number.
export function playerColor(player) {
  return COLORS[(player - 1) % COLORS.length];
}

export function playerTextColor(player) {
  return player === 2 ? '#111111' : '#ffffff';
}

// Lighten (amount > 0) or darken (amount < 0) a #rrggbb hex color.
export function shadeColor(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const adjust = (channel) =>
    Math.round(Math.max(0, Math.min(255, channel * (1 + amount))));

  const r = value >> 16;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
}
