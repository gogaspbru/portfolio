/**
 * Меню по кнопке-сетке в шапке. Закрывается по Esc, по клику на пункт и повторным нажатием.
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

    button.addEventListener('click', () => setOpen(menu.hidden));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) { setOpen(false); button.focus(); }
    });
  }

  Trinity.initMenu = initMenu;
})(window.Trinity = window.Trinity || {});
