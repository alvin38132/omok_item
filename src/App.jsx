// Top-level composition: wires the game engine to the board, sidebar and
// modals, and owns the "show setup dialog" UI flag.

import { useEffect, useState } from 'react';
import { useGameEngine } from './hooks/useGameEngine.js';
import Board from './components/Board.jsx';
import Sidebar from './components/Sidebar.jsx';
import SetupDialog from './components/SetupDialog.jsx';
import LineClearModal from './components/LineClearModal.jsx';
import RandomFlipConfirmModal from './components/RandomFlipConfirmModal.jsx';

export default function App() {
  const engine = useGameEngine();
  const { state } = engine;
  const [showSetup, setShowSetup] = useState(true);
  const [confirmRandomFlip, setConfirmRandomFlip] = useState(false);

  // Auto-clear the "failed placement" X after a short delay.
  useEffect(() => {
    if (!state.failedFlash) return undefined;
    const timer = setTimeout(engine.clearFlash, 700);
    return () => clearTimeout(timer);
  }, [state.failedFlash, engine.clearFlash]);

  const handleStart = (playerCount, fiftyFifty) => {
    engine.startGame(playerCount, fiftyFifty);
    setConfirmRandomFlip(false);
    setShowSetup(false);
  };

  const handleActivateItem = (itemId) => {
    if (itemId === 'random_flip') {
      setConfirmRandomFlip(true);
      return;
    }
    engine.activateItem(itemId);
  };

  const handleConfirmRandomFlip = () => {
    setConfirmRandomFlip(false);
    engine.activateItem('random_flip');
  };

  return (
    <>
      <main className="app">
        <Board state={state} onCellClick={engine.clickCell} />
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

      <LineClearModal
        cell={state.lineClearCell}
        onChoose={engine.chooseLineClearDirection}
        onCancel={engine.cancelLineClear}
      />

      <RandomFlipConfirmModal
        open={confirmRandomFlip}
        onConfirm={handleConfirmRandomFlip}
        onCancel={() => setConfirmRandomFlip(false)}
      />
    </>
  );
}
