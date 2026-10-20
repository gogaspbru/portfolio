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

  // Слайдеры: нативная прокрутка со снапом + точки (и стрелки у кейсов).
  // На десктопе блоки .m-slider — обычные сетки, прокрутки нет и точки скрыты.
  document.querySelectorAll('[data-slider]').forEach(function (track) {
    var dotsBox = track.nextElementSibling;
    if (!dotsBox || !dotsBox.classList.contains('slider-dots')) { dotsBox = null; }
    var arrows = track.classList.contains('cases__track')
      ? document.querySelectorAll('.cases__arrows [data-dir]') : [];
    var dots = [];
    var step = function () {
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return track.children[0].getBoundingClientRect().width + gap;
    };
    var maxScroll = function () { return track.scrollWidth - track.clientWidth; };
    var build = function () {
      if (!dotsBox) { return; }
      var max = maxScroll();
      var count = max > 2 ? Math.round(max / step()) + 1 : 0;
      if (count === dots.length) { return; }
      dotsBox.innerHTML = '';
      dots = [];
      for (var i = 0; i < count; i++) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.tabIndex = -1;
        dot.addEventListener('click', (function (n) {
          return function () { track.scrollTo({ left: n * step(), behavior: 'smooth' }); };
        })(i));
        dotsBox.appendChild(dot);
        dots.push(dot);
      }
    };
    var update = function () {
      var max = maxScroll();
      var idx = track.scrollLeft >= max - 2 ? dots.length - 1 : Math.round(track.scrollLeft / step());
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === idx); });
      if (arrows.length) {
        arrows[0].disabled = track.scrollLeft <= 2;
        arrows[1].disabled = track.scrollLeft >= max - 2;
      }
    };
    Array.prototype.forEach.call(arrows, function (btn) {
      btn.addEventListener('click', function () {
        track.scrollBy({ left: step() * Number(btn.dataset.dir), behavior: 'smooth' });
      });
    });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', function () { build(); update(); });
    build();
    update();
  });

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
