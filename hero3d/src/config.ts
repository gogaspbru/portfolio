// Все настраиваемые параметры сцены. lil-gui (dev) правит этот объект напрямую.

export const config = {
  background: '#0a0a0b',

  camera: {
    fov: 32,
    distance: 9,
  },

  layout: {
    // Высота логотипа как доля высоты вьюпорта.
    heightDesktop: 0.6,
    heightMobile: 0.42,
    // Ограничение ширины знака как доля видимой ширины.
    maxWidthDesktop: 0.5,
    maxWidthMobile: 0.86,
    // Смещение центра логотипа по X как доля видимой ширины (0 — центр).
    offsetXDesktop: 0.2,
    offsetXMobile: 0,
    // Смещение по Y как доля видимой высоты (для мобильных — ниже заголовка).
    offsetYDesktop: 0,
    offsetYMobile: -0.12,
  },

  logo: {
    // Глубина экструзии как доля ширины знака.
    depthRatio: 0.28,
    bevelSegments: 7,
    bevelSize: 0.045, // в единицах нормализованного знака (ширина = 2)
    bevelThickness: 0.06,
    curveSegments: 48,
  },

  material: {
    color: '#0b0b0d',
    metalness: 0.3,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.35,
  },

  environment: {
    intensity: 0.22,
  },

  // Временный свет для шага 1, чтобы читалась форма. На шаге 2 основную
  // работу возьмут hot-spot и rim.
  lights: {
    keyColor: '#ffffff',
    keyIntensity: 0.35,
    rimColor: '#ff7a1a',
    rimIntensity: 2.2,
  },

  // Статичный ракурс для проверки экструзии на шаге 1 (радианы).
  pose: {
    rotX: -0.18,
    rotY: -0.55,
    rotZ: 0.04,
    autoRotate: false,
    autoRotateSpeed: 0.25,
  },

  render: {
    maxDpr: 2,
    exposure: 1,
  },
};

export type Config = typeof config;
