// Top-level composition: wires the game engine to the board, sidebar and
// modals, and owns the "show setup dialog" UI flag.

import { useEffect, useState } from 'react';
import { useGameEngine } from './hooks/useGameEngine.js';
import Board from './components/Board.jsx';
import Sidebar from './components/Sidebar.jsx';
import SetupDialog from './components/SetupDialog.jsx';
import TimeStoneConfirmDialog from './components/TimeStoneConfirmDialog.jsx';
import { timeStoneRoll } from './game/random.js';

export default function App() {
  const engine = useGameEngine();
  const { state } = engine;
  const [showSetup, setShowSetup] = useState(true);
  const [timeStoneDialog, setTimeStoneDialog] = useState({
    open: false,
    rolling: false,
    result: undefined,
  });

  // Auto-clear the "failed placement" X after a short delay.
  useEffect(() => {
    if (!state.failedFlash) return undefined;
    const timer = setTimeout(engine.clearFlash, 700);
    return () => clearTimeout(timer);
  }, [state.failedFlash, engine.clearFlash]);

  const handleStart = (playerCount, fiftyFifty) => {
    engine.startGame(playerCount, fiftyFifty);
    setShowSetup(false);
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
          onCellClick={engine.clickCell}
          onHitAnimationComplete={engine.finishHitAnimation}
          onTimeRewindAnimationComplete={engine.finishTimeRewindAnimation}
        />
        <Sidebar
          state={state}
          stats={engine.stats}
          onActivateItem={handleActivateItem}
          onNewGame={() => setShowSetup(true)}
        />
      </main>

      <SetupDialog
        open={showSetup}
        dismissable={state.gameStarted}
        defaultCount={state.playerCount}
        defaultFiftyFifty={state.fiftyFifty}
        onStart={handleStart}
      />

      <TimeStoneConfirmDialog
        open={timeStoneDialog.open}
        rolling={timeStoneDialog.rolling}
        result={timeStoneDialog.result}
        onConfirm={handleConfirmTimeStone}
        onCancel={() => setTimeStoneDialog({ open: false, rolling: false, result: undefined })}
      />
    </>
  );
}
