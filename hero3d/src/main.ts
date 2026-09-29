import * as THREE from 'three';
import './style.css';
import { config } from './config';
import { createStage } from './stage';
import { createLogo } from './logo';
import { createLogoMaterial } from './material';

const canvas = document.querySelector<HTMLCanvasElement>('#webgl')!;
const stage = createStage(canvas);
const { scene, composer } = stage;

const isMobile = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;

// --- Логотип -------------------------------------------------------------
const material = createLogoMaterial();
const logo = createLogo(material);

// root: позиционирование на экране (layout), pivot: позы/вращение.
const root = new THREE.Group();
const pivot = new THREE.Group();
root.add(pivot);
pivot.add(logo.group);
scene.add(root);

// --- Временный свет шага 1 -----------------------------------------------
const key = new THREE.DirectionalLight(config.lights.keyColor, config.lights.keyIntensity);
key.position.set(-3, 4, 5);
const rim = new THREE.DirectionalLight(config.lights.rimColor, config.lights.rimIntensity);
rim.position.set(4, 1.5, -4);
scene.add(key, rim);

// --- Layout --------------------------------------------------------------
const layout = () => {
  const view = stage.viewSizeAtOrigin();
  const l = config.layout;
  const targetH = view.height * (isMobile ? l.heightMobile : l.heightDesktop);
  const s = targetH / logo.size.y;
  // Не даём знаку вылезти за ширину экрана на узких/портретных вьюпортах.
  const maxS = (view.width * (isMobile ? l.maxWidthMobile : l.maxWidthDesktop)) / logo.size.x;
  root.scale.setScalar(Math.min(s, maxS));
  root.position.set(
    view.width * (isMobile ? l.offsetXMobile : l.offsetXDesktop),
    view.height * (isMobile ? l.offsetYMobile : l.offsetYDesktop),
    0,
  );
};

const onResize = () => {
  stage.resize();
  layout();
};
window.addEventListener('resize', onResize);
onResize();

// --- Цикл рендера (пауза вне вкладки / вне экрана) -------------------------
const timer = new THREE.Timer();
timer.connect(document);
let running = true;
let inView = true;

const applyPose = (dt: number) => {
  const p = config.pose;
  if (p.autoRotate) p.rotY += dt * p.autoRotateSpeed;
  pivot.rotation.set(p.rotX, p.rotY, p.rotZ);
};

const tick = () => {
  if (!running) return;
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 20);
  applyPose(dt);
  composer.render(dt);
  requestAnimationFrame(tick);
};

const setRunning = (v: boolean) => {
  if (v === running) return;
  running = v;
  if (running) {
    timer.reset(); // сбросить накопленное время паузы
    requestAnimationFrame(tick);
  }
};

document.addEventListener('visibilitychange', () => setRunning(!document.hidden && inView));
new IntersectionObserver(([entry]) => {
  inView = entry.isIntersecting;
  setRunning(!document.hidden && inView);
}).observe(document.querySelector('#hero-stage')!);

requestAnimationFrame(tick);

// --- lil-gui только в dev --------------------------------------------------
if (import.meta.env.DEV) {
  import('./gui').then(({ setupGui }) =>
    setupGui({ stage, logo, material, lights: { key, rim }, layout }),
  );
}

// Для отладки из консоли / скриншотов.
Object.assign(window, { __hero: { stage, logo, pivot, root, config } });
