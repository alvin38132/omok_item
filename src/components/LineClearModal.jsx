// Direction chooser shown after selecting a stone with the Line Clear item.

const DIRECTIONS = [
  { name: 'Horizontal (Row)', type: 'horizontal' },
  { name: 'Vertical (Col)', type: 'vertical' },
  { name: 'Diagonal Down-Right (\\)', type: 'diag_down' },
  { name: 'Diagonal Up-Right (/)', type: 'diag_up' },
];

export default function LineClearModal({ cell, onChoose, onCancel }) {
  if (!cell) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Clear Line Direction</h3>
        <p>
          Choose which direction line passing through ({cell.x}, {cell.y}) to
          completely clear.
        </p>
        {DIRECTIONS.map((dir) => (
          <button
            key={dir.type}
            type="button"
            className="modal-choice"
            onClick={() => onChoose(dir.type)}
          >
            {dir.name}
          </button>
        ))}
        <button type="button" className="modal-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
