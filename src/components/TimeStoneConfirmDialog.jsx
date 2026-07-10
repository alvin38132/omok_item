import { useEffect, useRef, useState } from 'react';

const ROLL_FACES = ['FAIL', '1', 'FAIL', '2', 'FAIL', '3'];

export default function TimeStoneConfirmDialog({
  open,
  rolling,
  result,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);
  const [face, setFace] = useState('?');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (result === undefined) setFace('?');
      dialog.showModal();
    }
    else if (!open && dialog.open) dialog.close();
  }, [open, result]);

  useEffect(() => {
    if (!rolling) {
      if (result !== undefined) setFace(result ?? 'FAIL');
      return undefined;
    }

    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setFace(ROLL_FACES[index % ROLL_FACES.length]);
    }, 95);

    return () => window.clearInterval(interval);
  }, [rolling, result]);

  const resultText = result === undefined
    ? 'Three sides fail. The other sides rewind 1, 2, or 3 turns.'
    : result
      ? `Rolled ${result}. Rewinding ${result} turn${result === 1 ? '' : 's'}.`
      : 'Rolled FAIL. No turns rewind.';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="timeStoneTitle"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <form className="setup item-confirm" onSubmit={(event) => event.preventDefault()}>
        <h2 id="timeStoneTitle">Use Time Stone?</h2>
        <div className="dice-stage" aria-live="polite">
          <div className={`dice${rolling ? ' rolling' : ''}`}>
            <span>{face}</span>
          </div>
          <p>{rolling ? 'Rolling...' : resultText}</p>
        </div>
        <div className="dialog-actions">
          <button className="secondary" type="button" disabled={rolling} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" disabled={rolling || result !== undefined} onClick={onConfirm}>
            Roll die
          </button>
        </div>
      </form>
    </dialog>
  );
}
