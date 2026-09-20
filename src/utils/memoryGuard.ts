// ============================================================================
// memoryGuard.ts — 内存保护: 顶点硬上限50万 + WebGL上下文丢失检测
// ============================================================================

export class MemoryGuard {
  private vertexLimit: number = 500000;
  private warningThreshold: number = 0.8;
  private isWebGLContextLost: boolean = false;
  private onLimitReached: (() => void) | null = null;
  private onWarning: (() => void) | null = null;
  private onContextLost: (() => void) | null = null;
  private onContextRestored: (() => void) | null = null;

  constructor(vertexLimit: number = 500000) {
    this.vertexLimit = vertexLimit;
  }

  checkVertexCount(count: number): boolean {
    if (count > this.vertexLimit) {
      const msg = `[MemoryGuard] Vertex count ${count} exceeds limit ${this.vertexLimit}`;
      console.error(msg);
      if (this.onLimitReached) this.onLimitReached();
      throw new Error(msg);
    }

    const ratio = count / this.vertexLimit;
    if (ratio >= this.warningThreshold) {
      console.warn(`[MemoryGuard] Vertex count at ${(ratio * 100).toFixed(1)}% of limit`);
      if (this.onWarning) this.onWarning();
    }

    return true;
  }

  getVertexLimit(): number {
    return this.vertexLimit;
  }

  setVertexLimit(limit: number): void {
    this.vertexLimit = limit;
  }

  getMemoryUsage(currentVertices: number): {
    estimated: number;
    vertexLimit: number;
    ratio: number;
    warning: boolean;
  } {
    const bytesPerVertex = 32;
    const estimated = currentVertices * bytesPerVertex;
    const ratio = currentVertices / this.vertexLimit;
    return {
      estimated,
      vertexLimit: this.vertexLimit,
      ratio,
      warning: ratio >= this.warningThreshold,
    };
  }

  isContextLost(): boolean {
    return this.isWebGLContextLost;
  }

  setContextLost(): void {
    this.isWebGLContextLost = true;
    console.error('[MemoryGuard] WebGL context lost');
    if (this.onContextLost) this.onContextLost();
  }

  setContextRestored(): void {
    this.isWebGLContextLost = false;
    console.log('[MemoryGuard] WebGL context restored');
    if (this.onContextRestored) this.onContextRestored();
  }

  setOnLimitReached(cb: () => void): void {
    this.onLimitReached = cb;
  }

  setOnWarning(cb: () => void): void {
    this.onWarning = cb;
  }

  setOnContextLost(cb: () => void): void {
    this.onContextLost = cb;
  }

  setOnContextRestored(cb: () => void): void {
    this.onContextRestored = cb;
  }

  estimateGeometryMemory(vertexCount: number, hasNormals: boolean, hasColors: boolean, hasUVs: boolean): number {
    let bytes = 0;
    bytes += vertexCount * 3 * 4;
    if (hasNormals) bytes += vertexCount * 3 * 4;
    if (hasColors) bytes += vertexCount * 3 * 4;
    if (hasUVs) bytes += vertexCount * 2 * 4;
    bytes += vertexCount * 4;
    return bytes;
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  checkParameterBounds(
    params: Record<string, number>,
    bounds: Record<string, { min: number; max: number }>
  ): void {
    for (const [key, value] of Object.entries(params)) {
      const bound = bounds[key];
      if (bound) {
        if (value < bound.min || value > bound.max) {
          throw new Error(
            `[MemoryGuard] Parameter "${key}" value ${value} out of bounds [${bound.min}, ${bound.max}]`
          );
        }
      }
    }
  }
}
