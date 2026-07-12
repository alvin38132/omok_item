import { useEffect, useMemo, useState } from 'react';
import { playerColor, playerTextColor } from '../game/colors.js';

const CONFETTI_COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4d96ff', '#f7f4ed'];
const PLAYER_LABELS = {
  1: '흑',
  2: '백',
};

function playerLabel(player) {
  return PLAYER_LABELS[player] || `플레이어 ${player}`;
}

function buildConfetti() {
  return Array.from({ length: 64 }, (_, index) => {
    const column = index % 16;
    const row = Math.floor(index / 16);
    return {
      id: index,
      style: {
        '--x': `${5 + column * 6 + (row % 2) * 2}%`,
        '--delay': `${(index % 12) * 0.075}s`,
        '--duration': `${2.4 + (index % 7) * 0.16}s`,
        '--drift': `${((index * 29) % 120) - 60}px`,
        '--spin': `${180 + ((index * 47) % 420)}deg`,
        '--confetti-color': CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      },
    };
  });
}

export default function EndGameCelebration({ state, onNewGame }) {
  const [dismissed, setDismissed] = useState(false);
  const confetti = useMemo(buildConfetti, []);

  useEffect(() => {
    setDismissed(false);
  }, [state.session, state.gameOver]);

  if (!state.gameStarted || !state.gameOver || dismissed) return null;

  const winningCell = state.winningCells[0];
  const winner = winningCell ? state.board[winningCell.y][winningCell.x] : null;
  const winnerLabel = winner ? playerLabel(winner) : '';
  const title = winner ? `${winnerLabel} 승` : '무승부';
  const subtitle = winner
    ? `${winnerLabel}이 다섯 줄을 만들었습니다.`
    : '더 이상 둘 곳이 없습니다.';

  return (
    <div className="endgame-layer" role="dialog" aria-modal="true" aria-labelledby="endgame-title">
      <div className="confetti-field" aria-hidden="true">
        {confetti.map((piece) => (
          <span key={piece.id} className="confetti-piece" style={piece.style} />
        ))}
      </div>

      <div className="endgame-pop">
        <div className="endgame-burst" aria-hidden="true" />
        {winner && (
          <div
            className="endgame-stone"
            aria-hidden="true"
            style={{
              background: playerColor(winner),
              color: playerTextColor(winner),
            }}
          >
            {winnerLabel}
          </div>
        )}
        <p className="small-label">대국 종료</p>
        <h2 id="endgame-title">{title}</h2>
        <p>{subtitle}</p>
        <div className="endgame-actions">
          <button type="button" onClick={onNewGame}>
            새 대국
          </button>
          <button type="button" className="secondary" onClick={() => setDismissed(true)}>
            판 보기
          </button>
        </div>
      </div>
    </div>
  );
}
