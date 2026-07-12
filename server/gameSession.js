import { gameReducer, initialState } from '../src/game/reducer.js';

export class GameSession {
  constructor(sessionId, playerCount) {
    this.sessionId = sessionId;
    this.playerCount = playerCount;
    this.state = { ...initialState };
    this.players = new Map(); // { playerNumber -> { socketId, name } }
    this.nextPlayerNumber = 1;

    // Start the game immediately
    this.dispatch({ type: 'START_GAME', playerCount, fiftyFifty: false });
  }

  addPlayer(socketId, name = `Player ${this.nextPlayerNumber}`) {
    const playerNumber = this.nextPlayerNumber;
    this.players.set(playerNumber, { socketId, name });
    this.nextPlayerNumber++;
    return playerNumber;
  }

  removePlayer(playerNumber) {
    this.players.delete(playerNumber);
  }

  dispatch(action) {
    this.state = gameReducer(this.state, action);
    return this.state;
  }

  getState() {
    return this.state;
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
