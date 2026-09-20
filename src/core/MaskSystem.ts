// ============================================================================
// MaskSystem.ts — 遮罩系统: 绘制/清除/反选 + Nomad式半透明高亮
// ============================================================================

import {
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  Mesh,
  Raycaster,
  Vector3,
  MeshBasicMaterial,
  DoubleSide,
  AdditiveBlending,
} from 'three';
import type { MaskData, MaskConfig } from '../types';
import { DEFAULT_MASK_CONFIG, NOMAD_THEME } from '../types';

export class MaskSystem {
  private maskData: MaskData | null = null;
  private config: MaskConfig;
  private maskMesh: Mesh | null = null;
  private maskMaterial: MeshBasicMaterial;
  private vertexCount: number = 0;

  constructor() {
    this.config = {
      ...DEFAULT_MASK_CONFIG,
      highlightColor: new Color(NOMAD_THEME.maskColor),
    };

    this.maskMaterial = new MeshBasicMaterial({
      color: this.config.highlightColor,
      transparent: true,
      opacity: this.config.maxOpacity,
      side: DoubleSide,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
  }

  initialize(geometry: BufferGeometry): void {
    this.vertexCount = geometry.attributes.position.count;
    const maskArray = new Float32Array(this.vertexCount);

    this.maskData = {
      vertexMask: maskArray,
      visible: true,
      opacity: this.config.maxOpacity,
      color: this.config.highlightColor.clone(),
    };

    this.createMaskOverlay(geometry);
  }

  private createMaskOverlay(geometry: BufferGeometry): void {
    const overlayGeo = new BufferGeometry();
    const positions = geometry.attributes.position;

    const colorArray = new Float32Array(positions.count * 4);
    overlayGeo.setAttribute('position', new Float32BufferAttribute(positions.array, 3));
    overlayGeo.setAttribute('color', new Float32BufferAttribute(colorArray, 4));

    if (geometry.index) {
      overlayGeo.setIndex(geometry.index);
    }

    this.maskMaterial.opacity = this.config.maxOpacity;
    this.maskMesh = new Mesh(overlayGeo, this.maskMaterial);
    this.maskMesh.visible = false;
    this.maskMesh.renderOrder = 1;
  }

  drawFromPoints(
    sourceMesh: Mesh,
    points: Array<{ x: number; y: number }>,
    camera: unknown,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (!this.maskData) return;

    const raycaster = new Raycaster();
    const positions = sourceMesh.geometry.attributes.position;

    for (const pt of points) {
      const ndcX = (pt.x / canvasWidth) * 2 - 1;
      const ndcY = -(pt.y / canvasHeight) * 2 + 1;
      raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera as never);

      const intersects = raycaster.intersectObject(sourceMesh, false);
      if (intersects.length === 0) continue;

      const hitPoint = intersects[0].point;
      const radius = this.config.brushSize;

      for (let i = 0; i < positions.count; i++) {
        const dx = positions.getX(i) - hitPoint.x;
        const dy = positions.getY(i) - hitPoint.y;
        const dz = positions.getZ(i) - hitPoint.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < radius) {
          const falloff = Math.cos((dist / radius) * (Math.PI / 2));
          const newMask = Math.max(this.maskData.vertexMask[i], falloff * this.config.brushStrength);
          this.maskData.vertexMask[i] = newMask;
        }
      }
    }

    this.updateMaskOverlay();
  }

  clearMask(): void {
    if (!this.maskData) return;
    this.maskData.vertexMask.fill(0);
    this.updateMaskOverlay();
  }

  invertMask(): void {
    if (!this.maskData) return;
    for (let i = 0; i < this.maskData.vertexMask.length; i++) {
      this.maskData.vertexMask[i] = 1 - this.maskData.vertexMask[i];
    }
    this.updateMaskOverlay();
  }

