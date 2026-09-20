// ============================================================================
// VertexColorSystem.ts — 顶点上色: 表面绘画 + 颜色拾取
// ============================================================================

import {
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  Mesh,
  Raycaster,
  Vector3,
} from 'three';
import type { MaskSystem } from './MaskSystem';

export class VertexColorSystem {
  private raycaster: Raycaster = new Raycaster();
  private currentColor: Color = new Color(0xff5500);
  private colorRadius: number = 0.2;
  private colorStrength: number = 0.5;
  private falloff: number = 0.3;

  constructor() {}

  setColor(r: number, g: number, b: number): void {
    this.currentColor.setRGB(r, g, b);
  }

  setColorHex(hex: number): void {
    this.currentColor.setHex(hex);
  }

  getColor(): Color {
    return this.currentColor.clone();
  }

  setRadius(radius: number): void {
    this.colorRadius = Math.max(0.01, radius);
  }

  setStrength(strength: number): void {
    this.colorStrength = Math.max(0, Math.min(1, strength));
  }

  setFalloff(falloff: number): void {
    this.falloff = Math.max(0, Math.min(1, falloff));
  }

  paint(
    sourceMesh: Mesh,
    points: Array<{ x: number; y: number; pressure: number }>,
    camera: unknown,
    canvasWidth: number,
    canvasHeight: number,
    mask: MaskSystem | null
  ): void {
    const geometry = sourceMesh.geometry as BufferGeometry;
    let colorAttr = geometry.attributes.color as Float32BufferAttribute | undefined;

    if (!colorAttr) {
      const count = geometry.attributes.position.count;
      const colors = new Float32Array(count * 3);
      const mat = sourceMesh.material as { vertexColors?: boolean };
      colorAttr = new Float32BufferAttribute(colors, 3);
      geometry.setAttribute('color', colorAttr);
      if (mat) mat.vertexColors = true;
    }

    const colors = colorAttr.array as Float32Array;

    for (const pt of points) {
      const ndcX = (pt.x / canvasWidth) * 2 - 1;
      const ndcY = -(pt.y / canvasHeight) * 2 + 1;
      this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera as never);

      const intersects = this.raycaster.intersectObject(sourceMesh, false);
      if (intersects.length === 0) continue;

      const hitPoint = intersects[0].point;
      const positions = geometry.attributes.position;
      const pressure = pt.pressure > 0 ? pt.pressure : 1;
      const radius = this.colorRadius * (0.5 + pressure * 0.5);
      const rSq = radius * radius;

      for (let i = 0; i < positions.count; i++) {
        const dx = positions.getX(i) - hitPoint.x;
        const dy = positions.getY(i) - hitPoint.y;
        const dz = positions.getZ(i) - hitPoint.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < rSq) {
          if (mask && mask.isMasked(i)) continue;

          const dist = Math.sqrt(distSq);
          const t = dist / radius;
          const falloff = Math.pow(Math.cos((t * Math.PI) / 2), this.falloff * 3 + 1);
          const strength = this.colorStrength * falloff * pressure;

          colors[i * 3] = colors[i * 3] * (1 - strength) + this.currentColor.r * strength;
          colors[i * 3 + 1] = colors[i * 3 + 1] * (1 - strength) + this.currentColor.g * strength;
          colors[i * 3 + 2] = colors[i * 3 + 2] * (1 - strength) + this.currentColor.b * strength;
        }
      }
    }

    colorAttr.needsUpdate = true;
  }

  pickColor(
    sourceMesh: Mesh,
    x: number,
    y: number,
    camera: unknown,
    canvasWidth: number,
    canvasHeight: number
  ): Color | null {
    const ndcX = (x / canvasWidth) * 2 - 1;
    const ndcY = -(y / canvasHeight) * 2 + 1;
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera as never);

    const intersects = this.raycaster.intersectObject(sourceMesh, false);
    if (intersects.length === 0) return null;

    const geometry = sourceMesh.geometry as BufferGeometry;
    const colorAttr = geometry.attributes.color as Float32BufferAttribute | undefined;
    if (!colorAttr) return null;

    const face = intersects[0].face;
    if (!face) return null;

    const a = face.a;
    const b = face.b;
    const c = face.c;

    const colors = colorAttr.array as Float32Array;
    const r = (colors[a * 3] + colors[b * 3] + colors[c * 3]) / 3;
    const g = (colors[a * 3 + 1] + colors[b * 3 + 1] + colors[c * 3 + 1]) / 3;
    const bl = (colors[a * 3 + 2] + colors[b * 3 + 2] + colors[c * 3 + 2]) / 3;

    return new Color(r, g, bl);
  }

  fillAll(geometry: BufferGeometry, r: number, g: number, b: number): void {
    const count = geometry.attributes.position.count;
    let colorAttr = geometry.attributes.color as Float32BufferAttribute | undefined;

    if (!colorAttr) {
      const colors = new Float32Array(count * 3);
      colorAttr = new Float32BufferAttribute(colors, 3);
      geometry.setAttribute('color', colorAttr);
    }

    const colors = colorAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    colorAttr.needsUpdate = true;
  }

  clearColors(geometry: BufferGeometry): void {
    const colorAttr = geometry.attributes.color as Float32BufferAttribute | undefined;
    if (!colorAttr) return;
    const colors = colorAttr.array as Float32Array;
    colors.fill(0.7);
    colorAttr.needsUpdate = true;
  }

  ensureColorAttribute(geometry: BufferGeometry): void {
    if (geometry.attributes.color) return;
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = 0.7;
      colors[i * 3 + 1] = 0.7;
      colors[i * 3 + 2] = 0.7;
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  }

  setVertexColorByPosition(
    geometry: BufferGeometry,
    center: Vector3,
    radius: number,
    r: number,
    g: number,
    b: number,
    mask: MaskSystem | null
  ): void {
    this.ensureColorAttribute(geometry);
    const colorAttr = geometry.attributes.color as Float32BufferAttribute;
    const colors = colorAttr.array as Float32Array;
    const positions = geometry.attributes.position;
    const rSq = radius * radius;

    for (let i = 0; i < positions.count; i++) {
      if (mask && mask.isMasked(i)) continue;
      const dx = positions.getX(i) - center.x;
      const dy = positions.getY(i) - center.y;
      const dz = positions.getZ(i) - center.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < rSq) {
        const dist = Math.sqrt(distSq);
        const t = dist / radius;
        const falloff = Math.cos((t * Math.PI) / 2);
        const s = this.colorStrength * falloff;
        colors[i * 3] = colors[i * 3] * (1 - s) + r * s;
        colors[i * 3 + 1] = colors[i * 3 + 1] * (1 - s) + g * s;
        colors[i * 3 + 2] = colors[i * 3 + 2] * (1 - s) + b * s;
      }
    }

    colorAttr.needsUpdate = true;
  }

  dispose(): void {
    this.raycaster = new Raycaster();
  }
}
