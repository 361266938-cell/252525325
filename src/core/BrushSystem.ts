// ============================================================================
// BrushSystem.ts — 六种笔刷: sculpt/smooth/inflate/pinch/drag/scrape
// ============================================================================

import {
  Vector3,
  Mesh,
  Raycaster,
  type BufferGeometry,
  type Float32BufferAttribute,
} from 'three';
import type {
  BrushType,
  BrushConfig,
  BrushParams,
  StrokePoint,
} from '../types';
import { DEFAULT_BRUSH_CONFIG } from '../types';

interface BrushDeformResult {
  vertexIndex: number;
  displacement: Vector3;
}

export class BrushSystem {
  private config: BrushConfig = { ...DEFAULT_BRUSH_CONFIG };
  private raycaster: Raycaster = new Raycaster();

  setBrushType(type: BrushType): void {
    this.config.type = type;
  }

  setBrushParams(params: Partial<BrushParams>): void {
    if (params.size !== undefined) this.config.size = params.size;
    if (params.strength !== undefined) this.config.strength = params.strength;
    if (params.decay !== undefined) this.config.decay = params.decay;
  }

  setBrushConfig(config: Partial<BrushConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getBrushConfig(): BrushConfig {
    return { ...this.config };
  }

  getBrushType(): BrushType {
    return this.config.type;
  }

  getBrushParams(): BrushParams {
    return {
      size: this.config.size,
      strength: this.config.strength,
      decay: this.config.decay,
    };
  }

  pickVertex(
    mesh: Mesh,
    point: { x: number; y: number },
    camera: { position: Vector3; quaternion: unknown; isPerspectiveCamera: boolean; fov: number; aspect: number },
    canvasWidth: number,
    canvasHeight: number
  ): Vector3 | null {
    const ndcX = (point.x / canvasWidth) * 2 - 1;
    const ndcY = -(point.y / canvasHeight) * 2 + 1;

    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera as unknown as never);
    const intersects = this.raycaster.intersectObject(mesh, false);
    if (intersects.length > 0) {
      return intersects[0].point.clone();
    }
    return null;
  }

  getAffectedVertices(
    geometry: BufferGeometry,
    center: Vector3,
    radius: number
  ): number[] {
    const positions = geometry.attributes.position as Float32BufferAttribute;
    const rSq = radius * radius;
    const indices: number[] = [];

    for (let i = 0; i < positions.count; i++) {
      const dx = positions.getX(i) - center.x;
      const dy = positions.getY(i) - center.y;
      const dz = positions.getZ(i) - center.z;
      if (dx * dx + dy * dy + dz * dz < rSq) {
        indices.push(i);
      }
    }

    return indices;
  }

  applyFalloff(distance: number, radius: number): number {
    const t = distance / radius;
    if (t >= 1) return 0;

    switch (this.config.falloffCurve) {
      case 'constant':
        return 1;
      case 'linear':
        return 1 - t;
      case 'smooth':
      default:
        return Math.cos((t * Math.PI) / 2);
    }
  }

  applyPressure(pressure: number): number {
    if (!this.config.pressureEnabled) return 1;

    switch (this.config.pressureCurve) {
      case 'linear':
        return pressure;
      case 'cubic':
        return pressure * pressure * pressure;
      case 'quadratic':
      default:
        return pressure * pressure;
    }
  }

