// New-game setup modal.

import { useEffect, useRef, useState } from 'react';
import { ITEMS_BY_ID } from '../game/items.js';

const itemName = (id) => ITEMS_BY_ID[id].name;

const TUTORIAL_PAGES = [
  {
    id: 'knight_move',
    title: itemName('knight_move'),
    guide: '빈 곳 두 칸을 날일자 간격으로 고릅니다.',
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
    guide: '일반 날일자보다 한 칸 더 먼 자리에 둡니다.',
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
    guide: '내 돌 하나와 그 주변 8칸을 비웁니다.',
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
    guide: '상대 돌 하나를 노립니다. 성공하면 내 돌로 바뀝니다.',
    stones: [
      { x: 1, y: 3, color: 'white' },
      { x: 5, y: 3, color: 'black', className: 'demo-convert' },
    ],
    marks: [{ x: 5, y: 3, className: 'demo-target' }],
  },
  {
    id: 'time_stone',
    title: itemName('time_stone'),
    guide: '짝수가 나오면 이번 차례를 한 번 더 진행하고, 홀수가 나오면 실패합니다.',
    stones: [
      { x: 2, y: 4, color: 'black' },
      { x: 3, y: 4, color: 'white' },
      { x: 4, y: 4, color: 'black' },
      { x: 4, y: 3, color: 'white' },
    ],
    marks: [{ x: 5, y: 1, className: 'demo-dice' }],
  },
  {
    id: 'hit_stone',
    title: itemName('hit_stone'),
    guide: '빈 곳에서 가로 또는 세로 방향으로 돌을 밀어냅니다.',
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

export default function SetupDialog({
  open,
  dismissable,
  connecting,
  error,
  onCreate,
  onJoin,
}) {
  const dialogRef = useRef(null);
  const [pageIndex, setPageIndex] = useState(TUTORIAL_PAGES.length);
  const [mode, setMode] = useState('create');
  const [playerName, setPlayerName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const isLobbyPage = pageIndex === TUTORIAL_PAGES.length;
  const page = TUTORIAL_PAGES[Math.min(pageIndex, TUTORIAL_PAGES.length - 1)];

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
    if (open) {
      setPageIndex(TUTORIAL_PAGES.length);
      setSessionId('');
    }
  }, [open]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isLobbyPage || connecting) return;
    if (mode === 'create') onCreate(playerName);
    else onJoin(sessionId, playerName);
  };

  const handlePrevious = () => {
    setPageIndex((current) => Math.max(0, current - 1));
  };

  const handleNext = (event) => {
    event.preventDefault();
    setPageIndex((current) => Math.min(TUTORIAL_PAGES.length, current + 1));
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
        {isLobbyPage ? (
          <>
            <div className="tutorial-heading">
              <div>
                <span className="small-label">온라인 대국</span>
                <h2 id="setupTitle">서버에 연결</h2>
              </div>
              <span className="connection-dot" aria-label="연결 전" />
            </div>

            <div className="mode-switch" aria-label="연결 방식">
              <button
                type="button"
                className={mode === 'create' ? 'active' : ''}
                aria-pressed={mode === 'create'}
                onClick={() => setMode('create')}
              >
                방 만들기
              </button>
              <button
                type="button"
                className={mode === 'join' ? 'active' : ''}
                aria-pressed={mode === 'join'}
                onClick={() => setMode('join')}
              >
                코드로 참가
              </button>
            </div>

            <label className="setup-field">
              <span>플레이어 이름</span>
              <input
                value={playerName}
                maxLength={24}
                placeholder="이름을 입력하세요"
                autoComplete="nickname"
                onChange={(event) => setPlayerName(event.target.value)}
              />
            </label>

            {mode === 'join' && (
              <label className="setup-field">
                <span>게임 코드</span>
                <input
                  value={sessionId}
                  placeholder="session-1"
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                  onChange={(event) => setSessionId(event.target.value)}
                />
              </label>
            )}

            {error && <p className="connection-error" role="alert">{error}</p>}

            <div className="dialog-actions lobby-actions">
              <button type="button" className="secondary" disabled={connecting} onClick={() => setPageIndex(0)}>
                아이템 안내
              </button>
              <button type="submit" disabled={connecting || (mode === 'join' && !sessionId.trim())}>
                {connecting ? '연결 중...' : mode === 'create' ? '방 만들기' : '참가하기'}
              </button>
            </div>
            <p className="limit-note">2인 온라인 대국</p>
          </>
        ) : (
          <>
            <div className="tutorial-heading">
              <div>
                <span className="small-label">아이템 안내</span>
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
              <button type="button" onClick={handleNext}>
                {pageIndex === TUTORIAL_PAGES.length - 1 ? '온라인 대국 설정' : '다음'}
              </button>
            </div>
            <p className="limit-note">두 사람이 각자 접속해 번갈아 둡니다.</p>
          </>
        )}
      </form>
    </dialog>
  );
}
