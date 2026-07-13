import { gameReducer, initialState } from '../src/game/reducer.js';
import { ITEMS_BY_ID } from '../src/game/items.js';

const INITIAL_COINS = 1000;
const ITEM_PRICES = {
  knight_move: 200,
  big_knight_move: 250,
  area_blast: 150,
  steal_stone: 180,
  hit_stone: 300,
  time_stone: 200,
};

export class GameSession {
  constructor(sessionId, playerCount) {
    this.sessionId = sessionId;
    this.playerCount = playerCount;
    this.state = initialState;
    this.players = new Map(); // { playerNumber -> { socketId, name } }
    this.playerInventories = {}; // { playerNumber -> { coins, boughtItems } }
    this.gameStarted = false;
    this.nextPlayerNumber = 1;
  }

  addPlayer(socketId, name = `Player ${this.nextPlayerNumber}`) {
    const playerNumber = this.nextPlayerNumber;
    this.players.set(playerNumber, { socketId, name });
    this.playerInventories[playerNumber] = {
      coins: INITIAL_COINS,
      boughtItems: new Set(),
    };
    this.nextPlayerNumber++;
    return playerNumber;
  }

  removePlayer(playerNumber) {
    this.players.delete(playerNumber);
    delete this.playerInventories[playerNumber];
  }

  buyItem(playerNumber, itemId) {
    if (!ITEMS_BY_ID[itemId]) {
      return { error: 'Item not found' };
    }
    const inv = this.playerInventories[playerNumber];
    if (!inv) {
      return { error: 'Player not found' };
    }
    if (inv.boughtItems.has(itemId)) {
      return { error: 'Already bought this item' };
    }
    const price = ITEM_PRICES[itemId];
    if (!price) {
      return { error: 'Item has no price' };
    }
    if (inv.coins < price) {
      return { error: 'Not enough coins' };
    }
    inv.coins -= price;
    inv.boughtItems.add(itemId);
    return { success: true, coins: inv.coins, boughtItems: Array.from(inv.boughtItems) };
  }

  startGame(playerNumber) {
    if (this.gameStarted) {
      return { error: 'Game already started' };
    }
    this.gameStarted = true;

    // Build inventories from bought items
    const inventories = {};
    for (let p = 1; p <= this.playerCount; p++) {
      inventories[p] = {};
      for (const itemId of Object.keys(ITEMS_BY_ID)) {
        inventories[p][itemId] = this.playerInventories[p]?.boughtItems.has(itemId) || false;
      }
    }

    this.state = gameReducer(initialState, {
      type: 'START_GAME',
      playerCount: this.playerCount,
      fiftyFifty: false,
      inventories,
    });
    return { success: true };
  }

  dispatch(action) {
    if (!this.gameStarted) {
      return { error: 'Game not started' };
    }
    this.state = gameReducer(this.state, action);
    return this.state;
  }

  getState() {
    return this.state;
  }

  getPlayerInventory(playerNumber) {
    const inv = this.playerInventories[playerNumber];
    return {
      coins: inv.coins,
      boughtItems: Array.from(inv.boughtItems),
      prices: ITEM_PRICES,
    };
  }

  isGameStarted() {
    return this.gameStarted;
  }

  isGameOver() {
    return this.state.gameOver;
  }

  getPlayers() {
    return Array.from(this.players.entries()).map(([num, data]) => ({
      playerNumber: num,
      ...data,
    }));
  }
}
