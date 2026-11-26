/**
 * Точка входа. Скрипты обычные (не ES-модули), поэтому index.html работает
 * и двойным кликом с диска (file://), и с любого сервера / в шаблоне Битрикса.
 * Каждый файл в js/ кладёт свою функцию в window.Trinity; порядок подключения — в index.html.
 */
(function (T) {
  'use strict';

  T.initReveal();
  // видео в параллелограмме и его размытая копия в «стекле» — держим их кадр в кадр
  const videos = document.querySelectorAll('.hero__video');
  videos.forEach((v) => T.initHeroVideo(v));
  if (videos.length > 1) {
    const [main, copy] = videos;
    main.addEventListener('timeupdate', () => {
      if (!copy.paused && Math.abs(copy.currentTime - main.currentTime) > 0.08) copy.currentTime = main.currentTime;
    });
  }
  T.initLineHero(document.querySelector('[data-hero-track]'));
  T.initMenu(document.querySelector('.header__menu-btn'), document.getElementById('site-menu'));
  T.initCardPixels();
  T.initSmoothScroll();
})(window.Trinity);
