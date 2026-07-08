// Core game configuration and constants.

export const SIZE = 100;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;

// The board value used for the shared "wildcard" stone. It counts for every
// player when checking for a winning line.
export const SHARED_STONE = 99;

// Curated color palette for up to 12 players.
export const COLORS = [
  '#ef476f', // Red
  '#f07828', // Orange
  '#d6a600', // Yellow
  '#68ad38', // Light Green
  '#13a57a', // Green
  '#00a6a6', // Teal
  '#168de2', // Light Blue
  '#4361ee', // Blue
  '#7654d6', // Indigo
  '#a846d1', // Purple
  '#d83c9b', // Magenta
  '#b85c70', // Rose
];

// Rainbow fill used to represent the shared wildcard stone in HTML/CSS.
export const RAINBOW_GRADIENT =
  'linear-gradient(45deg, #ff5964, #ffd166, #06d6a0, #118ab2)';

// Default camera position (centered) and zoom gap in pixels.
export const DEFAULT_CAMERA = { x: 49.5, y: 49.5, gap: 38 };
