// New-game setup modal: pick the player count (2-12) and toggle 50–50 mode.

import { useEffect, useRef, useState } from 'react';
import { MIN_PLAYERS, MAX_PLAYERS } from '../game/constants.js';
import { clampCount } from '../game/logic.js';
import Stone from './Stone.jsx';

export default function SetupDialog({
  open,
  dismissable,
  defaultCount,
  defaultFiftyFifty,
  onStart,
}) {
  const dialogRef = useRef(null);
  const [count, setCount] = useState(defaultCount);
  const [fiftyFifty, setFiftyFifty] = useState(defaultFiftyFifty);

  // Sync native <dialog> open/close with the `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setCount(defaultCount);
      setFiftyFifty(defaultFiftyFifty);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, defaultCount, defaultFiftyFifty]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onStart(clampCount(count), fiftyFifty);
  };

  const adjust = (delta) => setCount((c) => clampCount(Number(c) + delta));

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="setupTitle"
      onCancel={(e) => {
        // Block Escape from closing the very first setup (no game yet).
        if (!dismissable) e.preventDefault();
      }}
    >
      <form className="setup" onSubmit={handleSubmit}>
        <h2 id="setupTitle">Start a new game</h2>
        <p>
          Choose any player count from {MIN_PLAYERS} to {MAX_PLAYERS}. Players take
          turns in numerical order.
        </p>

        <label className="field-label" htmlFor="playerCount">
          Number of players
        </label>
        <div className="count-row">
          <button
            className="secondary"
            type="button"
            aria-label="Remove one player"
            onClick={() => adjust(-1)}
          >
            −
          </button>
          <input
            id="playerCount"
            type="number"
            min={MIN_PLAYERS}
            max={MAX_PLAYERS}
            value={count}
            inputMode="numeric"
            onChange={(e) => setCount(e.target.value)}
            onBlur={(e) => setCount(clampCount(e.target.value))}
          />
          <button
            className="secondary"
            type="button"
            aria-label="Add one player"
            onClick={() => adjust(1)}
          >
            +
          </button>
        </div>

        <div className="preview" aria-label="Player color preview">
          {Array.from({ length: clampCount(count) }, (_, i) => (
            <Stone key={i} player={i + 1} />
          ))}
        </div>

        <label className="mode-toggle" htmlFor="fiftyFiftyMode">
          <span>
            <strong>50–50 mode</strong>
            <small>
              Each valid placement has a 50% chance to fail. A failure still ends the
              turn.
            </small>
          </span>
          <input
            id="fiftyFiftyMode"
            type="checkbox"
            checked={fiftyFifty}
            onChange={(e) => setFiftyFifty(e.target.checked)}
          />
        </label>

        <button id="startGame" type="submit">
          Start game
        </button>
        <p className="limit-note">Settings apply when the new game starts.</p>
      </form>
    </dialog>
  );
}
