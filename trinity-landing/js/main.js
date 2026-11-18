import { initHeroVideo } from './hero-video.js';
import { initMenu } from './menu.js';
import { initStickyHeader } from './header.js';
import { initReveal } from './reveal.js';
import { initSmoothScroll } from './smooth-scroll.js';
import { initCountUp } from './count-up.js';

initReveal();
initHeroVideo(document.querySelector('.hero__video'));
initStickyHeader(document.querySelector('.header'));
initMenu({
  burger: document.querySelector('.header__burger'),
  nav: document.getElementById('site-nav'),
});
initCountUp();
initSmoothScroll();
