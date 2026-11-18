/**
 * Бургер-меню (< 1200px). На десктопе навигация показывается в шапке как есть.
 */
export function initMenu({ burger, nav }) {
  if (!burger || !nav) return;

  const body = document.body;
  const mobile = window.matchMedia('(max-width: 1199px)');

  const setOpen = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    nav.classList.toggle('is-open', open);
    body.classList.toggle('is-menu-open', open);
  };

  burger.addEventListener('click', () => {
    setOpen(burger.getAttribute('aria-expanded') !== 'true');
  });

  // Закрываем по клику на пункт меню и по Escape
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      burger.focus();
    }
  });

  // При переходе на десктоп сбрасываем состояние
  mobile.addEventListener('change', (event) => {
    if (!event.matches) setOpen(false);
  });
}