  clearArea(
    sourceMesh: Mesh,
    points: Array<{ x: number; y: number }>,
    camera: unknown,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (!this.maskData) return;

    const raycaster = new Raycaster();
    const positions = sourceMesh.geometry.attributes.position;

    for (const pt of points) {
      const ndcX = (pt.x / canvasWidth) * 2 - 1;
      const ndcY = -(pt.y / canvasHeight) * 2 + 1;
      raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera as never);

      const intersects = raycaster.intersectObject(sourceMesh, false);
      if (intersects.length === 0) continue;

      const hitPoint = intersects[0].point;
      const radius = this.config.brushSize;

      for (let i = 0; i < positions.count; i++) {
        const dx = positions.getX(i) - hitPoint.x;
        const dy = positions.getY(i) - hitPoint.y;
        const dz = positions.getZ(i) - hitPoint.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < radius) {
          const falloff = Math.cos((dist / radius) * (Math.PI / 2));
          const decrease = falloff * this.config.brushStrength;
          this.maskData.vertexMask[i] = Math.max(0, this.maskData.vertexMask[i] - decrease);
        }
      }
    }

    this.updateMaskOverlay();
  }

  private updateMaskOverlay(): void {
    if (!this.maskData || !this.maskMesh) return;

    const colorAttr = this.maskMesh.geometry.attributes.color;
    const colors = colorAttr.array as Float32Array;

    for (let i = 0; i < this.vertexCount; i++) {
      const m = this.maskData.vertexMask[i];
      const opacity = m * (this.config.maxOpacity - this.config.minOpacity) + this.config.minOpacity;
      colors[i * 4] = this.config.highlightColor.r;
      colors[i * 4 + 1] = this.config.highlightColor.g;
      colors[i * 4 + 2] = this.config.highlightColor.b;
      colors[i * 4 + 3] = m > 0 ? opacity : 0;
    }

    colorAttr.needsUpdate = true;

    let hasMasked = false;
    for (let i = 0; i < this.maskData.vertexMask.length; i++) {
      if (this.maskData.vertexMask[i] > 0) {
        hasMasked = true;
        break;
      }
    }
    this.maskMesh.visible = hasMasked && this.maskData.visible;
  }

  getMaskData(): Float32Array | null {
    return this.maskData ? this.maskData.vertexMask : null;
  }

  isMasked(vertexIndex: number): boolean {
    if (!this.maskData) return false;
    return this.maskData.vertexMask[vertexIndex] > 0;
  }

  getMaskValue(vertexIndex: number): number {
    if (!this.maskData) return 0;
    return this.maskData.vertexMask[vertexIndex];
  }

  getMaskedVertexCount(): number {
    if (!this.maskData) return 0;
    let count = 0;
    for (let i = 0; i < this.maskData.vertexMask.length; i++) {
      if (this.maskData.vertexMask[i] > 0) count++;
    }
    return count;
  }

  hasMask(): boolean {
    if (!this.maskData) return false;
    return this.getMaskedVertexCount() > 0;
  }

  setOpacity(opacity: number): void {
    if (!this.maskData) return;
    this.maskData.opacity = opacity;
    this.maskMaterial.opacity = opacity;
  }

  setVisible(visible: boolean): void {
    if (!this.maskData) return;
    this.maskData.visible = visible;
    if (this.maskMesh) {
      this.maskMesh.visible = visible && this.hasMask();
    }
  }

  getMaskMesh(): Mesh | null {
    return this.maskMesh;
  }

  setBrushSize(size: number): void {
    this.config.brushSize = size;
  }

  setBrushStrength(strength: number): void {
    this.config.brushStrength = strength;
  }

  setHighlightColor(color: Color): void {
    this.config.highlightColor = color;
    this.maskMaterial.color = color;
    if (this.maskData) {
      this.maskData.color = color.clone();
    }
    this.updateMaskOverlay();
  }

  attachToScene(scene: import('three').Scene): void {
    if (this.maskMesh) {
      scene.add(this.maskMesh);
    }
  }

  removeFromScene(scene: import('three').Scene): void {
    if (this.maskMesh) {
      scene.remove(this.maskMesh);
    }
  }

  syncGeometry(geometry: BufferGeometry): void {
    this.vertexCount = geometry.attributes.position.count;
    if (this.maskData) {
      const newMask = new Float32Array(this.vertexCount);
      const copyLen = Math.min(newMask.length, this.maskData.vertexMask.length);
      newMask.set(this.maskData.vertexMask.subarray(0, copyLen));
      this.maskData.vertexMask = newMask;
    }

    if (this.maskMesh) {
      this.maskMesh.geometry.dispose();
      this.createMaskOverlay(geometry);
    }
    this.updateMaskOverlay();
  }

  dispose(): void {
    if (this.maskMesh) {
      this.maskMesh.geometry.dispose();
      this.maskMaterial.dispose();
      this.maskMesh = null;
    }
    this.maskData = null;
  }
}
