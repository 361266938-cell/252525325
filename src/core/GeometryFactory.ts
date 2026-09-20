// ============================================================================
// GeometryFactory.ts — 基础几何体: 球体/立方体/圆环 + 细分级别可调
// ============================================================================

import {
  SphereGeometry,
  BoxGeometry,
  TorusGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Uint32BufferAttribute,
  Vector3,
} from 'three';
import type { SphereParams, BoxParams, TorusParams, SubdivisionConfig } from '../types';
import { DEFAULT_SUBDIVISION } from '../types';
import { DynamicSubdivision } from './DynamicSubdivision';
import { MemoryGuard } from '../utils/memoryGuard';

export class GeometryFactory {
  private subdivision: DynamicSubdivision;
  private memoryGuard: MemoryGuard;

  constructor(memoryGuard: MemoryGuard, subdivisionConfig?: SubdivisionConfig) {
    this.memoryGuard = memoryGuard;
    this.subdivision = new DynamicSubdivision(subdivisionConfig || DEFAULT_SUBDIVISION);
  }

  createSphere(radius: number, subdiv: number): BufferGeometry {
    const safeRadius = Math.max(0.01, radius);
    const safeSubdiv = Math.max(1, Math.min(subdiv, 7));

    const widthSegments = Math.min(16 * safeSubdiv, 128);
    const heightSegments = Math.min(12 * safeSubdiv, 96);

    let geometry = new SphereGeometry(
      safeRadius,
      widthSegments,
      heightSegments
    );

    for (let i = 1; i < safeSubdiv; i++) {
      geometry = this.subdivision.subdivide(geometry, 1);
    }

    this.finalize(geometry);
    this.memoryGuard.checkVertexCount(geometry.attributes.position.count);
    return geometry;
  }

  createBox(size: number, subdiv: number): BufferGeometry {
    const safeSize = Math.max(0.01, size);
    const safeSubdiv = Math.max(1, Math.min(subdiv, 7));

    const segments = Math.min(4 * safeSubdiv, 64);
    let geometry = new BoxGeometry(
      safeSize,
      safeSize,
      safeSize,
      segments,
      segments,
      segments
    );

    for (let i = 1; i < safeSubdiv; i++) {
      geometry = this.subdivision.subdivide(geometry, 1);
    }

    this.finalize(geometry);
    this.memoryGuard.checkVertexCount(geometry.attributes.position.count);
    return geometry;
  }

  createTorus(mainR: number, tubeR: number): BufferGeometry {
    const safeMainR = Math.max(0.01, mainR);
    const safeTubeR = Math.max(0.005, tubeR);

    const radialSegments = Math.min(32, 128);
    const tubularSegments = Math.min(64, 256);

    const geometry = new TorusGeometry(
      safeMainR,
      safeTubeR,
      radialSegments,
      tubularSegments
    );

    this.finalize(geometry);
    this.memoryGuard.checkVertexCount(geometry.attributes.position.count);
    return geometry;
  }

  private finalize(geometry: BufferGeometry): void {
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    if (!geometry.attributes.uv) {
      const count = geometry.attributes.position.count;
      const uvs = new Float32Array(count * 2);
      geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    }

    if (!geometry.index) {
      const count = geometry.attributes.position.count;
      const indices: number[] = [];
      for (let i = 0; i < count; i += 3) {
        indices.push(i, i + 1, i + 2);
      }
      geometry.setIndex(new Uint32BufferAttribute(indices, 1));
    }
  }

  subdivideGeometry(geometry: BufferGeometry, levels: number): BufferGeometry {
    return this.subdivision.subdivide(geometry, levels);
  }

  getVertexCount(geometry: BufferGeometry): number {
    return geometry.attributes.position.count;
  }

  getSubdivisionConfig(): SubdivisionConfig {
    return this.subdivision.getConfig();
  }

  setSubdivisionConfig(config: Partial<SubdivisionConfig>): void {
    this.subdivision.setConfig(config);
  }

  createFromParams(type: 'sphere' | 'box' | 'torus', params: Record<string, number>): BufferGeometry {
    switch (type) {
      case 'sphere':
        return this.createSphere(params.radius || 1, params.subdiv || 3);
      case 'box':
        return this.createBox(params.size || 1, params.subdiv || 3);
      case 'torus':
        return this.createTorus(params.mainR || 0.8, params.tubeR || 0.25);
      default:
        return this.createSphere(1, 3);
    }
  }

  mergeGeometries(geometries: BufferGeometry[]): BufferGeometry {
    const merged = new BufferGeometry();
    let totalVertices = 0;
    let totalIndices = 0;
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (const geo of geometries) {
      const pos = geo.attributes.position;
      const nor = geo.attributes.normal;
      const col = geo.attributes.color;

      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        if (nor) {
          normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
        } else {
          normals.push(0, 1, 0);
        }
        if (col) {
          colors.push(col.getX(i), col.getY(i), col.getZ(i));
        }
      }

      if (geo.index) {
        const idx = geo.index;
        for (let i = 0; i < idx.count; i++) {
          indices.push(idx.getX(i) + totalVertices);
        }
      } else {
        for (let i = 0; i < pos.count; i++) {
          indices.push(i + totalVertices);
        }
      }

      totalVertices += pos.count;
      totalIndices += geo.index ? geo.index.count : pos.count;
    }

    merged.setAttribute('position', new Float32BufferAttribute(positions, 3));
    if (normals.length > 0) {
      merged.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    }
    if (colors.length > 0) {
      merged.setAttribute('color', new Float32BufferAttribute(colors, 3));
    }
    merged.setIndex(new Uint32BufferAttribute(indices, 1));
    merged.computeVertexNormals();
    merged.computeBoundingBox();
    merged.computeBoundingSphere();

    return merged;
  }

  centerGeometry(geometry: BufferGeometry): void {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const center = new Vector3();
    box.getCenter(center);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(i, positions.getX(i) - center.x, positions.getY(i) - center.y, positions.getZ(i) - center.z);
    }
    positions.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  scaleGeometry(geometry: BufferGeometry, scale: number): void {
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(i, positions.getX(i) * scale, positions.getY(i) * scale, positions.getZ(i) * scale);
    }
    positions.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
}
