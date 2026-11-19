/**
 * Меню по кнопке-сетке в шапке — только на экранах уже 1200px, где пункты меню
 * не помещаются в шапку. На десктопе кнопка меню не открывает (что по ней будет — решим отдельно).
 * Закрывается по Esc, по клику на пункт, повторным нажатием и при расширении окна до десктопа.
 */
(function (Trinity) {
  'use strict';

  function initMenu(button, menu) {
    if (!button || !menu) return;
    const body = document.body;

    const setOpen = (open) => {
      menu.hidden = !open;
      body.classList.toggle('is-menu-open', open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    };

    const desktop = window.matchMedia('(min-width: 1200px)');

    button.addEventListener('click', () => {
      if (desktop.matches) return;
      setOpen(menu.hidden);
    });
    desktop.addEventListener('change', () => { if (desktop.matches) setOpen(false); });
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) { setOpen(false); button.focus(); }
    });
  }

  Trinity.initMenu = initMenu;
})(window.Trinity = window.Trinity || {});
