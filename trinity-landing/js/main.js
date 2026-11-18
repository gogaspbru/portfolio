/**
 * Точка входа. Скрипты обычные (не ES-модули), поэтому index.html работает
 * и двойным кликом с диска (file://), и с любого сервера / в шаблоне Битрикса.
 * Каждый файл в js/ кладёт свою функцию в window.Trinity; порядок подключения — в index.html.
 */
(function (T) {
  'use strict';

  T.initReveal();
  T.initHeroVideo(document.querySelector('.hero__video'));
  T.initStickyHeader(document.querySelector('.header'));
  T.initMegaMenu(document.querySelector('.header'));
  T.initMenu({
    burger: document.querySelector('.header__burger'),
    nav: document.getElementById('site-nav'),
  });
  T.initCountUp();
  T.initCardPixels();
  T.initSmoothScroll();
})(window.Trinity);
