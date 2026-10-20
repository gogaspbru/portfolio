(function () {
  'use strict';

  // Мобильное меню
  var burger = document.querySelector('.header__burger');
  var menu = document.getElementById('mobile-menu');
  if (burger && menu) {
    burger.addEventListener('click', function () {
      var open = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!open));
      burger.setAttribute('aria-label', open ? 'Открыть меню' : 'Закрыть меню');
      menu.hidden = open;
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) { burger.click(); }
    });
  }

  // Слайдер «Кейсы и статьи»: стрелки + точки поверх нативной прокрутки
  var track = document.querySelector('.cases__track');
  if (track) {
    var cards = track.children;
    var dots = document.querySelectorAll('.cases__dots i');
    var arrows = document.querySelectorAll('.cases__arrows [data-dir]');
    var step = function () {
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return cards[0].getBoundingClientRect().width + gap;
    };
    var update = function () {
      var max = track.scrollWidth - track.clientWidth;
      var idx = Math.round(track.scrollLeft / step());
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === idx); });
      arrows[0].disabled = track.scrollLeft <= 2;
      arrows[1].disabled = track.scrollLeft >= max - 2;
      document.querySelector('.cases__dots').style.visibility = max > 2 ? '' : 'hidden';
    };
    arrows.forEach(function (btn) {
      btn.addEventListener('click', function () {
        track.scrollBy({ left: step() * Number(btn.dataset.dir), behavior: 'smooth' });
      });
    });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // Форма «Есть вопросы?» — простая проверка; отправку подключить к бэкенду
  var form = document.querySelector('.question__form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      form.querySelectorAll('input').forEach(function (input) {
        var bad = input.type === 'tel'
          ? input.value.replace(/\D/g, '').length < 10
          : input.value.trim().length < 2;
        input.classList.toggle('is-error', bad);
        if (bad) { ok = false; }
      });
      if (!ok) { return; }
      form.reset();
      form.parentElement.querySelector('.question__done').hidden = false;
    });
  }
})();
