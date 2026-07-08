// Game statistics row (attempts / placed / failed).

export default function Stats({ attempts, placed, failed }) {
  return (
    <div className="meta" aria-label="Game statistics">
      <div>
        <span>Attempts</span>
        <strong>{attempts}</strong>
      </div>
      <div>
        <span>Placed</span>
        <strong>{placed}</strong>
      </div>
      <div>
        <span>Failed</span>
        <strong>{failed}</strong>
      </div>
    </div>
  );
}
