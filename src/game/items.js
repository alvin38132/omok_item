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
    desc: '빈 곳 두 칸을 날일자 간격으로 고릅니다.',
    actionType: 'click_board',
  },
  {
    id: 'big_knight_move',
    name: '큰 날일자',
    desc: '빈 곳 두 칸을 더 긴 날일자 간격으로 고릅니다.',
    actionType: 'click_board',
  },
  {
    id: 'area_blast',
    name: '폭발',
    desc: '내 돌 하나를 중심으로 주변 8칸까지 비웁니다.',
    actionType: 'click_board',
  },
  {
    id: 'steal_stone',
    name: '강탈',
    desc: '상대 돌 하나를 30% 확률로 내 돌로 바꿉니다.',
    actionType: 'click_board',
  },
  {
    id: 'time_stone',
    name: '시간석',
    desc: '주사위가 짝수면 이번 차례를 한 번 더 진행하고, 홀수면 실패합니다.',
    actionType: 'confirm',
  },
  {
    id: 'hit_stone',
    name: '알까기',
    desc: '빈 시작점을 고른 뒤 가로 또는 세로 방향으로 돌을 밀어냅니다.',
    actionType: 'click_board',
  },
];

export const ITEM_PRICES = {
  knight_move: 200,
  big_knight_move: 250,
  area_blast: 150,
  steal_stone: 180,
  hit_stone: 300,
  time_stone: 200,
};

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
