const SOUND_URLS = {
  place: new URL('../../착수.mp3', import.meta.url).href,
  stealSuccess: new URL('../../강탈 성공음.mp3', import.meta.url).href,
  stealFailure: new URL('../../강탈 실패음.mp3', import.meta.url).href,
  explosion: new URL('../../폭발음.mp3', import.meta.url).href,
  timeStone: new URL('../../시간석 효과음.mp3', import.meta.url).href,
};

const audioCache = {};

export function playSound(kind) {
  const url = SOUND_URLS[kind];
  if (!url || typeof window === 'undefined') return;

  let audio = audioCache[kind];
  if (!audio) {
    audio = new Audio(url);
    audio.preload = 'auto';
    audioCache[kind] = audio;
  }

  audio.currentTime = 0;
  audio.play().catch(() => undefined);
}
