import * as THREE from 'three';
import { config } from './config';

// Шаг 1: базовый «обсидиан». Hot-spot и rim (onBeforeCompile) — шаг 2.
export function createLogoMaterial() {
  const m = config.material;
  return new THREE.MeshPhysicalMaterial({
    color: m.color,
    metalness: m.metalness,
    roughness: m.roughness,
    clearcoat: m.clearcoat,
    clearcoatRoughness: m.clearcoatRoughness,
    envMapIntensity: m.envMapIntensity,
  });
}
