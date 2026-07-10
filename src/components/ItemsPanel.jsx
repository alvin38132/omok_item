// The "Use Item" grid. Each item is available once per player, per game.

import { ITEMS } from '../game/items.js';

export default function ItemsPanel({ inventory, activeItem, gameOver, onActivate }) {
  return (
    <div className="items-grid" aria-label="사용 가능한 아이템">
      {ITEMS.map((item) => {
        const available = Boolean(inventory?.[item.id]);
        return (
          <button
            key={item.id}
            type="button"
            className={`item-btn${activeItem === item.id ? ' active' : ''}`}
            disabled={gameOver || !available}
            title={item.desc}
            onClick={(e) => {
              e.stopPropagation();
              onActivate(item.id);
            }}
          >
            <span className="item-name">{item.name}</span>
            <span className="item-count">{available ? '사용 가능' : '사용 완료'}</span>
          </button>
        );
      })}
    </div>
  );
}