  deformVertices(
    geometry: BufferGeometry,
    center: Vector3,
    normals: Float32Array,
    mask: Float32Array | null,
    previousCenter: Vector3 | null
  ): void {
    const radius = this.config.size;
    const strength = this.config.strength;
    const decay = this.config.decay;
    const positions = geometry.attributes.position as Float32BufferAttribute;
    const affected = this.getAffectedVertices(geometry, center, radius);

    for (const vIdx of affected) {
      if (mask && mask[vIdx] > 0) continue;

      const px = positions.getX(vIdx);
      const py = positions.getY(vIdx);
      const pz = positions.getZ(vIdx);

      const dx = px - center.x;
      const dy = py - center.y;
      const dz = pz - center.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 0.0001) continue;

      const falloff = this.applyFalloff(dist, radius) * Math.pow(1 - dist / radius, decay);
      if (falloff <= 0) continue;

      const nx = normals[vIdx * 3];
      const ny = normals[vIdx * 3 + 1];
      const nz = normals[vIdx * 3 + 2];

      switch (this.config.type) {
        case 'sculpt': {
          const disp = strength * falloff * 0.05;
          positions.setXYZ(
            vIdx,
            px + nx * disp,
            py + ny * disp,
            pz + nz * disp
          );
          break;
        }
        case 'smooth': {
          const factor = strength * falloff * 0.3;
          const factorClamped = MathUtils.clamp01(factor);
          positions.setXYZ(
            vIdx,
            px * (1 - factorClamped) + center.x * factorClamped,
            py * (1 - factorClamped) + center.y * factorClamped,
            pz * (1 - factorClamped) + center.z * factorClamped
          );
          break;
        }
        case 'inflate': {
          const disp = strength * falloff * 0.05;
          positions.setXYZ(
            vIdx,
            px + nx * disp,
            py + ny * disp,
            pz + nz * disp
          );
          break;
        }
        case 'pinch': {
          const factor = strength * falloff * 0.1;
          positions.setXYZ(
            vIdx,
            px * (1 - factor) + center.x * factor,
            py * (1 - factor) + center.y * factor,
            pz * (1 - factor) + center.z * factor
          );
          break;
        }
        case 'drag': {
          if (previousCenter) {
            const dragX = (center.x - previousCenter.x) * strength * falloff * 0.5;
            const dragY = (center.y - previousCenter.y) * strength * falloff * 0.5;
            const dragZ = (center.z - previousCenter.z) * strength * falloff * 0.5;
            positions.setXYZ(
              vIdx,
              px + dragX,
              py + dragY,
              pz + dragZ
            );
          }
          break;
        }
        case 'scrape': {
          const factor = strength * falloff * 0.02;
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          const factorSigned = factor * Math.sign(ny);
          positions.setXYZ(
            vIdx,
            px - (nx / len) * factorSigned,
            py - (ny / len) * factorSigned,
            pz - (nz / len) * factorSigned
          );
          break;
        }
      }
    }

    positions.needsUpdate = true;
    const geom = geometry as BufferGeometry & { computeVertexNormals: () => void };
    geom.computeVertexNormals();
  }

  applySymmetry(
    geometry: BufferGeometry,
    deformations: BrushDeformResult[]
  ): BrushDeformResult[] {
    if (!this.config.symmetryX && !this.config.symmetryY && !this.config.symmetryZ) {
      return deformations;
    }

    const mirrored: BrushDeformResult[] = [];
    const positions = geometry.attributes.position as Float32BufferAttribute;

    for (const def of deformations) {
      const px = positions.getX(def.vertexIndex);
      const py = positions.getY(def.vertexIndex);
      const pz = positions.getZ(def.vertexIndex);

      if (this.config.symmetryX) {
        const mirrorIdx = this.findClosestVertex(geometry, -px, py, pz);
        if (mirrorIdx >= 0) {
          mirrored.push({
            vertexIndex: mirrorIdx,
            displacement: new Vector3(-def.displacement.x, def.displacement.y, def.displacement.z),
          });
        }
      }
      if (this.config.symmetryY) {
        const mirrorIdx = this.findClosestVertex(geometry, px, -py, pz);
        if (mirrorIdx >= 0) {
          mirrored.push({
            vertexIndex: mirrorIdx,
            displacement: new Vector3(def.displacement.x, -def.displacement.y, def.displacement.z),
          });
        }
      }
      if (this.config.symmetryZ) {
        const mirrorIdx = this.findClosestVertex(geometry, px, py, -pz);
        if (mirrorIdx >= 0) {
          mirrored.push({
            vertexIndex: mirrorIdx,
            displacement: new Vector3(def.displacement.x, def.displacement.y, -def.displacement.z),
          });
        }
      }
    }

    return [...deformations, ...mirrored];
  }

  private findClosestVertex(geometry: BufferGeometry, x: number, y: number, z: number): number {
    const positions = geometry.attributes.position as Float32BufferAttribute;
    let closestIdx = -1;
    let closestDist = Infinity;

    for (let i = 0; i < positions.count; i++) {
      const dx = positions.getX(i) - x;
      const dy = positions.getY(i) - y;
      const dz = positions.getZ(i) - z;
      const dist = dx * dx + dy * dy + dz * dz;
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    return closestIdx;
  }

  dispose(): void {
    this.raycaster = new Raycaster();
  }
}

// ── Math 工具 ───────────────────────────────────────────────────────────────
const MathUtils = {
  clamp01(v: number): number {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  },
};
