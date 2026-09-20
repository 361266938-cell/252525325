// ============================================================================
// LayerSystem.ts — 图层系统: 新建/隐藏/复制 + 顶点位移差记录
// ============================================================================

import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  DoubleSide,
  FrontSide,
  Color,
  BufferAttribute,
} from 'three';
import type { SculptLayer, LayerSystemState } from '../types';
import { MAX_UNDO_STACK } from '../types';

export class LayerSystem {
  private layers: SculptLayer[] = [];
  private activeLayerIndex: number = 0;
  private maxLayers: number = 10;
  private mesh: Mesh | null = null;
  private layerGroup: { [key: number]: Mesh } = {};
  private scene: import('three').Scene | null = null;
  private layerCounter: number = 0;

  constructor() {
    this.layers = [];
    this.activeLayerIndex = 0;
  }

  initialize(baseGeometry: BufferGeometry, material: MeshStandardMaterial): Mesh {
    const layer: SculptLayer = {
      index: 0,
      name: 'Layer 0',
      visible: true,
      opacity: 1.0,
      baseGeometry: baseGeometry.clone(),
      displacement: new Float32Array(baseGeometry.attributes.position.count * 3),
      vertexColors: null,
      mask: null,
      metadata: {
        vertexCount: baseGeometry.attributes.position.count,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        strokeCount: 0,
      },
    };

    this.layers = [layer];
    this.activeLayerIndex = 0;

    const mesh = new Mesh(baseGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mesh = mesh;

    return mesh;
  }

  attachToScene(scene: import('three').Scene): void {
    this.scene = scene;
    if (this.mesh) {
      scene.add(this.mesh);
    }
  }

  newLayer(): number {
    if (this.layers.length >= this.maxLayers) {
      console.warn('[LayerSystem] Max layers reached');
      return this.activeLayerIndex;
    }

    const currentLayer = this.layers[this.activeLayerIndex];
    if (!currentLayer || !currentLayer.baseGeometry) {
      return this.activeLayerIndex;
    }

    const newIndex = this.layers.length;
    this.layerCounter++;

    const baseGeo = currentLayer.baseGeometry.clone();
    const disp = new Float32Array(baseGeo.attributes.position.count * 3);

    const layer: SculptLayer = {
      index: newIndex,
      name: `Layer ${newIndex}`,
      visible: true,
      opacity: 1.0,
      baseGeometry: baseGeo,
      displacement: disp,
      vertexColors: null,
      mask: null,
      metadata: {
        vertexCount: baseGeo.attributes.position.count,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        strokeCount: 0,
      },
    };

    this.layers.push(layer);
    this.activeLayerIndex = newIndex;

    return newIndex;
  }

  toggleVisible(index: number): void {
    if (index < 0 || index >= this.layers.length) return;
    this.layers[index].visible = !this.layers[index].visible;
    this.applyLayerVisibility();
  }

  setVisible(index: number, visible: boolean): void {
    if (index < 0 || index >= this.layers.length) return;
    this.layers[index].visible = visible;
    this.applyLayerVisibility();
  }

  private applyLayerVisibility(): void {
    if (!this.mesh) return;
    const activeLayer = this.layers[this.activeLayerIndex];
    if (activeLayer) {
      this.mesh.visible = activeLayer.visible;
    }
  }

  duplicateLayer(index: number): number {
    if (index < 0 || index >= this.layers.length) return -1;
    if (this.layers.length >= this.maxLayers) {
      console.warn('[LayerSystem] Max layers reached');
      return -1;
    }

    const source = this.layers[index];
    if (!source.baseGeometry) return -1;

    const newIndex = this.layers.length;
    this.layerCounter++;

    const baseGeo = source.baseGeometry.clone();
    const disp = source.displacement ? new Float32Array(source.displacement) : new Float32Array(baseGeo.attributes.position.count * 3);

    const layer: SculptLayer = {
      index: newIndex,
      name: `${source.name} copy`,
      visible: true,
      opacity: source.opacity,
      baseGeometry: baseGeo,
      displacement: disp,
      vertexColors: source.vertexColors ? new Float32Array(source.vertexColors) : null,
      mask: source.mask ? {
        vertexMask: new Float32Array(source.mask.vertexMask),
        visible: source.mask.visible,
        opacity: source.mask.opacity,
        color: source.mask.color.clone(),
      } : null,
      metadata: {
        vertexCount: baseGeo.attributes.position.count,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        strokeCount: source.metadata.strokeCount,
      },
    };

    this.layers.push(layer);
    return newIndex;
  }

  deleteLayer(index: number): void {
    if (this.layers.length <= 1) return;
    if (index < 0 || index >= this.layers.length) return;

    const layer = this.layers[index];
    if (layer.baseGeometry) layer.baseGeometry.dispose();

    this.layers.splice(index, 1);

    for (let i = index; i < this.layers.length; i++) {
      this.layers[i].index = i;
    }

    if (this.activeLayerIndex >= this.layers.length) {
      this.activeLayerIndex = this.layers.length - 1;
    }
  }

  setActive(index: number): void {
    if (index < 0 || index >= this.layers.length) return;
    this.activeLayerIndex = index;
    this.applyActiveLayerGeometry();
  }

  getActiveIndex(): number {
    return this.activeLayerIndex;
  }

  private applyActiveLayerGeometry(): void {
    if (!this.mesh) return;
    const layer = this.layers[this.activeLayerIndex];
    if (!layer || !layer.baseGeometry) return;

    const currentGeo = this.mesh.geometry as BufferGeometry;
    const newGeo = layer.baseGeometry.clone();

    if (layer.displacement) {
      const positions = newGeo.attributes.position;
      const disp = layer.displacement;
      for (let i = 0; i < positions.count && i * 3 < disp.length; i++) {
        positions.setXYZ(
          i,
          positions.getX(i) + disp[i * 3],
          positions.getY(i) + disp[i * 3 + 1],
          positions.getZ(i) + disp[i * 3 + 2]
        );
      }
      positions.needsUpdate = true;
    }

    newGeo.computeVertexNormals();
    this.mesh.geometry = newGeo;
    currentGeo.dispose();
    this.mesh.visible = layer.visible;
  }

  recordDisplacement(vertexIndex: number, dx: number, dy: number, dz: number): void {
    const layer = this.layers[this.activeLayerIndex];
    if (!layer || !layer.displacement) return;
    if (vertexIndex * 3 + 2 >= layer.displacement.length) return;

    layer.displacement[vertexIndex * 3] += dx;
    layer.displacement[vertexIndex * 3 + 1] += dy;
    layer.displacement[vertexIndex * 3 + 2] += dz;
    layer.metadata.modifiedAt = Date.now();
  }

  recordStroke(): void {
    const layer = this.layers[this.activeLayerIndex];
    if (!layer) return;
    layer.metadata.strokeCount++;
    layer.metadata.modifiedAt = Date.now();
  }

  getLayer(index: number): SculptLayer | null {
    if (index < 0 || index >= this.layers.length) return null;
    return this.layers[index];
  }

  getAllLayers(): SculptLayer[] {
    return this.layers;
  }

  getLayerCount(): number {
    return this.layers.length;
  }

  getState(): LayerSystemState {
    return {
      layers: this.layers.map((l) => ({ ...l })),
      activeLayerIndex: this.activeLayerIndex,
      maxLayers: this.maxLayers,
    };
  }

  renameLayer(index: number, name: string): void {
    if (index < 0 || index >= this.layers.length) return;
    this.layers[index].name = name;
  }

  setLayerOpacity(index: number, opacity: number): void {
    if (index < 0 || index >= this.layers.length) return;
    this.layers[index].opacity = Math.max(0, Math.min(1, opacity));
  }

  mergeDown(index: number): void {
    if (index <= 0 || index >= this.layers.length) return;
    const top = this.layers[index];
    const bottom = this.layers[index - 1];
    if (!top.displacement || !bottom.displacement) return;

    const len = Math.min(top.displacement.length, bottom.displacement.length);
    for (let i = 0; i < len; i++) {
      bottom.displacement[i] += top.displacement[i];
    }
    bottom.metadata.strokeCount += top.metadata.strokeCount;

    this.deleteLayer(index);
  }

  flattenAll(): BufferGeometry | null {
    if (this.layers.length === 0) return null;
    const base = this.layers[0];
    if (!base.baseGeometry) return null;

    const merged = base.baseGeometry.clone();
    const positions = merged.attributes.position;

    for (const layer of this.layers) {
      if (!layer.displacement) continue;
      const disp = layer.displacement;
      for (let i = 0; i < positions.count && i * 3 < disp.length; i++) {
        positions.setXYZ(
          i,
          positions.getX(i) + disp[i * 3] * layer.opacity,
          positions.getY(i) + disp[i * 3 + 1] * layer.opacity,
          positions.getZ(i) + disp[i * 3 + 2] * layer.opacity
        );
      }
    }

    positions.needsUpdate = true;
    merged.computeVertexNormals();
    merged.computeBoundingBox();
    merged.computeBoundingSphere();

    return merged;
  }

  syncGeometry(newGeometry: BufferGeometry): void {
    for (const layer of this.layers) {
      if (!layer.baseGeometry) continue;
      const oldPos = layer.baseGeometry.attributes.position;
      const newPos = newGeometry.attributes.position;

      if (oldPos.count !== newPos.count) {
        layer.baseGeometry = newGeometry.clone();
        layer.displacement = new Float32Array(newPos.count * 3);
        layer.metadata.vertexCount = newPos.count;
      }
    }

    if (this.mesh) {
      this.mesh.geometry = newGeometry;
    }
  }

  dispose(): void {
    for (const layer of this.layers) {
      if (layer.baseGeometry) layer.baseGeometry.dispose();
    }
    this.layers = [];
    this.mesh = null;
  }
}
