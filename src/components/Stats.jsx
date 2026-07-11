// Game statistics row.

export default function Stats({ attempts, placed }) {
  return (
    <div className="meta" aria-label="게임 기록">
      <div>
        <span>시도</span>
        <strong>{attempts}</strong>
      </div>
      <div>
        <span>착수</span>
        <strong>{placed}</strong>
      </div>
    </div>
  );
}
