// ============================================================================
// StrokeScheduler.ts — 笔触调度器: 长笔触按帧拆分执行防阻塞
// ============================================================================

import type {
  StrokePoint,
  BrushType,
  BrushParams,
  ScheduledStrokeFrame,
  StrokeSchedulerConfig,
  StrokeSchedulerState,
  StrokeSchedulerStatus,
} from '../types';
import { DEFAULT_STROKE_SCHEDULER } from '../types';
import { MathUtils } from '../utils/mathUtils';
import type { MiniNomadFullAPI } from '../types';

export class StrokeScheduler {
  private config: StrokeSchedulerConfig;
  private state: StrokeSchedulerState;
  private api: MiniNomadFullAPI;
  private queue: ScheduledStrokeFrame[] = [];
  private rafId: number = 0;
  private onCompleteCallbacks: Array<(state: StrokeSchedulerState) => void> = [];
  private onProgressCallbacks: Array<(processed: number, total: number) => void> = [];
  private onErrorCallbacks: Array<(error: string) => void> = [];

  constructor(api: MiniNomadFullAPI, config?: Partial<StrokeSchedulerConfig>) {
    this.api = api;
    this.config = { ...DEFAULT_STROKE_SCHEDULER, ...config };
    this.state = {
      status: 'idle',
      totalPoints: 0,
      processedPoints: 0,
      currentFrame: 0,
      totalFrames: 0,
      queueLength: 0,
      lastError: null,
    };
  }

  scheduleStroke(
    points: Array<{ x: number; y: number; pressure: number }>,
    brushType?: BrushType,
    brushParams?: BrushParams,
    layerIndex?: number
  ): string {
    if (!points || points.length === 0) {
      this.state.lastError = 'No points provided';
      this.state.status = 'error';
      this.notifyError('No points provided');
      return '';
    }

    if (brushType) this.api.setBrushType(brushType);
    if (brushParams) this.api.setBrushParam(brushParams.size, brushParams.strength, brushParams.decay);

    const interpolated = this.interpolatePoints(points);
    const frames = this.splitIntoFrames(interpolated, brushType, brushParams, layerIndex ?? 0);

    this.queue.push(...frames);
    this.state.totalPoints += interpolated.length;
    this.state.totalFrames = this.queue.length;
    this.state.queueLength = this.queue.length;

    if (this.state.status !== 'running') {
      this.start();
    }

    return `stroke_${Date.now()}`;
  }

  scheduleStrokeFromPath(
    pathPoints: Array<{ x: number; y: number; z: number }>,
    brushType?: BrushType,
    brushParams?: BrushParams
  ): string {
    const screenPoints = pathPoints.map((p) => ({
      x: p.x,
      y: p.y,
      pressure: p.z > 0 ? p.z : 0.5,
    }));
    return this.scheduleStroke(screenPoints, brushType, brushParams);
  }

