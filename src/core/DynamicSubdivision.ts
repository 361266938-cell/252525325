// ============================================================================
// DynamicSubdivision.ts — 动态细分: 预生成高密度网格 + 局部顶点位移
// ============================================================================

import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';
import type { SubdivisionConfig } from '../types';

interface EdgeMapEntry {
  newVertexIndex: number;
  midpoint: Vector3;
}

export class DynamicSubdivision {
  private config: SubdivisionConfig;

  constructor(config: SubdivisionConfig) {
    this.config = { ...config };
  }

  getConfig(): SubdivisionConfig {
    return { ...this.config };
  }

  setConfig(partial: Partial<SubdivisionConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  subdivide(geometry: BufferGeometry, levels: number): BufferGeometry {
    let current = geometry;
    const actualLevels = Math.max(0, Math.min(levels, 5));

    for (let l = 0; l < actualLevels; l++) {
      current = this.subdivideOnce(current);
      if (current.attributes.position.count > this.config.maxVertices) {
        console.warn(`[DynamicSubdivision] Vertex limit reached at ${current.attributes.position.count}, stopping`);
        break;
      }
    }
    return current;
  }

  private subdivideOnce(geometry: BufferGeometry): BufferGeometry {
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    const colors = geometry.attributes.color;
    const uvs = geometry.attributes.uv;

    const hasIndex = geometry.index !== null;
    const oldIndex = hasIndex ? geometry.index!.array : this.generateDefaultIndex(positions.count);

    const oldVertexCount = positions.count;
    const oldPositions = positions.array as Float32Array;
    const oldNormals = normals ? (normals.array as Float32Array) : null;
    const oldColors = colors ? (colors.array as Float32Array) : null;
    const oldUVs = uvs ? (uvs.array as Float32Array) : null;

    const newPositions: number[] = [];
    const newNormals: number[] = [];
    const newColors: number[] = [];
    const newUVs: number[] = [];
    const newIndices: number[] = [];

    for (let i = 0; i < oldVertexCount; i++) {
      newPositions.push(oldPositions[i * 3], oldPositions[i * 3 + 1], oldPositions[i * 3 + 2]);
      if (oldNormals) newNormals.push(oldNormals[i * 3], oldNormals[i * 3 + 1], oldNormals[i * 3 + 2]);
      if (oldColors) newColors.push(oldColors[i * 3], oldColors[i * 3 + 1], oldColors[i * 3 + 2]);
      if (oldUVs) newUVs.push(oldUVs[i * 2], oldUVs[i * 2 + 1]);
    }

    const edgeMap = new Map<string, number>();
    const triangleCount = oldIndex.length / 3;

    for (let t = 0; t < triangleCount; t++) {
      const a = oldIndex[t * 3];
      const b = oldIndex[t * 3 + 1];
      const c = oldIndex[t * 3 + 2];

      const ab = this.getOrCreateEdgeVertex(a, b, oldPositions, oldNormals, oldColors, oldUVs, edgeMap, newPositions, newNormals, newColors, newUVs);
      const bc = this.getOrCreateEdgeVertex(b, c, oldPositions, oldNormals, oldColors, oldUVs, edgeMap, newPositions, newNormals, newColors, newUVs);
      const ca = this.getOrCreateEdgeVertex(c, a, oldPositions, oldNormals, oldColors, oldUVs, edgeMap, newPositions, newNormals, newColors, newUVs);

      newIndices.push(a, ab, ca);
      newIndices.push(b, bc, ab);
      newIndices.push(c, ca, bc);
      newIndices.push(ab, bc, ca);
    }

    const result = new BufferGeometry();
    result.setAttribute('position', new Float32BufferAttribute(newPositions, 3));
    if (newNormals.length > 0) {
      result.setAttribute('normal', new Float32BufferAttribute(newNormals, 3));
    }
    if (newColors.length > 0) {
      result.setAttribute('color', new Float32BufferAttribute(newColors, 3));
    }
    if (newUVs.length > 0) {
      result.setAttribute('uv', new Float32BufferAttribute(newUVs, 2));
    }
    result.setIndex(new Uint32BufferAttribute(newIndices, 1));
    result.computeVertexNormals();
    result.computeBoundingBox();
    result.computeBoundingSphere();

    return result;
  }

  private generateDefaultIndex(vertexCount: number): Uint32Array {
    const indices = new Uint32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      indices[i] = i;
    }
    return indices;
  }

  private getOrCreateEdgeVertex(
    a: number,
    b: number,
    positions: Float32Array,
    normals: Float32Array | null,
    colors: Float32Array | null,
    uvs: Float32Array | null,
    edgeMap: Map<string, number>,
    newPositions: number[],
    newNormals: number[],
    newColors: number[],
    newUVs: number[]
  ): number {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;

    const existing = edgeMap.get(key);
    if (existing !== undefined) return existing;

    const newIndex = newPositions.length / 3;
    const mx = (positions[a * 3] + positions[b * 3]) / 2;
    const my = (positions[a * 3 + 1] + positions[b * 3 + 1]) / 2;
    const mz = (positions[a * 3 + 2] + positions[b * 3 + 2]) / 2;
    newPositions.push(mx, my, mz);

    if (normals) {
      const nx = (normals[a * 3] + normals[b * 3]) / 2;
      const ny = (normals[a * 3 + 1] + normals[b * 3 + 1]) / 2;
      const nz = (normals[a * 3 + 2] + normals[b * 3 + 2]) / 2;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      newNormals.push(nx / len, ny / len, nz / len);
    }

    if (colors) {
      const cr = (colors[a * 3] + colors[b * 3]) / 2;
      const cg = (colors[a * 3 + 1] + colors[b * 3 + 1]) / 2;
      const cb = (colors[a * 3 + 2] + colors[b * 3 + 2]) / 2;
      newColors.push(cr, cg, cb);
    }

    if (uvs) {
      const u = (uvs[a * 2] + uvs[b * 2]) / 2;
      const v = (uvs[a * 2 + 1] + uvs[b * 2 + 1]) / 2;
      newUVs.push(u, v);
    }

    edgeMap.set(key, newIndex);
    return newIndex;
  }

  displaceVertices(
    geometry: BufferGeometry,
    mask: Float32Array | null,
    displacementFn: (vertexIndex: number, position: Vector3, normal: Vector3) => Vector3
  ): void {
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;

    for (let i = 0; i < positions.count; i++) {
      if (mask && mask[i] > 0) continue;

      const pos = new Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      const nor = normals
        ? new Vector3(normals.getX(i), normals.getY(i), normals.getZ(i))
        : new Vector3(0, 1, 0);

      const displaced = displacementFn(i, pos, nor);
      positions.setXYZ(i, displaced.x, displaced.y, displaced.z);
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  getVertexDensityAt(geometry: BufferGeometry, center: Vector3, radius: number): number {
    const positions = geometry.attributes.position;
    let count = 0;
    const rSq = radius * radius;

    for (let i = 0; i < positions.count; i++) {
      const dx = positions.getX(i) - center.x;
      const dy = positions.getY(i) - center.y;
      const dz = positions.getZ(i) - center.z;
      if (dx * dx + dy * dy + dz * dz < rSq) {
        count++;
      }
    }

    return count;
  }

  applyLocalSubdivision(
    geometry: BufferGeometry,
    center: Vector3,
    radius: number,
    levels: number = 1
  ): BufferGeometry {
    if (levels <= 0) return geometry;

    const density = this.getVertexDensityAt(geometry, center, radius);
    if (density < 8) return geometry;

    return this.subdivide(geometry, levels);
  }
}
