// Item catalog. Each item is usable once per player, per game.
//
// actionType:
//   'click_board' — activating the item enters a targeting mode; the player
//                   then clicks the board to apply it.
//   'instant'     — the effect fires immediately on activation.

export const ITEMS = [
  {
    id: 'line_clear',
    name: 'Line Clear',
    desc: 'Choose a cell to clear all stones in a row, column, or diagonal line.',
    actionType: 'click_board',
  },
  {
    id: 'knight_move',
    name: "Knight's Move",
    desc: "Place 2 stones in a Knight's move shape (날일자).",
    actionType: 'click_board',
  },
  {
    id: 'big_knight_move',
    name: "Big Knight's Move",
    desc: "Place 2 stones in a Large Knight's move shape (눈목자).",
    actionType: 'click_board',
  },
  {
    id: 'shared_stone',
    name: 'Wildcard Stone',
    desc: 'Place a shared stone (★) that counts for any player.',
    actionType: 'click_board',
  },
  {
    id: 'area_blast',
    name: 'Area Blast',
    desc: 'Select one of your stones to delete it and all 8 surrounding cells.',
    actionType: 'click_board',
  },
  {
    id: 'random_flip',
    name: 'Random Flip',
    desc: 'Immediately invert ownership of 30% of all stones randomly.',
    actionType: 'instant',
  },
  {
    id: 'steal_stone',
    name: 'Stone Steal',
    desc: "Select an opponent's stone: 30% chance to turn it into your own.",
    actionType: 'click_board',
  },
];

export const ITEMS_BY_ID = Object.fromEntries(ITEMS.map((item) => [item.id, item]));

// Knight's move offsets (dx, dy) relative to the first stone.
export const KNIGHT_OFFSETS = [
  [-1, -2], [1, -2], [-2, -1], [2, -1],
  [-2, 1], [2, 1], [-1, 2], [1, 2],
];

// Big knight's move offsets.
export const BIG_KNIGHT_OFFSETS = [
  [-1, -3], [1, -3], [-3, -1], [3, -1],
  [-3, 1], [3, 1], [-1, 3], [1, 3],
];
