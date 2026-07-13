// The "Use Item" grid. Each item is available once per player, per game.

import { ITEMS } from '../game/items.js';

export default function ItemsPanel({ inventory, activeItem, gameOver, disabled, onActivate }) {
  return (
    <div className="items-grid" aria-label="보유 아이템">
      {ITEMS.map((item) => {
        const available = Boolean(inventory?.[item.id]);
        return (
          <button
            key={item.id}
            type="button"
            className={`item-btn${activeItem === item.id ? ' active' : ''}`}
            disabled={disabled || gameOver || !available}
            title={item.desc}
            onClick={(e) => {
              e.stopPropagation();
              onActivate(item.id);
            }}
          >
            <span className="item-name">{item.name}</span>
            <span className="item-count">{available ? '1회' : '사용함'}</span>
          </button>
        );
      })}
    </div>
  );
}
