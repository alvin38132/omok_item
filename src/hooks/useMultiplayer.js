import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { initialState } from '../game/reducer.js';

const SERVER_URL = 'http://11.190.49.96:3001';

export function useMultiplayer() {
  const [state, setState] = useState(initialState);
  const [playerNumber, setPlayerNumber] = useState(null);
  const [players, setPlayers] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const sendingRef = useRef(false);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    sendingRef.current = false;
    setConnected(false);
    setConnecting(false);
    setSending(false);
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
    setConnecting(true);
    setConnected(false);
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
              fail(response.error);
              return;
            }

            settled = true;
            setPlayerNumber(response.playerNumber);
            setState(response.state);
            setSessionId(normalizedSessionId);
            setConnecting(false);
            setConnected(true);
            resolve(true);
          },
        );
      });

      socket.on('state_updated', setState);
      socket.on('players_updated', setPlayers);
      socket.on('game_over', ({ finalState }) => setState(finalState));

      socket.on('connect_error', () => {
        fail('서버에 연결할 수 없습니다.');
      });

      socket.on('disconnect', () => {
        setConnected(false);
        setConnecting(false);
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
    error,
    createGame,
    connectToGame,
    sendAction,
    disconnect,
  };
}
