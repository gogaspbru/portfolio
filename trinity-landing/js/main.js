import { initHeroVideo } from './hero-video.js';
import { initMenu } from './menu.js';

initHeroVideo(document.querySelector('.hero__video'));
initMenu({
  burger: document.querySelector('.header__burger'),
  nav: document.getElementById('site-nav'),
});
