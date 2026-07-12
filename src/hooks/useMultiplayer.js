import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { gameReducer, initialState } from '../game/reducer.js';

export function useMultiplayer() {
  const [state, setState] = useState(initialState);
  const [playerNumber, setPlayerNumber] = useState(null);
  const [players, setPlayers] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const socketRef = useRef(null);

  const connectToGame = async (gameSessionId, playerName = 'Player') => {
    if (socketRef.current?.connected) return;

    setConnecting(true);
    const socket = io('http://localhost:3001', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('Connected to server');
      socket.emit('join', { sessionId: gameSessionId, name: playerName }, (response) => {
        if (response.error) {
          console.error('Failed to join:', response.error);
          setConnecting(false);
          return;
        }
        setPlayerNumber(response.playerNumber);
        setState(response.state);
        setSessionId(gameSessionId);
        setConnecting(false);
      });
    });

    socket.on('state_updated', (newState) => {
      setState(newState);
    });

    socket.on('players_updated', (playerList) => {
      setPlayers(playerList);
    });

    socket.on('game_over', (data) => {
      console.log('Game over:', data);
      setState(data.finalState);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    socketRef.current = socket;
  };

  const sendAction = (action) => {
    if (!socketRef.current?.connected || !sessionId) {
      console.error('Not connected to server');
      return;
    }
    socketRef.current.emit('action', { sessionId, action }, (response) => {
      if (response.error) {
        console.error('Action error:', response.error);
      }
    });
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
    state,
    playerNumber,
    players,
    sessionId,
    connecting,
    connectToGame,
    sendAction,
  };
}
