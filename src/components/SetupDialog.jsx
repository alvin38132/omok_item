// New-game setup modal.

import { useEffect, useRef } from 'react';
import { PLAYER_COUNT } from '../game/constants.js';
import Stone from './Stone.jsx';

export default function SetupDialog({ open, dismissable, onStart }) {
  const dialogRef = useRef(null);

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

  const handleSubmit = (event) => {
    event.preventDefault();
    onStart();
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
        <h2 id="setupTitle">새 게임</h2>
        <p>흑과 백, 두 명이 번갈아 두는 아이템 오목입니다.</p>

        <div className="preview" aria-label="플레이어 돌 미리보기">
          {Array.from({ length: PLAYER_COUNT }, (_, i) => (
            <Stone key={i} player={i + 1} />
          ))}
        </div>

        <button id="startGame" type="submit">
          시작하기
        </button>
        <p className="limit-note">새 게임은 항상 2인전으로 시작합니다.</p>
      </form>
    </dialog>
  );
}
