import GUI from 'lil-gui';
import type * as THREE from 'three';
import { config } from './config';
import type { Stage } from './stage';
import type { Logo } from './logo';

type Ctx = {
  stage: Stage;
  logo: Logo;
  material: THREE.MeshPhysicalMaterial;
  lights: { key: THREE.DirectionalLight; rim: THREE.DirectionalLight };
  layout: () => void;
};

export function setupGui({ stage, logo, material, lights, layout }: Ctx) {
  const gui = new GUI({ title: 'hero3d' });
  gui.close();

  const g = gui.addFolder('Логотип');
  const rebuild = () => {
    logo.rebuild();
    layout();
  };
  g.add(config.logo, 'depthRatio', 0.05, 0.6, 0.01).name('глубина / ширина').onFinishChange(rebuild);
  g.add(config.logo, 'bevelSize', 0, 0.08, 0.001).onFinishChange(rebuild);
  g.add(config.logo, 'bevelThickness', 0, 0.15, 0.001).onFinishChange(rebuild);
  g.add(config.logo, 'bevelSegments', 1, 12, 1).onFinishChange(rebuild);

  const m = gui.addFolder('Материал');
  m.addColor(config.material, 'color').onChange((v: string) => material.color.set(v));
  m.add(material, 'metalness', 0, 1, 0.01);
  m.add(material, 'roughness', 0, 1, 0.01);
  m.add(material, 'clearcoat', 0, 1, 0.01);
  m.add(material, 'clearcoatRoughness', 0, 1, 0.01);
  m.add(material, 'envMapIntensity', 0, 2, 0.01);

  const e = gui.addFolder('Окружение / свет');
  e.add(stage.scene, 'environmentIntensity', 0, 2, 0.01).name('env intensity');
  e.add(stage.renderer, 'toneMappingExposure', 0.2, 3, 0.01).name('exposure');
  e.add(lights.key, 'intensity', 0, 5, 0.01).name('key');
  e.add(lights.rim, 'intensity', 0, 10, 0.01).name('rim (временный)');

  const p = gui.addFolder('Ракурс');
  p.add(config.pose, 'rotX', -Math.PI, Math.PI, 0.01);
  p.add(config.pose, 'rotY', -Math.PI, Math.PI, 0.01);
  p.add(config.pose, 'rotZ', -Math.PI, Math.PI, 0.01);
  p.add(config.pose, 'autoRotate');
  p.add(config.pose, 'autoRotateSpeed', 0, 2, 0.01);

  const l = gui.addFolder('Раскладка');
  l.add(config.layout, 'heightDesktop', 0.2, 0.9, 0.01).onChange(layout);
  l.add(config.layout, 'maxWidthDesktop', 0.2, 0.9, 0.01).onChange(layout);
  l.add(config.layout, 'offsetXDesktop', -0.4, 0.4, 0.01).onChange(layout);

  return gui;
}
