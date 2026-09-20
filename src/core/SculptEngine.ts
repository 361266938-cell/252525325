// ============================================================================
// SculptEngine.ts — 雕刻引擎: Raycast拾取 + 笔刷形变核心逻辑
// ============================================================================

import {
  Mesh,
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  Raycaster,
  FrontSide,
  DoubleSide,
  BackSide,
} from 'three';
import type { SceneManager } from './SceneManager';
import type { BrushSystem } from './BrushSystem';
import type { MaskSystem } from './MaskSystem';
import type { LayerSystem } from './LayerSystem';
import type { StrokePoint, BrushParams, BrushType } from '../types';

export class SculptEngine {
  private sm: SceneManager;
  private brush: BrushSystem;
  private mask: MaskSystem;
  private layers: LayerSystem;

  private activeMesh: Mesh | null = null;
  private raycaster: Raycaster = new Raycaster();
  private isStroking: boolean = false;
  private currentStrokePoints: StrokePoint[] = [];
  private previousHitPoint: Vector3 | null = null;
  private canvasWidth: number = 0;
  private canvasHeight: number = 0;
  private maxStrokePoints: number = 200;

  constructor(
    sm: SceneManager,
    brush: BrushSystem,
    mask: MaskSystem,
    layers: LayerSystem
  ) {
    this.sm = sm;
    this.brush = brush;
    this.mask = mask;
    this.layers = layers;
    this.updateCanvasSize();
  }

  updateCanvasSize(): void {
    const el = this.sm.renderer.domElement;
    this.canvasWidth = el.clientWidth;
    this.canvasHeight = el.clientHeight;
  }

  setActiveMesh(mesh: Mesh): void {
    this.activeMesh = mesh;
  }

  getActiveMesh(): Mesh | null {
    return this.activeMesh;
  }

  raycastFromScreen(x: number, y: number): Vector3 | null {
    if (!this.activeMesh) return null;
    this.updateCanvasSize();
    const ndcX = (x / this.canvasWidth) * 2 - 1;
    const ndcY = -(y / this.canvasHeight) * 2 + 1;
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.sm.activeCamera);
    const intersects = this.raycaster.intersectObject(this.activeMesh, false);
    if (intersects.length > 0) {
      return intersects[0].point.clone();
    }
    return null;
  }

  raycastFromScreenWithNormal(x: number, y: number): { point: Vector3; normal: Vector3; faceIndex: number } | null {
    if (!this.activeMesh) return null;
    this.updateCanvasSize();
    const ndcX = (x / this.canvasWidth) * 2 - 1;
    const ndcY = -(y / this.canvasHeight) * 2 + 1;
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.sm.activeCamera);
    const intersects = this.raycaster.intersectObject(this.activeMesh, false);
    if (intersects.length > 0) {
      const hit = intersects[0];
      return {
        point: hit.point.clone(),
        normal: hit.face ? hit.face.normal.clone() : new Vector3(0, 1, 0),
        faceIndex: hit.faceIndex ?? 0,
      };
    }
    return null;
  }

  beginStroke(point: StrokePoint): void {
    this.isStroking = true;
    this.currentStrokePoints = [point];
    this.previousHitPoint = this.raycastFromScreen(point.x, point.y);
  }

  continueStroke(point: StrokePoint): void {
    if (!this.isStroking) return;
    this.currentStrokePoints.push(point);
    if (this.currentStrokePoints.length > this.maxStrokePoints) {
      this.currentStrokePoints.shift();
    }

    const hitPoint = this.raycastFromScreen(point.x, point.y);
    if (!hitPoint || !this.activeMesh) return;

    const geometry = this.activeMesh.geometry as BufferGeometry;
    const normals = geometry.attributes.normal;
    if (!normals) return;

    const normalsArray = normals.array as Float32Array;
    const maskData = this.mask.getMaskData();

    this.brush.deformVertices(
      geometry,
      hitPoint,
      normalsArray,
      maskData,
      this.previousHitPoint
    );

    this.previousHitPoint = hitPoint;
  }

  endStroke(): StrokePoint[] {
    this.isStroking = false;
    const stroke = this.currentStrokePoints;
    this.currentStrokePoints = [];
    this.previousHitPoint = null;
    return stroke;
  }

  simulateStroke(points: Array<{ x: number; y: number; pressure: number }>): void {
    if (!this.activeMesh) return;
    if (points.length === 0) return;

    this.isStroking = true;
    let prevPoint: Vector3 | null = null;

    for (const pt of points) {
      const hitPoint = this.raycastFromScreen(pt.x, pt.y);
      if (!hitPoint) continue;

      const geometry = this.activeMesh.geometry as BufferGeometry;
      const normals = geometry.attributes.normal;
      if (!normals) continue;

      const normalsArray = normals.array as Float32Array;
      const maskData = this.mask.getMaskData();

      this.brush.deformVertices(
        geometry,
        hitPoint,
        normalsArray,
        maskData,
        prevPoint
      );

      prevPoint = hitPoint;
    }

    this.isStroking = false;
  }

  setBrushSize(size: number): void {
    this.brush.setBrushParams({ size });
  }

  setBrushStrength(strength: number): void {
    this.brush.setBrushParams({ strength });
  }

  setBrushDecay(decay: number): void {
    this.brush.setBrushParams({ decay });
  }

  setBrushType(type: BrushType): void {
    this.brush.setBrushType(type);
  }

  setBrushParams(params: BrushParams): void {
    this.brush.setBrushParams(params);
  }

  isStrokeInProgress(): boolean {
    return this.isStroking;
  }

  getCurrentStrokePointCount(): number {
    return this.currentStrokePoints.length;
  }

  getActiveGeometry(): BufferGeometry | null {
    if (!this.activeMesh) return null;
    return this.activeMesh.geometry as BufferGeometry;
  }

  getVertexCount(): number {
    if (!this.activeMesh) return 0;
    const geo = this.activeMesh.geometry as BufferGeometry;
    return geo.attributes.position.count;
  }

  getFaceCount(): number {
    if (!this.activeMesh) return 0;
    const geo = this.activeMesh.geometry as BufferGeometry;
    if (geo.index) return geo.index.count / 3;
    return geo.attributes.position.count / 3;
  }

  updateMeshGeometry(newGeometry: BufferGeometry): void {
    if (!this.activeMesh) return;
    const oldGeo = this.activeMesh.geometry as BufferGeometry;
    this.activeMesh.geometry = newGeometry;
    oldGeo.dispose();
  }

  recomputeNormals(): void {
    if (!this.activeMesh) return;
    const geo = this.activeMesh.geometry as BufferGeometry;
    geo.computeVertexNormals();
  }

  dispose(): void {
    this.activeMesh = null;
    this.currentStrokePoints = [];
    this.raycaster = new Raycaster();
  }
}
