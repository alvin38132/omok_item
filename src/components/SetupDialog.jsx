// New-game setup modal.

import { useEffect, useRef, useState } from 'react';
import { ITEMS_BY_ID } from '../game/items.js';

const itemName = (id) => ITEMS_BY_ID[id].name;

const TUTORIAL_PAGES = [
  {
    id: 'knight_move',
    title: itemName('knight_move'),
    guide: '첫 돌을 둔 뒤 가까운 날일자 칸에 두 번째 돌이 놓입니다.',
    stones: [
      { x: 3, y: 3, color: 'black', className: 'demo-anchor' },
      { x: 4, y: 1, color: 'black', className: 'demo-appear' },
    ],
    marks: [
      { x: 3, y: 3, className: 'demo-pick' },
      { x: 4, y: 1, className: 'demo-target' },
    ],
  },
  {
    id: 'big_knight_move',
    title: itemName('big_knight_move'),
    guide: '더 멀리 뻗는 날일자로, 시작 돌에서 한 칸 더 떨어진 곳에 이어 둡니다.',
    stones: [
      { x: 2, y: 4, color: 'black', className: 'demo-anchor' },
      { x: 5, y: 3, color: 'black', className: 'demo-appear' },
    ],
    marks: [
      { x: 2, y: 4, className: 'demo-pick' },
      { x: 5, y: 3, className: 'demo-target' },
    ],
  },
  {
    id: 'area_blast',
    title: itemName('area_blast'),
    guide: '내 돌 하나를 중심으로 잡으면 주변 8칸까지 한 번에 사라집니다.',
    stones: [
      { x: 3, y: 3, color: 'black', className: 'demo-blast-center' },
      { x: 2, y: 2, color: 'white', className: 'demo-blast-away' },
      { x: 3, y: 2, color: 'black', className: 'demo-blast-away' },
      { x: 4, y: 2, color: 'white', className: 'demo-blast-away' },
      { x: 2, y: 3, color: 'white', className: 'demo-blast-away' },
      { x: 4, y: 3, color: 'black', className: 'demo-blast-away' },
      { x: 2, y: 4, color: 'black', className: 'demo-blast-away' },
      { x: 3, y: 4, color: 'white', className: 'demo-blast-away' },
      { x: 4, y: 4, color: 'white', className: 'demo-blast-away' },
    ],
    marks: [{ x: 3, y: 3, className: 'demo-danger-zone' }],
  },
  {
    id: 'steal_stone',
    title: itemName('steal_stone'),
    guide: '상대 돌 하나를 노립니다. 성공하면 그 자리가 내 돌로 바뀝니다.',
    stones: [
      { x: 1, y: 3, color: 'white' },
      { x: 5, y: 3, color: 'black', className: 'demo-convert' },
    ],
    marks: [{ x: 5, y: 3, className: 'demo-target' }],
  },
  {
    id: 'time_stone',
    title: itemName('time_stone'),
    guide: '주사위 결과에 따라 최근 차례의 돌들이 되감기처럼 사라집니다.',
    stones: [
      { x: 2, y: 4, color: 'black' },
      { x: 3, y: 4, color: 'white', className: 'demo-rewind-one' },
      { x: 4, y: 4, color: 'black', className: 'demo-rewind-two' },
      { x: 4, y: 3, color: 'white', className: 'demo-rewind-three' },
    ],
    marks: [{ x: 5, y: 1, className: 'demo-dice' }],
  },
  {
    id: 'hit_stone',
    title: itemName('hit_stone'),
    guide: '흰 돌을 향해 떨어진 곳에 검은 돌을 놓고 방향을 정하면, 흰 돌이 밀려납니다.',
    stones: [
      { x: 4, y: 3, color: 'white', className: 'demo-hit-white' },
      { x: 1, y: 3, color: 'black', className: 'demo-hit-black' },
    ],
    marks: [
      { x: 1, y: 3, className: 'demo-pick' },
      { x: 2.5, y: 3, className: 'demo-hit-direction' },
    ],
  },
];

function DemoBoard({ page }) {
  const toPercent = (value) => `${(value / 7) * 100}%`;

  return (
    <div className={`tutorial-board demo-${page.id}`} aria-hidden="true">
      {page.marks.map((mark, index) => (
        <span
          key={`mark-${index}`}
          className={`demo-mark ${mark.className}`}
          style={{ left: toPercent(mark.x), top: toPercent(mark.y) }}
        />
      ))}
      {page.stones.map((stone, index) => (
        <span
          key={`stone-${index}`}
          className={`demo-stone ${stone.color} ${stone.className || ''}`}
          style={{
            left: toPercent(stone.x),
            top: toPercent(stone.y),
            '--start-left': toPercent(stone.x),
          }}
        />
      ))}
      <span className="demo-cursor" />
    </div>
  );
}

export default function SetupDialog({ open, dismissable, onStart }) {
  const dialogRef = useRef(null);
  const [pageIndex, setPageIndex] = useState(0);
  const page = TUTORIAL_PAGES[pageIndex];
  const isFinalTutorialPage = page.id === 'hit_stone';

  // Sync native <dialog> open/close with the `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) setPageIndex(0);
  }, [open]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onStart();
  };

  const handlePrevious = () => {
    setPageIndex((current) => Math.max(0, current - 1));
  };

  const handleNext = (event) => {
    event.preventDefault();
    setPageIndex((current) => Math.min(TUTORIAL_PAGES.length - 1, current + 1));
  };

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
        <div className="tutorial-heading">
          <div>
            <span className="small-label">아이템 튜토리얼</span>
            <h2 id="setupTitle">{page.title}</h2>
          </div>
          <span className="tutorial-counter">
            {pageIndex + 1} / {TUTORIAL_PAGES.length}
          </span>
        </div>

        <DemoBoard key={page.id} page={page} />
        <p className="tutorial-guide">{page.guide}</p>

        <div className="tutorial-dots" aria-label="튜토리얼 페이지">
          {TUTORIAL_PAGES.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={index === pageIndex ? 'active' : ''}
              aria-label={`${item.title} 보기`}
              aria-current={index === pageIndex ? 'step' : undefined}
              onClick={() => setPageIndex(index)}
            />
          ))}
        </div>

        <div className="dialog-actions">
          <button
            type="button"
            className="secondary"
            disabled={pageIndex === 0}
            onClick={handlePrevious}
          >
            이전
          </button>
          {isFinalTutorialPage ? (
            <button id="startGame" type="submit">
              게임 시작
            </button>
          ) : (
            <button type="button" onClick={handleNext}>
              다음
            </button>
          )}
        </div>
        <p className="limit-note">새 게임은 항상 2인전으로 시작합니다.</p>
      </form>
    </dialog>
  );
}
