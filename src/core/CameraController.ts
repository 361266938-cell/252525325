// ============================================================================
// CameraController.ts — 触控相机: 单指旋转/双指平移缩放/三指切视角/正交透视
// ============================================================================

import { Vector2, Vector3, Spherical, MathUtils } from 'three';
import type { SceneManager } from './SceneManager';
import type { TouchGesture, PointerEvent } from '../types';

export class CameraController {
  private sm: SceneManager;
  private domElement: HTMLElement;

  private pointers: Map<number, PointerEvent> = new Map();
  private isAnimating: boolean = false;

  private spherical: Spherical = new Spherical();
  private target: Vector3 = new Vector3(0, 0, 0);
  private panOffset: Vector3 = new Vector3();

  private rotateSpeed: number = 1.0;
  private panSpeed: number = 1.0;
  private zoomSpeed: number = 1.0;
  private dampingFactor: number = 0.08;

  private rotateDelta: Vector2 = new Vector2();
  private panDelta: Vector2 = new Vector2();
  private scale: number = 1;

  private lastDoubleTap: number = 0;
  private doubleTapThreshold: number = 300;

  private minDistance: number = 1;
  private maxDistance: number = 100;

  private onCameraChange: (() => void) | null = null;

  private boundHandlers: Record<string, EventListener> = {};

  constructor(sm: SceneManager) {
    this.sm = sm;
    this.domElement = sm.renderer.domElement;

    const cam = sm.activeCamera;
    this.target.set(0, 0, 0);
    const offset = new Vector3().subVectors(cam.position, this.target);
    this.spherical.setFromVector3(offset);

    this.boundHandlers = {
      pointerdown: this.onPointerDown as EventListener,
      pointermove: this.onPointerMove as EventListener,
      pointerup: this.onPointerUp as EventListener,
      pointercancel: this.onPointerUp as EventListener,
      wheel: this.onWheel as EventListener,
    };

    this.domElement.addEventListener('pointerdown', this.boundHandlers.pointerdown);
    this.domElement.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
  }

  setCameraChangeCallback(cb: () => void): void {
    this.onCameraChange = cb;
  }

  private notifyCameraChange(): void {
    if (this.onCameraChange) this.onCameraChange();
  }

  private onPointerDown(e: PointerEvent_global): void {
    this.domElement.setPointerCapture(e.pointerId);

    const pe: PointerEvent = this.toPointerEvent(e);
    this.pointers.set(e.pointerId, pe);

    const count = this.pointers.size;

    if (count === 1) {
      this.rotateDelta.set(0, 0);
    } else if (count === 2) {
      this.panDelta.set(0, 0);
      this.scale = 1;
    } else if (count === 3) {
      this.toggleCameraMode();
      this.pointers.clear();
    }
  }

  private onPointerMove(e: PointerEvent_global): void {
    if (!this.pointers.has(e.pointerId)) return;

    const pe: PointerEvent = this.toPointerEvent(e);
    this.pointers.set(e.pointerId, pe);

    const count = this.pointers.size;

    if (count === 1) {
      const last = this.getLastPointer(e.pointerId);
      if (last) {
        const dx = pe.x - last.x;
        const dy = pe.y - last.y;
        this.rotateDelta.set(dx, dy);
        this.applyRotation(dx, dy);
      }
    } else if (count === 2) {
      const pts = Array.from(this.pointers.values());
      const dx0 = pts[0].x - pts[1].x;
      const dy0 = pts[0].y - pts[1].y;
      const dist = Math.sqrt(dx0 * dx0 + dy0 * dy0);

      const prevPts = this.getPreviousPositions();
      if (prevPts) {
        const pdx = prevPts[0].x - prevPts[1].x;
        const pdy = prevPts[0].y - prevPts[1].y;
        const prevDist = Math.sqrt(pdx * pdx + pdy * pdy);

        if (prevDist > 0) {
          this.scale = dist / prevDist;
          this.applyZoom(this.scale);
        }

        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const prevMidX = (prevPts[0].x + prevPts[1].x) / 2;
        const prevMidY = (prevPts[0].y + prevPts[1].y) / 2;
        const panDx = midX - prevMidX;
        const panDy = midY - prevMidY;
        this.applyPan(panDx, panDy);
      }
    }
  }

  private onPointerUp(e: PointerEvent_global): void {
    this.pointers.delete(e.pointerId);

    if (this.pointers.size === 0) {
      const now = Date.now();
      if (now - this.lastDoubleTap < this.doubleTapThreshold) {
        this.sm.activeCamera === this.sm.perspectiveCamera;
      }
      this.lastDoubleTap = now;
    }
  }

