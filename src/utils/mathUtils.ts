// ============================================================================
// mathUtils.ts — 数学工具: 向量/矩阵运算辅助函数
// ============================================================================

import { Vector3, Matrix4, Quaternion, Euler } from 'three';

export const MathUtils = {
  clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  },

  clamp01(value: number): number {
    return value < 0 ? 0 : value > 1 ? 1 : value;
  },

  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  },

  inverseLerp(a: number, b: number, value: number): number {
    if (a === b) return 0;
    return MathUtils.clamp01((value - a) / (b - a));
  },

  smoothstep(edge0: number, edge1: number, x: number): number {
    const t = MathUtils.inverseLerp(edge0, edge1, x);
    return t * t * (3 - 2 * t);
  },

  smootherstep(edge0: number, edge1: number, x: number): number {
    const t = MathUtils.inverseLerp(edge0, edge1, x);
    return t * t * t * (t * (t * 6 - 15) + 10);
  },

  degToRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  },

  radToDeg(radians: number): number {
    return radians * (180 / Math.PI);
  },

  lerpVec3(a: Vector3, b: Vector3, t: number): Vector3 {
    return new Vector3(
      MathUtils.lerp(a.x, b.x, t),
      MathUtils.lerp(a.y, b.y, t),
      MathUtils.lerp(a.z, b.z, t)
    );
  },

  slerpVec3(a: Vector3, b: Vector3, t: number): Vector3 {
    const dot = MathUtils.clamp(a.dot(b) / (a.length() * b.length()), -1, 1);
    const theta = Math.acos(dot) * t;
    const relative = b.clone().sub(a.clone().multiplyScalar(dot)).normalize();
    return a.clone().multiplyScalar(Math.cos(theta)).add(relative.multiplyScalar(Math.sin(theta)));
  },

  catmullRom(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number): Vector3 {
    const t2 = t * t;
    const t3 = t2 * t;
    return new Vector3(
      0.5 * ((2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      0.5 * ((2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      0.5 * ((2 * p1.z) +
        (-p0.z + p2.z) * t +
        (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
        (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
    );
  },

  sampleGaussianFalloff(distance: number, radius: number, sigma: number = 0.5): number {
    if (distance >= radius) return 0;
    const t = distance / radius;
    const x = t / sigma;
    return Math.exp(-(x * x) / 2);
  },

  computeFaceNormal(v0: Vector3, v1: Vector3, v2: Vector3): Vector3 {
    const e1 = new Vector3().subVectors(v1, v0);
    const e2 = new Vector3().subVectors(v2, v0);
    return new Vector3().crossVectors(e1, e2).normalize();
  },

  pointToLineDistance(point: Vector3, lineStart: Vector3, lineEnd: Vector3): number {
    const line = new Vector3().subVectors(lineEnd, lineStart);
    const lineLength = line.length();
    if (lineLength === 0) return point.distanceTo(lineStart);
    const t = MathUtils.clamp01(point.clone().sub(lineStart).dot(line) / (lineLength * lineLength));
    const projection = lineStart.clone().add(line.multiplyScalar(t));
    return point.distanceTo(projection);
  },

  worldToLocal(point: Vector3, matrix: Matrix4): Vector3 {
    return point.clone().applyMatrix4(matrix.clone().invert());
  },

  localToWorld(point: Vector3, matrix: Matrix4): Vector3 {
    return point.clone().applyMatrix4(matrix);
  },

  quaternionFromEuler(rx: number, ry: number, rz: number): Quaternion {
    return new Quaternion().setFromEuler(new Euler(rx, ry, rz));
  },

  interpolatePoints(
    p0: { x: number; y: number; pressure: number },
    p1: { x: number; y: number; pressure: number },
    steps: number
  ): Array<{ x: number; y: number; pressure: number }> {
    const result: Array<{ x: number; y: number; pressure: number }> = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1);
      result.push({
        x: MathUtils.lerp(p0.x, p1.x, t),
        y: MathUtils.lerp(p0.y, p1.y, t),
        pressure: MathUtils.lerp(p0.pressure, p1.pressure, t),
      });
    }
    return result;
  },
};
