// Item catalog. Each item is usable once per player, per game.
//
// actionType:
//   'click_board' - activating the item enters a targeting mode; the player
//                   then clicks the board to apply it.
//   'confirm'     - activating the item opens a confirmation dialog.

export const ITEMS = [
  {
    id: 'knight_move',
    name: '날일자',
    desc: '날일자 모양으로 돌 2개를 놓습니다.',
    actionType: 'click_board',
  },
  {
    id: 'big_knight_move',
    name: '큰 날일자',
    desc: '큰 날일자 모양으로 돌 2개를 놓습니다.',
    actionType: 'click_board',
  },
  {
    id: 'area_blast',
    name: '폭발석',
    desc: '내 돌 하나와 주변 8칸의 돌을 모두 제거합니다.',
    actionType: 'click_board',
  },
  {
    id: 'steal_stone',
    name: '빼앗기',
    desc: '상대 돌 하나를 선택해 30% 확률로 내 돌로 바꿉니다.',
    actionType: 'click_board',
  },
  {
    id: 'time_stone',
    name: '시간 되돌리기',
    desc: '주사위를 굴려 실패하거나 1, 2, 3차례를 되돌립니다.',
    actionType: 'confirm',
  },
  {
    id: 'hit_stone',
    name: '알까기',
    desc: '빈 시작점을 고른 뒤 가로 또는 세로 방향으로 돌을 밀어냅니다.',
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

// Hit Stone can slide horizontally or vertically.
export const HIT_DIRECTIONS = [
  [0, -1],
  [-1, 0], [1, 0],
  [0, 1],
];
