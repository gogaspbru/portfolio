/**
 * Фоновое видео первого экрана.
 * Видео подключается только если:
 *  - ширина экрана ≥ 768px (на мобильных — только постер),
 *  - пользователь не просил уменьшить анимацию (prefers-reduced-motion),
 *  - не включён режим экономии трафика (Save-Data).
 * Если файла нет или он не загрузился — остаётся постер.
 */
const DESKTOP_QUERY = '(min-width: 768px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function initHeroVideo(video) {
  if (!video) return;

  const src = video.dataset.src;
  const desktop = window.matchMedia(DESKTOP_QUERY);
  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  const saveData = navigator.connection && navigator.connection.saveData;

  const canPlay = () => Boolean(src) && desktop.matches && !reducedMotion.matches && !saveData;

  const enable = () => {
    if (!video.getAttribute('src')) {
      video.src = src;
      video.load();
    }
    const playing = video.play();
    if (playing) playing.catch(() => { /* автоплей заблокирован — остаётся постер */ });
  };

  const disable = () => {
    video.pause();
    if (video.getAttribute('src')) {
      video.removeAttribute('src');
      video.load(); // сбрасываем на постер
    }
  };

  const update = () => (canPlay() ? enable() : disable());

  video.addEventListener('error', disable);
  desktop.addEventListener('change', update);
  reducedMotion.addEventListener('change', update);
  update();
}
