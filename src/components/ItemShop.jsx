import { ITEMS, ITEM_PRICES } from '../game/items.js';

export default function ItemShop({
  inventory,
  buyingItemId,
  starting,
  enoughPlayers,
  onBuy,
  onStart,
}) {
  const coins = inventory?.coins ?? 1000;
  const boughtItems = new Set(inventory?.boughtItems || []);
  const busy = Boolean(buyingItemId) || starting;

  return (
    <section className="item-shop" aria-labelledby="itemShopTitle">
      <div className="shop-heading">
        <div>
          <span className="small-label">대국 준비</span>
          <h2 id="itemShopTitle">아이템 상점</h2>
        </div>
        <div className="coin-balance" aria-label={`보유 코인 ${coins}`}>
          <span>보유 코인</span>
          <strong>{coins.toLocaleString()}</strong>
        </div>
      </div>

      <div className="shop-grid" aria-label="구매 가능한 아이템">
        {ITEMS.map((item) => {
          const price = ITEM_PRICES[item.id];
          const bought = boughtItems.has(item.id);
          const buying = buyingItemId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`shop-item${bought ? ' purchased' : ''}`}
              disabled={busy || bought || coins < price}
              title={item.desc}
              onClick={() => onBuy(item.id)}
            >
              <span className="item-name">{item.name}</span>
              <span className="shop-price">
                {buying ? '구매 중...' : bought ? '구매 완료' : `${price} 코인`}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="start-game-btn"
        disabled={!enoughPlayers || busy}
        onClick={onStart}
      >
        {starting ? '대국 시작 중...' : enoughPlayers ? '구매 완료 · 대국 시작' : '상대를 기다리는 중'}
      </button>
      <p className="shop-note">구매한 아이템만 이번 대국에서 한 번씩 사용할 수 있습니다.</p>
    </section>
  );
}
