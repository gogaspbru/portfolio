import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { config } from './config';

export type Stage = ReturnType<typeof createStage>;

export function createStage(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = config.render.exposure;
  renderer.setClearColor(config.background, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(config.background);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = config.environment.intensity;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(config.camera.fov, 1, 0.1, 100);
  camera.position.set(0, 0, config.camera.distance);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  const size = { width: 1, height: 1, dpr: 1 };

  const resize = () => {
    size.width = window.innerWidth;
    size.height = window.innerHeight;
    size.dpr = Math.min(window.devicePixelRatio || 1, config.render.maxDpr);
    renderer.setPixelRatio(size.dpr);
    renderer.setSize(size.width, size.height, false);
    composer.setPixelRatio(size.dpr);
    composer.setSize(size.width, size.height);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
  };

  // Видимый размер плоскости z=0 в мировых единицах.
  const viewSizeAtOrigin = () => {
    const h = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    return { width: h * camera.aspect, height: h };
  };

  return { renderer, scene, camera, composer, size, resize, viewSizeAtOrigin };
}