  scheduleCircularStroke(
    centerX: number,
    centerY: number,
    radius: number,
    segments: number,
    brushType?: BrushType,
    brushParams?: BrushParams
  ): string {
    const points: Array<{ x: number; y: number; pressure: number }> = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        pressure: 0.8,
      });
    }
    return this.scheduleStroke(points, brushType, brushParams);
  }

  scheduleLinearStroke(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    steps: number,
    brushType?: BrushType,
    brushParams?: BrushParams
  ): string {
    const points: Array<{ x: number; y: number; pressure: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: MathUtils.lerp(startX, endX, t),
        y: MathUtils.lerp(startY, endY, t),
        pressure: 1.0,
      });
    }
    return this.scheduleStroke(points, brushType, brushParams);
  }

  private interpolatePoints(
    points: Array<{ x: number; y: number; pressure: number }>
  ): StrokePoint[] {
    if (!this.config.interpolationEnabled || points.length < 2) {
      return points.map((p) => ({
        x: p.x,
        y: p.y,
        pressure: p.pressure,
        timestamp: Date.now(),
      }));
    }

    const result: StrokePoint[] = [];
    const steps = this.config.interpolationSteps;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : points[i + 1];

      result.push({
        x: p1.x,
        y: p1.y,
        pressure: p1.pressure,
        timestamp: Date.now() + i * 16,
      });

      const interpolated = MathUtils.interpolatePoints(
        { x: p1.x, y: p1.y, pressure: p1.pressure },
        { x: p2.x, y: p2.y, pressure: p2.pressure },
        steps
      );

      for (const pt of interpolated) {
        result.push({
          x: pt.x,
          y: pt.y,
          pressure: pt.pressure,
          timestamp: Date.now() + result.length * 16,
        });
      }
    }

    const last = points[points.length - 1];
    result.push({
      x: last.x,
      y: last.y,
      pressure: last.pressure,
      timestamp: Date.now() + result.length * 16,
    });

    return result;
  }

  private splitIntoFrames(
    points: StrokePoint[],
    brushType: BrushType | undefined,
    brushParams: BrushParams | undefined,
    layerIndex: number
  ): ScheduledStrokeFrame[] {
    const frames: ScheduledStrokeFrame[] = [];
    const maxPerFrame = this.config.maxPointsPerFrame;
    const totalFrames = Math.ceil(points.length / maxPerFrame);

    for (let i = 0; i < points.length; i += maxPerFrame) {
      const chunk = points.slice(i, i + maxPerFrame);
      frames.push({
        points: chunk,
        brushType: brushType || 'sculpt',
        brushParams: brushParams || { size: 0.5, strength: 0.5, decay: 0.3 },
        layerIndex,
        frameIndex: frames.length,
        totalFrames,
      });
    }

    return frames;
  }

  private start(): void {
    if (this.state.status === 'running') return;
    this.state.status = 'running';
    this.runFrame();
  }

  private runFrame = (): void => {
    if (this.queue.length === 0) {
      this.state.status = 'completed';
      this.notifyComplete();
      return;
    }

    const frame = this.queue.shift()!;
    this.state.currentFrame = frame.frameIndex;
    this.state.queueLength = this.queue.length;

    try {
      const batchPoints = frame.points.slice(0, this.config.batchSize);

      while (frame.points.length > 0) {
        const batch = frame.points.splice(0, this.config.batchSize);
        this.api.simulateStroke(batch);
        this.state.processedPoints += batch.length;
      }

      this.notifyProgress(this.state.processedPoints, this.state.totalPoints);

      const targetFrameTime = 1000 / this.config.targetFPS;
      this.rafId = requestAnimationFrame(() => {
        setTimeout(this.runFrame, 0);
      });

      if (targetFrameTime < 16) {
        Promise.resolve().then(() => this.runFrame());
      }
    } catch (e) {
      this.state.status = 'error';
      this.state.lastError = (e as Error).message;
      this.notifyError((e as Error).message);
    }
  };

  pause(): void {
    if (this.state.status === 'running') {
      this.state.status = 'paused';
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
    }
  }

  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'running';
      this.runFrame();
    }
  }

  cancel(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.queue = [];
    this.state.status = 'idle';
    this.state.processedPoints = 0;
    this.state.totalPoints = 0;
    this.state.currentFrame = 0;
    this.state.totalFrames = 0;
    this.state.queueLength = 0;
  }

  getState(): StrokeSchedulerState {
    return { ...this.state };
  }

  getConfig(): StrokeSchedulerConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<StrokeSchedulerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  onComplete(callback: (state: StrokeSchedulerState) => void): void {
    this.onCompleteCallbacks.push(callback);
  }

  onProgress(callback: (processed: number, total: number) => void): void {
    this.onProgressCallbacks.push(callback);
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallbacks.push(callback);
  }

  offComplete(callback: (state: StrokeSchedulerState) => void): void {
    this.onCompleteCallbacks = this.onCompleteCallbacks.filter((cb) => cb !== callback);
  }

  offProgress(callback: (processed: number, total: number) => void): void {
    this.onProgressCallbacks = this.onProgressCallbacks.filter((cb) => cb !== callback);
  }

  offError(callback: (error: string) => void): void {
    this.onErrorCallbacks = this.onErrorCallbacks.filter((cb) => cb !== callback);
  }

  private notifyComplete(): void {
    const state = { ...this.state };
    for (const cb of this.onCompleteCallbacks) {
      cb(state);
    }
  }

  private notifyProgress(processed: number, total: number): void {
    for (const cb of this.onProgressCallbacks) {
      cb(processed, total);
    }
  }

  private notifyError(error: string): void {
    for (const cb of this.onErrorCallbacks) {
      cb(error);
    }
  }

  getProgress(): number {
    if (this.state.totalPoints === 0) return 0;
    return this.state.processedPoints / this.state.totalPoints;
  }

  isRunning(): boolean {
    return this.state.status === 'running';
  }

  isIdle(): boolean {
    return this.state.status === 'idle';
  }

  dispose(): void {
    this.cancel();
    this.onCompleteCallbacks = [];
    this.onProgressCallbacks = [];
    this.onErrorCallbacks = [];
  }
}
