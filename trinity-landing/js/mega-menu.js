/**
 * Выпадающее меню шапки (только ≥ 1200px).
 * Пункт меню с data-mega="key" открывает панель [data-mega-panel="key"].
 * Открытие: наведение (с небольшой задержкой) или фокус с клавиатуры.
 * Закрытие: уход курсора с шапки/панели, Esc, клик по затемнению, начало скролла.
 */
(function (Trinity) {
  'use strict';

  const OPEN_DELAY = 80;   // мс — чтобы меню не мигало при случайном проходе курсора
  const CLOSE_DELAY = 160; // мс — время «перелёта» курсора с пункта на панель

  function initMegaMenu(header) {
    if (!header) return;
    const items = [...header.querySelectorAll('.nav__item[data-mega]')];
    const panels = [...header.querySelectorAll('[data-mega-panel]')];
    const mega = header.querySelector('.mega');
    const overlay = header.querySelector('.mega-overlay');
    if (!items.length || !mega) return;

    const desktop = window.matchMedia('(min-width: 1200px)');
    let current = null;
    let openTimer = 0;
    let closeTimer = 0;

    const open = (key) => {
      clearTimeout(closeTimer);
      if (current === key) return;
      current = key;
      panels.forEach((p) => { p.hidden = p.dataset.megaPanel !== key; });
      items.forEach((li) => {
        const on = li.dataset.mega === key;
        li.classList.toggle('is-active', on);
        li.querySelector('a').setAttribute('aria-expanded', String(on));
      });
      header.classList.add('header--mega');
    };

    const close = () => {
      clearTimeout(openTimer);
      if (!current) return;
      current = null;
      header.classList.remove('header--mega');
      items.forEach((li) => {
        li.classList.remove('is-active');
        li.querySelector('a').setAttribute('aria-expanded', 'false');
      });
      // панель прячем после анимации, чтобы она не исчезала резко
      setTimeout(() => { if (!current) panels.forEach((p) => { p.hidden = true; }); }, 350);
    };

    const scheduleClose = () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      closeTimer = setTimeout(close, CLOSE_DELAY);
    };

    items.forEach((li) => {
      li.addEventListener('mouseenter', () => {
        if (!desktop.matches) return;
        clearTimeout(closeTimer);
        clearTimeout(openTimer);
        // если меню уже открыто — переключаем сразу
        if (current) open(li.dataset.mega);
        else openTimer = setTimeout(() => open(li.dataset.mega), OPEN_DELAY);
      });
      li.addEventListener('focusin', () => { if (desktop.matches) open(li.dataset.mega); });
    });

    // курсор на панели — не закрываем
    mega.addEventListener('mouseenter', () => clearTimeout(closeTimer));
    mega.addEventListener('mouseleave', scheduleClose);
    header.querySelector('.nav__list').addEventListener('mouseleave', scheduleClose);

    // другие ячейки шапки (лого, иконки) — закрываем
    header.querySelectorAll('.header__cell:not(.nav)').forEach((cell) => {
      cell.addEventListener('mouseenter', scheduleClose);
    });

    // фокус ушёл из меню и панели — закрываем
    header.addEventListener('focusout', (e) => {
      if (!header.contains(e.relatedTarget) || !e.relatedTarget.closest('.nav__item[data-mega], .mega')) close();
    });

    overlay && overlay.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !current) return;
      const link = header.querySelector('.nav__item.is-active a');
      close();
      link && link.focus();
    });
    window.addEventListener('wheel', () => { if (current) close(); }, { passive: true });
    desktop.addEventListener('change', (e) => { if (!e.matches) close(); });
  }

  Trinity.initMegaMenu = initMegaMenu;
})(window.Trinity = window.Trinity || {});
