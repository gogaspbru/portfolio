/**
 * Точка входа. Скрипты обычные (не ES-модули), поэтому index.html работает
 * и двойным кликом с диска (file://), и с любого сервера / в шаблоне Битрикса.
 * Каждый файл в js/ кладёт свою функцию в window.Trinity; порядок подключения — в index.html.
 */
(function (T) {
  'use strict';

  T.initReveal();
  T.initHeroVideo(document.querySelector('.hero__video'));
  T.initLineHero(document.querySelector('[data-hero-track]'));
  T.initMenu(document.querySelector('.header__menu-btn'), document.getElementById('site-menu'));
  T.initCardPixels();
  T.initSmoothScroll();
})(window.Trinity);
