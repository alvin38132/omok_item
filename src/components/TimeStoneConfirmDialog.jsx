import { useEffect, useRef, useState } from 'react';

const ROLL_FACES = ['1', '2', '3', '4', '5', '6'];

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
      if (result !== undefined) setFace(result);
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
    ? '2, 4, 6이 나오면 그만큼 최근 차례를 되돌리고, 홀수가 나오면 꽝입니다.'
    : result % 2 === 0
      ? `${result}이 나왔습니다. 최근 ${result}차례를 되돌립니다.`
      : `${result}이 나왔습니다. 꽝입니다.`;

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
        <h2 id="timeStoneTitle">시간석을 사용할까요?</h2>
        <div className="dice-stage" aria-live="polite">
          <div className={`dice${rolling ? ' rolling' : ''}`}>
            <span>{face}</span>
          </div>
          <p>{rolling ? '주사위를 굴리는 중...' : resultText}</p>
        </div>
        <div className="dialog-actions">
          <button className="secondary" type="button" disabled={rolling} onClick={onCancel}>
            취소
          </button>
          <button type="button" disabled={rolling || result !== undefined} onClick={onConfirm}>
            주사위 굴리기
          </button>
        </div>
      </form>
    </dialog>
  );
}