  private onWheel(e: WheelEvent_global): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    this.applyZoom(delta);
  }

  private applyRotation(dx: number, dy: number): void {
    const rect = this.domElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const thetaDelta = (2 * Math.PI * dx * this.rotateSpeed) / w;
    const phiDelta = (2 * Math.PI * dy * this.rotateSpeed) / h;

    this.spherical.theta -= thetaDelta;
    this.spherical.phi -= phiDelta;
    this.spherical.phi = MathUtils.clamp(this.spherical.phi, 0.1, Math.PI - 0.1);

    this.updateCamera();
  }

  private applyPan(dx: number, dy: number): void {
    const cam = this.sm.activeCamera;
    const rect = this.domElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const panLeft = new Vector3();
    const panUp = new Vector3();

    panLeft.setFromMatrixColumn(cam.matrix, 0);
    panUp.setFromMatrixColumn(cam.matrix, 1);

    const panX = panLeft.multiplyScalar(-(dx * this.panSpeed * 0.01));
    const panY = panUp.multiplyScalar(dy * this.panSpeed * 0.01);

    this.panOffset.copy(panX).add(panY);
    this.target.add(this.panOffset);

    this.updateCamera();
  }

  private applyZoom(scale: number): void {
    const newRadius = this.spherical.radius / scale;
    this.spherical.radius = MathUtils.clamp(newRadius, this.minDistance, this.maxDistance);
    this.updateCamera();
  }

  private updateCamera(): void {
    const offset = new Vector3().setFromSpherical(this.spherical);
    const cam = this.sm.activeCamera;
    cam.position.copy(this.target).add(offset);
    cam.lookAt(this.target);
    cam.updateMatrixWorld();
    this.notifyCameraChange();
  }

  toggleCameraMode(): void {
    const currentMode = this.sm.getCameraMode();
    this.sm.setCameraMode(currentMode === 'perspective' ? 'orthographic' : 'perspective');
    this.updateCamera();
    this.notifyCameraChange();
  }

  setCameraTarget(x: number, y: number, z: number): void {
    this.target.set(x, y, z);
    this.updateCamera();
  }

  setCameraPosition(x: number, y: number, z: number): void {
    const offset = new Vector3(x - this.target.x, y - this.target.y, z - this.target.z);
    this.spherical.setFromVector3(offset);
    this.updateCamera();
  }

  setRotation(theta: number, phi: number): void {
    this.spherical.theta = theta;
    this.spherical.phi = MathUtils.clamp(phi, 0.1, Math.PI - 0.1);
    this.updateCamera();
  }

  setDistance(distance: number): void {
    this.spherical.radius = MathUtils.clamp(distance, this.minDistance, this.maxDistance);
    this.updateCamera();
  }

  resetCamera(): void {
    this.target.set(0, 0, 0);
    this.spherical.set(7, MathUtils.degToRad(55), MathUtils.degToRad(45));
    this.updateCamera();
  }

  private toPointerEvent(e: PointerEvent_global): PointerEvent {
    const rect = this.domElement.getBoundingClientRect();
    return {
      pointerId: e.pointerId,
      pointerType: e.pointerType as PointerEvent['pointerType'],
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure !== undefined ? e.pressure : 1,
      tiltX: e.tiltX !== undefined ? e.tiltX : 0,
      tiltY: e.tiltY !== undefined ? e.tiltY : 0,
      twist: e.twist !== undefined ? e.twist : 0,
      isPrimary: e.isPrimary !== undefined ? e.isPrimary : true,
      buttons: e.buttons !== undefined ? e.buttons : 0,
      timestamp: Date.now(),
    };
  }

  private getLastPointer(id: number): PointerEvent | null {
    const entries = Array.from(this.pointers.entries()).filter(([k]) => k !== id);
    if (entries.length === 0) return null;
    return entries[entries.length - 1][1];
  }

  private prevPositions: Map<number, PointerEvent> = new Map();
  private getPreviousPositions(): [PointerEvent, PointerEvent] | null {
    const pts = Array.from(this.pointers.values());
    if (pts.length < 2) return null;

    if (this.prevPositions.size < 2) {
      this.prevPositions = new Map(this.pointers);
      return null;
    }

    const prevPts = Array.from(this.prevPositions.values());
    this.prevPositions = new Map(this.pointers);
    return [prevPts[0], prevPts[1]];
  }

  getGestureInfo(): TouchGesture | null {
    if (this.pointers.size === 0) return null;
    const pts = Array.from(this.pointers.values());
    let type: TouchGesture['type'] = 'rotate';
    if (pts.length === 2) type = 'pan';
    else if (pts.length === 3) type = 'tripleFinger';

    return {
      type,
      pointers: pts,
      centerX: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      centerY: pts.reduce((s, p) => s + p.y, 0) / pts.length,
      scale: this.scale,
      rotation: 0,
    };
  }

  dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.boundHandlers.pointerdown);
    this.domElement.removeEventListener('wheel', this.boundHandlers.wheel);
    this.pointers.clear();
    this.prevPositions.clear();
  }
}

// ── 全局 DOM 类型补充 (避免 TS lib 冲突) ─────────────────────────────────
interface PointerEvent_global {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  twist: number;
  isPrimary: boolean;
  buttons: number;
  preventDefault(): void;
}

interface WheelEvent_global {
  deltaY: number;
  preventDefault(): void;
}
