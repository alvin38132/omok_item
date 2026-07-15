import { ITEMS_BY_ID } from '../game/items.js';

const ITEM_PRICES = {
  knight_move: 100,
  big_knight_move: 100,
  area_blast: 100,
  steal_stone: 100,
  hit_stone: 100,
  time_stone: 100,
};

export default function Lobby({ multiplayer }) {
  const ownInventory = multiplayer.ownShopInventory || { coins: 1000, boughtItems: [] };
  const allReady = multiplayer.players.every((p) => {
    // 실제로는 readyStatus를 추적해야 하지만, 간단하게 구현
    return true;
  });

  const handleBuyItem = async (itemId) => {
    await multiplayer.buyItem(itemId, ITEM_PRICES[itemId]);
  };

  const handleReady = async () => {
    await multiplayer.markReady();
  };

  const handleStartGame = async () => {
    await multiplayer.startGame();
  };

  return (
    <div className="lobby">
      <div className="lobby-header">
        <h2>게임 준비</h2>
        <div className="session-code">
          코드: <code>{multiplayer.sessionId}</code>
        </div>
      </div>

      <div className="lobby-content">
        {/* 플레이어 목록 */}
        <section className="lobby-section">
          <h3>플레이어 ({multiplayer.players.length}명)</h3>
          <div className="players-list">
            {multiplayer.players.map((player) => (
              <div key={player.playerNumber} className="player-item">
                <span className="player-name">{player.name}</span>
                <span className="player-number">Player {player.playerNumber}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 내 인벤토리 */}
        <section className="lobby-section">
          <h3>내 준비 상태</h3>
          <div className="inventory-info">
            {!multiplayer.isGuest && (
              <div className="coins-display">
                <span className="label">코인:</span>
                <span className="value">{ownInventory.coins}</span>
              </div>
            )}
            {multiplayer.isGuest && (
              <div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '8px' }}>
                🎮 게스트 모드
              </div>
            )}
            <div className="items-display">
              <span className="label">{multiplayer.isGuest ? '선택한 아이템' : '구매한 아이템'}:</span>
              <div className="bought-items">
                {ownInventory.boughtItems.length === 0 ? (
                  <span className="empty">아직 선택하지 않음</span>
                ) : (
                  ownInventory.boughtItems.map((itemId) => (
                    <span key={itemId} className="bought-item">
                      {ITEMS_BY_ID[itemId]?.name || itemId}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 아이템 가게 */}
        <section className="lobby-section">
          <h3>{multiplayer.isGuest ? '아이템 선택 (무료)' : '아이템 구매'}</h3>
          <div className="shop-grid">
            {Object.entries(ITEMS_BY_ID).map(([itemId, item]) => {
              const isBought = ownInventory.boughtItems.includes(itemId);
              const price = ITEM_PRICES[itemId];
              const canAfford = multiplayer.isGuest || ownInventory.coins >= price;

              return (
                <div key={itemId} className={`shop-item ${isBought ? 'bought' : ''}`}>
                  <div className="item-header">
                    <h4>{item.name}</h4>
                    {isBought && <span className="badge">선택함</span>}
                  </div>
                  <p className="item-desc">{item.desc}</p>
                  <div className="item-footer">
                    {!multiplayer.isGuest && <span className="price">{price} 코인</span>}
                    {multiplayer.isGuest && <span className="price">무료</span>}
                    <button
                      className="buy-btn"
                      onClick={() => handleBuyItem(itemId)}
                      disabled={isBought || !canAfford || multiplayer.buyingItemId === itemId}
                    >
                      {isBought
                        ? '선택함'
                        : !canAfford
                          ? '부족'
                          : multiplayer.buyingItemId === itemId
                            ? '진행중...'
                            : multiplayer.isGuest
                              ? '선택'
                              : '구매'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* 에러 메시지 */}
      {multiplayer.error && <div className="lobby-error">{multiplayer.error}</div>}

      {/* 액션 버튼 */}
      <div className="lobby-actions">
        <button className="ready-btn" onClick={handleReady} disabled={multiplayer.ready}>
          {multiplayer.ready ? '준비 완료' : '준비 완료'}
        </button>
        <button
          className="start-btn"
          onClick={handleStartGame}
          disabled={!allReady || multiplayer.starting}
        >
          {multiplayer.starting ? '시작중...' : '게임 시작'}
        </button>
      </div>
    </div>
  );
}
