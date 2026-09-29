import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import logoSvg from '../../assets/logo.svg?raw';
import { config } from './config';

export type LogoPart = {
  id: string;
  mesh: THREE.Mesh<THREE.ExtrudeGeometry, THREE.Material>;
  // Позиция части в собранном логотипе (локально внутри группы).
  basePosition: THREE.Vector3;
};

export type Logo = {
  group: THREE.Group;
  parts: LogoPart[];
  // Размер собранного знака в локальных единицах.
  size: THREE.Vector3;
  rebuild: () => void;
};

// Ширина знака в локальных единицах. Всё остальное (bevel и т.п.) задаётся
// относительно неё, поэтому масштаб SVG не важен.
const NORMALIZED_WIDTH = 2;

function parseSvg() {
  const data = new SVGLoader().parse(logoSvg);
  const paths = data.paths.map((p) => ({
    id: (p.userData?.node as Element | undefined)?.id || 'part',
    shapes: p.toShapes(),
  }));

  // Общий bbox всех контуров в координатах SVG.
  const box = new THREE.Box2();
  for (const { shapes } of paths) {
    for (const s of shapes) for (const pt of s.getPoints(16)) box.expandByPoint(pt);
  }
  return { paths, box };
}

export function createLogo(material: THREE.Material): Logo {
  const group = new THREE.Group();
  group.name = 'logo';
  const parts: LogoPart[] = [];
  const size = new THREE.Vector3();

  const build = () => {
    const { paths, box } = parseSvg();
    const svgSize = box.getSize(new THREE.Vector2());
    const svgCenter = box.getCenter(new THREE.Vector2());
    const scale = NORMALIZED_WIDTH / svgSize.x;
    const c = config.logo;
    const depth = NORMALIZED_WIDTH * c.depthRatio;

    size.set(svgSize.x * scale, svgSize.y * scale, depth + c.bevelThickness * 2);

    paths.forEach(({ id, shapes }) => {
      const geo = new THREE.ExtrudeGeometry(shapes, {
        depth: depth / scale,
        bevelEnabled: true,
        bevelSegments: c.bevelSegments,
        bevelSize: c.bevelSize / scale,
        bevelThickness: c.bevelThickness / scale,
        curveSegments: c.curveSegments,
      });
      // SVG: ось Y вниз → переворачиваем. Нормали scale() пересчитывает сам,
      // а порядок обхода треугольников меняется — разворачиваем его вручную
      // (computeVertexNormals тут нельзя: сломает сглаженные нормали фасок).
      geo.translate(-svgCenter.x, -svgCenter.y, -depth / scale / 2);
      geo.scale(scale, -scale, scale);
      flipWinding(geo);

      // Каждая часть — вокруг собственного центра, чтобы её можно было
      // вращать/разносить независимо.
      geo.computeBoundingBox();
      const partCenter = geo.boundingBox!.getCenter(new THREE.Vector3());
      geo.translate(-partCenter.x, -partCenter.y, -partCenter.z);

      const existing = parts.find((p) => p.id === id);
      if (existing) {
        existing.mesh.geometry.dispose();
        existing.mesh.geometry = geo;
        existing.basePosition.copy(partCenter);
        existing.mesh.position.copy(partCenter);
      } else {
        const mesh = new THREE.Mesh(geo, material);
        mesh.name = id;
        mesh.position.copy(partCenter);
        group.add(mesh);
        parts.push({ id, mesh, basePosition: partCenter.clone() });
      }
    });
  };

  build();
  return { group, parts, size, rebuild: build };
}

function flipWinding(geo: THREE.BufferGeometry) {
  const index = geo.getIndex();
  if (index) {
    const a = index.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    index.needsUpdate = true;
    return;
  }
  // ExtrudeGeometry неиндексированная: меняем местами 2-ю и 3-ю вершины.
  for (const name of Object.keys(geo.attributes)) {
    const attr = geo.getAttribute(name) as THREE.BufferAttribute;
    const n = attr.itemSize;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < attr.count; i += 3) {
      for (let k = 0; k < n; k++) {
        const b = (i + 1) * n + k;
        const cc = (i + 2) * n + k;
        const t = arr[b];
        arr[b] = arr[cc];
        arr[cc] = t;
      }
    }
    attr.needsUpdate = true;
  }
}
