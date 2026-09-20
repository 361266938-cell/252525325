// ============================================================================
// PointerInput.ts — 指针输入: S-Pen/Wacom压感 + 触控统一
// ============================================================================

import type { PointerEvent, PointerType, TouchGesture, InputState } from '../types';

type PointerDownHandler = (pe: PointerEvent) => void;
type PointerMoveHandler = (pe: PointerEvent) => void;
type PointerUpHandler = (pe: PointerEvent) => void;
type DoubleTapHandler = () => void;
type TripleFingerHandler = () => void;
type GestureHandler = (gesture: TouchGesture) => void;

export class PointerInput {
  private domElement: HTMLElement;
  private pointers: Map<number, PointerEvent> = new Map();
  private prevPositions: Map<number, PointerEvent> = new Map();
  private isStroking: boolean = false;
  private lastDoubleTapTime: number = 0;
  private doubleTapThreshold: number = 300;

  private hasPenSupport: boolean = false;
  private maxPressure: number = 1;

  private onPointerDown: PointerDownHandler | null = null;
  private onPointerMove: PointerMoveHandler | null = null;
  private onPointerUp: PointerUpHandler | null = null;
  private onDoubleTap: DoubleTapHandler | null = null;
  private onTripleFinger: TripleFingerHandler | null = null;
  private onGesture: GestureHandler | null = null;

  private boundHandlers: Record<string, EventListener> = {};

  constructor(domElement: HTMLElement) {
    this.domElement = domElement;
    this.domElement.style.touchAction = 'none';

    this.boundHandlers = {
      pointerdown: this.handlePointerDown as EventListener,
      pointermove: this.handlePointerMove as EventListener,
      pointerup: this.handlePointerUp as EventListener,
      pointercancel: this.handlePointerUp as EventListener,
      pointerleave: this.handlePointerLeave as EventListener,
    };

    for (const [event, handler] of Object.entries(this.boundHandlers)) {
      this.domElement.addEventListener(event, handler);
    }

    this.detectPenSupport();
  }

  private detectPenSupport(): void {
    if (typeof window !== 'undefined' && window.PointerEvent) {
      this.hasPenSupport = true;
    }
  }

  hasPen(): boolean {
    return this.hasPenSupport;
  }

  setHandlers(handlers: {
    onPointerDown?: PointerDownHandler;
    onPointerMove?: PointerMoveHandler;
    onPointerUp?: PointerUpHandler;
    onDoubleTap?: DoubleTapHandler;
    onTripleFinger?: TripleFingerHandler;
    onGesture?: GestureHandler;
  }): void {
    this.onPointerDown = handlers.onPointerDown || null;
    this.onPointerMove = handlers.onPointerMove || null;
    this.onPointerUp = handlers.onPointerUp || null;
    this.onDoubleTap = handlers.onDoubleTap || null;
    this.onTripleFinger = handlers.onTripleFinger || null;
    this.onGesture = handlers.onGesture || null;
  }

  private handlePointerDown(e: PointerEvent_dom): void {
    e.preventDefault();
    this.domElement.setPointerCapture(e.pointerId);

    const pe = this.toPointerEvent(e);
    this.pointers.set(e.pointerId, pe);
    this.prevPositions.set(e.pointerId, { ...pe });

    if (pe.pointerType === 'pen') {
      this.hasPenSupport = true;
      if (pe.pressure > this.maxPressure) {
        this.maxPressure = pe.pressure;
      }
    }

    const count = this.pointers.size;

    if (count === 1) {
      this.isStroking = true;
      if (this.onPointerDown) this.onPointerDown(pe);
    } else if (count === 2) {
      this.isStroking = false;
    } else if (count === 3) {
      this.isStroking = false;
      if (this.onTripleFinger) this.onTripleFinger();
      this.pointers.clear();
      this.prevPositions.clear();
    }

    if (count >= 2) {
      this.emitGesture('rotate');
    }
  }

