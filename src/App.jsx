// Top-level composition: wires the game engine to the board, sidebar and
// modals, and owns the "show setup dialog" UI flag.

import { useEffect, useState } from 'react';
import { useGameEngine } from './hooks/useGameEngine.js';
import { useMultiplayer } from './hooks/useMultiplayer.js';
import Board from './components/Board.jsx';
import Sidebar from './components/Sidebar.jsx';
import SetupDialog from './components/SetupDialog.jsx';
import TimeStoneConfirmDialog from './components/TimeStoneConfirmDialog.jsx';
import EndGameCelebration from './components/EndGameCelebration.jsx';
import { timeStoneRoll } from './game/random.js';

export default function App() {
  const multiplayer = useMultiplayer();
  const enoughPlayers = multiplayer.players.length >= multiplayer.state.playerCount;
  const canAct = multiplayer.connected
    && !multiplayer.sending
    && enoughPlayers
    && multiplayer.state.gameStarted
    && multiplayer.playerNumber === multiplayer.state.currentPlayer
    && !multiplayer.state.gameOver;
  const engine = useGameEngine({
    authoritativeState: multiplayer.state,
    sendAction: multiplayer.sendAction,
    canAct,
  });
  const { state } = engine;
  const [showSetup, setShowSetup] = useState(true);
  const [timeStoneDialog, setTimeStoneDialog] = useState({
    open: false,
    rolling: false,
    result: undefined,
  });

  // Auto-clear transient board feedback after a short delay.
  useEffect(() => {
    if (!state.failedFlash) return undefined;
    const timer = setTimeout(engine.clearFlash, 700);
    return () => clearTimeout(timer);
  }, [state.failedFlash, engine.clearFlash]);

  const handleCreate = async (playerName) => {
    const joined = await multiplayer.createGame(playerName);
    if (joined) {
      setShowSetup(false);
      setTimeStoneDialog({ open: false, rolling: false, result: undefined });
    }
  };

  const handleJoin = async (sessionId, playerName) => {
    const joined = await multiplayer.connectToGame(sessionId, playerName);
    if (joined) {
      setShowSetup(false);
      setTimeStoneDialog({ open: false, rolling: false, result: undefined });
    }
  };

  const handleNewGame = () => {
    multiplayer.disconnect();
    setShowSetup(true);
    setTimeStoneDialog({ open: false, rolling: false, result: undefined });
  };

  const handleActivateItem = (itemId) => {
    if (engine.hitAnimation || engine.timeRewindAnimation) return;
    if (itemId === 'time_stone') {
      setTimeStoneDialog({ open: true, rolling: false, result: undefined });
      return;
    }
    engine.activateItem(itemId);
  };

  const handleConfirmTimeStone = () => {
    const result = timeStoneRoll();
    setTimeStoneDialog({ open: true, rolling: true, result });
    window.setTimeout(() => {
      setTimeStoneDialog({ open: true, rolling: false, result });
      window.setTimeout(() => {
        setTimeStoneDialog({ open: false, rolling: false, result: undefined });
        engine.useTimeStone(result);
      }, 700);
    }, 1400);
  };

  return (
    <>
      <main className="app">
        <Board
          state={state}
          hitAnimation={engine.hitAnimation}
          timeRewindAnimation={engine.timeRewindAnimation}
          itemAnimation={engine.itemAnimation}
          onCellClick={engine.clickCell}
          onHitAnimationComplete={engine.finishHitAnimation}
          onTimeRewindAnimationComplete={engine.finishTimeRewindAnimation}
          onItemAnimationComplete={engine.finishItemAnimation}
        />
        <Sidebar
          state={state}
          multiplayer={multiplayer}
          canAct={canAct}
          enoughPlayers={enoughPlayers}
          onActivateItem={handleActivateItem}
          onNewGame={handleNewGame}
        />
      </main>

      <SetupDialog
        open={showSetup}
        dismissable={multiplayer.connected}
        connecting={multiplayer.connecting}
        error={multiplayer.error}
        onCreate={handleCreate}
        onJoin={handleJoin}
      />

      <TimeStoneConfirmDialog
        open={timeStoneDialog.open}
        rolling={timeStoneDialog.rolling}
        result={timeStoneDialog.result}
        onConfirm={handleConfirmTimeStone}
        onCancel={() => setTimeStoneDialog({ open: false, rolling: false, result: undefined })}
      />

      {!showSetup && multiplayer.connected && (
        <EndGameCelebration state={state} onNewGame={handleNewGame} />
      )}
    </>
  );
}
