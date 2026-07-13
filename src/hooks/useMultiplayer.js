import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { initialState } from '../game/reducer.js';

const SERVER_URL = 'http://11.190.49.96:3001';
const INITIAL_COINS = 1000;

const API_ERROR_MESSAGES = {
  'Game not found': '게임을 찾을 수 없습니다.',
  'Game not started': '아직 대국이 시작되지 않았습니다.',
  'Game already started': '이미 시작된 대국입니다.',
  'Item not found': '존재하지 않는 아이템입니다.',
  'Player not found': '플레이어 정보를 찾을 수 없습니다.',
  'Already bought this item': '이미 구매한 아이템입니다.',
  'Item has no price': '가격 정보가 없는 아이템입니다.',
  'Not enough coins': '코인이 부족합니다.',
};

function apiErrorMessage(message, fallback) {
  return API_ERROR_MESSAGES[message] || message || fallback;
}

export function useMultiplayer() {
  const [state, setState] = useState(initialState);
  const [playerNumber, setPlayerNumber] = useState(null);
  const [players, setPlayers] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [buyingItemId, setBuyingItemId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [shopInventories, setShopInventories] = useState({});
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const sendingRef = useRef(false);
  const lobbyRequestRef = useRef(false);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    sendingRef.current = false;
    lobbyRequestRef.current = false;
    setConnected(false);
    setConnecting(false);
    setSending(false);
    setBuyingItemId(null);
    setStarting(false);
    setShopInventories({});
    setPlayerNumber(null);
    setPlayers([]);
    setSessionId(null);
    setState(initialState);
    setError('');
  }, []);

  const connectToGame = useCallback((gameSessionId, playerName = 'Player') => {
    const normalizedSessionId = gameSessionId.trim();
    const normalizedName = playerName.trim() || 'Player';

    socketRef.current?.disconnect();
    lobbyRequestRef.current = false;
    setConnecting(true);
    setConnected(false);
    setBuyingItemId(null);
    setStarting(false);
    setShopInventories({});
    setError('');

    return new Promise((resolve) => {
      const socket = io(SERVER_URL, {
        autoConnect: false,
        reconnection: false,
      });
      socketRef.current = socket;
      let settled = false;

      const fail = (message) => {
        if (settled) return;
        settled = true;
        setConnecting(false);
        setConnected(false);
        setError(message);
        socket.disconnect();
        resolve(false);
      };

      socket.on('connect', () => {
        socket.emit(
          'join',
          { sessionId: normalizedSessionId, name: normalizedName },
          (response) => {
            if (response?.error) {
              fail(apiErrorMessage(response.error, '게임에 참가할 수 없습니다.'));
              return;
            }

            settled = true;
            setPlayerNumber(response.playerNumber);
            setState(response.state);
            setShopInventories({
              [response.playerNumber]: {
                coins: INITIAL_COINS,
                boughtItems: [],
              },
            });
            setSessionId(normalizedSessionId);
            setConnecting(false);
            setConnected(true);
            resolve(true);
          },
        );
      });

      socket.on('state_updated', (nextState) => {
        setState(nextState);
        if (nextState.gameStarted) {
          lobbyRequestRef.current = false;
          setBuyingItemId(null);
          setStarting(false);
        }
      });
      socket.on('players_updated', setPlayers);
      socket.on('inventory_updated', (inventory) => {
        setShopInventories((current) => ({
          ...current,
          [inventory.playerNumber]: {
            coins: inventory.coins,
            boughtItems: inventory.boughtItems || [],
          },
        }));
      });
      socket.on('game_over', ({ finalState }) => setState(finalState));

      socket.on('connect_error', () => {
        fail('서버에 연결할 수 없습니다.');
      });

      socket.on('disconnect', () => {
        lobbyRequestRef.current = false;
        setConnected(false);
        setConnecting(false);
        setBuyingItemId(null);
        setStarting(false);
      });

      socket.connect();
    });
  }, []);

  const createGame = useCallback(async (playerName = 'Player') => {
    setConnecting(true);
    setError('');

    try {
      const response = await fetch(`${SERVER_URL}/api/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount: 2 }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const game = await response.json();
      return connectToGame(game.sessionId, playerName);
    } catch {
      setConnecting(false);
      setError('게임을 만들 수 없습니다. 서버 연결을 확인하세요.');
      return false;
    }
  }, [connectToGame]);

  const buyItem = useCallback((itemId) => {
    const socket = socketRef.current;
    if (!socket?.connected || !sessionId || playerNumber == null) {
      setError('서버와 연결되어 있지 않습니다.');
      return Promise.resolve(false);
    }
    if (state.gameStarted || lobbyRequestRef.current) return Promise.resolve(false);

    setError('');
    lobbyRequestRef.current = true;
    setBuyingItemId(itemId);

    return new Promise((resolve) => {
      socket.emit('buy_item', { sessionId, itemId }, (response) => {
        lobbyRequestRef.current = false;
        setBuyingItemId(null);

        if (response?.error) {
          setError(apiErrorMessage(response.error, '아이템을 구매할 수 없습니다.'));
          resolve(false);
          return;
        }

        setShopInventories((current) => ({
          ...current,
          [playerNumber]: {
            coins: response.coins,
            boughtItems: response.boughtItems || [],
          },
        }));
        resolve(Boolean(response?.ok));
      });
    });
  }, [playerNumber, sessionId, state.gameStarted]);

  const startGame = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected || !sessionId) {
      setError('서버와 연결되어 있지 않습니다.');
      return Promise.resolve(false);
    }
    if (state.gameStarted || lobbyRequestRef.current) return Promise.resolve(false);

    setError('');
    lobbyRequestRef.current = true;
    setStarting(true);

    return new Promise((resolve) => {
      socket.emit('start_game', { sessionId }, (response) => {
        lobbyRequestRef.current = false;
        setStarting(false);

        if (response?.error) {
          setError(apiErrorMessage(response.error, '대국을 시작할 수 없습니다.'));
          resolve(false);
          return;
        }
        resolve(Boolean(response?.ok));
      });
    });
  }, [sessionId, state.gameStarted]);

  const sendAction = useCallback((action) => {
    const socket = socketRef.current;
    if (!socket?.connected || !sessionId) {
      setError('서버와 연결되어 있지 않습니다.');
      return Promise.resolve(false);
    }
    if (sendingRef.current) return Promise.resolve(false);

    setError('');
    sendingRef.current = true;
    setSending(true);

    return new Promise((resolve) => {
      socket.emit('action', { sessionId, action }, (response) => {
        sendingRef.current = false;
        setSending(false);

        if (response?.error) {
          setError(response.error);
          resolve(false);
          return;
        }
        resolve(Boolean(response?.ok));
      });
    });
  }, [sessionId]);

  useEffect(() => disconnect, [disconnect]);

  return {
    state,
    playerNumber,
    players,
    sessionId,
    connecting,
    connected,
    sending,
    buyingItemId,
    starting,
    shopInventories,
    ownShopInventory: playerNumber == null
      ? null
      : shopInventories[playerNumber] || { coins: INITIAL_COINS, boughtItems: [] },
    error,
    createGame,
    connectToGame,
    buyItem,
    startGame,
    sendAction,
    disconnect,
  };
}