  private handlePointerMove(e: PointerEvent_dom): void {
    if (!this.pointers.has(e.pointerId)) return;
    e.preventDefault();

    const pe = this.toPointerEvent(e);
    this.prevPositions.set(e.pointerId, this.pointers.get(e.pointerId)!);
    this.pointers.set(e.pointerId, pe);

    if (this.pointers.size === 1 && this.isStroking) {
      if (this.onPointerMove) this.onPointerMove(pe);
    } else if (this.pointers.size === 2) {
      this.emitGesture('pan');
    }

    if (this.pointers.size >= 2) {
      const pts = Array.from(this.pointers.values());
      if (pts.length >= 2) {
        this.emitGesture(pts.length === 2 ? 'pan' : 'pinch');
      }
    }
  }

  private handlePointerUp(e: PointerEvent_dom): void {
    const pe = this.toPointerEvent(e);
    if (this.pointers.size === 1 && this.isStroking) {
      if (this.onPointerUp) this.onPointerUp(pe);
      this.isStroking = false;

      const now = Date.now();
      if (now - this.lastDoubleTapTime < this.doubleTapThreshold) {
        if (this.onDoubleTap) this.onDoubleTap();
      }
      this.lastDoubleTapTime = now;
    }

    this.pointers.delete(e.pointerId);
    this.prevPositions.delete(e.pointerId);
  }

  private handlePointerLeave(e: PointerEvent_dom): void {
    if (this.pointers.has(e.pointerId)) {
      this.handlePointerUp(e);
    }
  }

  private emitGesture(type: TouchGesture['type']): void {
    if (!this.onGesture) return;
    const pts = Array.from(this.pointers.values());
    if (pts.length === 0) return;

    let scale = 1;
    let rotation = 0;

    if (pts.length === 2) {
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const prevPts = Array.from(this.prevPositions.values());
      if (prevPts.length >= 2) {
        const pdx = prevPts[0].x - prevPts[1].x;
        const pdy = prevPts[0].y - prevPts[1].y;
        const prevDist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (prevDist > 0) scale = dist / prevDist;
      }
    }

    const centerX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const centerY = pts.reduce((s, p) => s + p.y, 0) / pts.length;

    const gesture: TouchGesture = {
      type,
      pointers: pts,
      centerX,
      centerY,
      scale,
      rotation,
    };

    this.onGesture(gesture);
  }

  private toPointerEvent(e: PointerEvent_dom): PointerEvent {
    const rect = this.domElement.getBoundingClientRect();
    const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure :
      (e.buttons > 0 ? 1 : 0);
    return {
      pointerId: e.pointerId,
      pointerType: (e.pointerType || 'touch') as PointerType,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure,
      tiltX: e.tiltX !== undefined ? e.tiltX : 0,
      tiltY: e.tiltY !== undefined ? e.tiltY : 0,
      twist: e.twist !== undefined ? e.twist : 0,
      isPrimary: e.isPrimary !== undefined ? e.isPrimary : true,
      buttons: e.buttons !== undefined ? e.buttons : 0,
      timestamp: Date.now(),
    };
  }

  getActivePointerCount(): number {
    return this.pointers.size;
  }

  getPrimaryPointer(): PointerEvent | null {
    for (const [, value] of this.pointers) {
      if (value.isPrimary) return value;
    }
    return null;
  }

  isStrokingInProgress(): boolean {
    return this.isStroking;
  }

  getMaxPressure(): number {
    return this.maxPressure;
  }

  getInputState(): InputState {
    const currentStroke: PointerEvent[] = [];
    return {
      pointers: this.pointers,
      activePointerCount: this.pointers.size,
      primaryPointer: this.getPrimaryPointer(),
      isStroking: this.isStroking,
      currentStroke,
      gestureBuffer: [],
    };
  }

  dispose(): void {
    for (const [event, handler] of Object.entries(this.boundHandlers)) {
      this.domElement.removeEventListener(event, handler);
    }
    this.pointers.clear();
    this.prevPositions.clear();
  }
}

// ── DOM PointerEvent 类型补充 ────────────────────────────────────────────────
interface PointerEvent_dom {
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
