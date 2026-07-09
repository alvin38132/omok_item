// Confirmation shown before consuming the Random Flip item.

export default function RandomFlipConfirmModal({ open, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="randomFlipTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="randomFlipTitle">Use Random Flip?</h3>
        <p>
          This will immediately reassign ownership of 30% of all regular stones
          on the board and end your turn.
        </p>
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="modal-choice danger" onClick={onConfirm}>
            Use Random Flip
          </button>
        </div>
      </div>
    </div>
  );
}
