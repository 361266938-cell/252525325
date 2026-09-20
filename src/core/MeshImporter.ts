// ============================================================================
// MeshImporter.ts — 网格导入: STL/OBJ解析
// ============================================================================

import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint32BufferAttribute,
  Vector3,
  BufferAttribute,
} from 'three';
import type { ImportOptions } from '../types';
import { MemoryGuard } from '../utils/memoryGuard';

export class MeshImporter {
  private memoryGuard: MemoryGuard;

  constructor(memoryGuard: MemoryGuard) {
    this.memoryGuard = memoryGuard;
  }

  importSTL(data: ArrayBuffer | string, options?: Partial<ImportOptions>): BufferGeometry {
    const opts: ImportOptions = {
      format: 'stl',
      scale: 1,
      center: true,
      recomputeNormals: true,
      mergeVertices: false,
      maxVertices: 500000,
      ...options,
    };

    const buffer = typeof data === 'string' ? this.stringToArrayBuffer(data) : data;
    const isBinary = this.isBinarySTL(buffer);
    let geometry: BufferGeometry;

    if (isBinary) {
      geometry = this.parseBinarySTL(buffer);
    } else {
      geometry = this.parseASCIISTL(typeof data === 'string' ? data : this.arrayBufferToString(buffer));
    }

    if (opts.scale !== 1) this.scaleGeometry(geometry, opts.scale);
    if (opts.center) this.centerGeometry(geometry);
    if (opts.recomputeNormals) geometry.computeVertexNormals();
    if (opts.mergeVertices) geometry = this.mergeVertices(geometry);

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    this.memoryGuard.checkVertexCount(geometry.attributes.position.count);

    return geometry;
  }

  importOBJ(data: string, options?: Partial<ImportOptions>): BufferGeometry {
    const opts: ImportOptions = {
      format: 'obj',
      scale: 1,
      center: true,
      recomputeNormals: true,
      mergeVertices: false,
      maxVertices: 500000,
      ...options,
    };

    let geometry = this.parseOBJ(data);

    if (opts.scale !== 1) this.scaleGeometry(geometry, opts.scale);
    if (opts.center) this.centerGeometry(geometry);
    if (opts.recomputeNormals) geometry.computeVertexNormals();
    if (opts.mergeVertices) geometry = this.mergeVertices(geometry);

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    this.memoryGuard.checkVertexCount(geometry.attributes.position.count);

    return geometry;
  }

  importFromText(text: string, format: 'stl' | 'obj', options?: Partial<ImportOptions>): BufferGeometry {
    if (format === 'stl') {
      return this.importSTL(text, options);
    }
    return this.importOBJ(text, options);
  }

  private isBinarySTL(buffer: ArrayBuffer): boolean {
    const reader = new DataView(buffer);
    const numTriangles = reader.getUint32(80, true);
    const expectedSize = 84 + numTriangles * 50;
    if (buffer.byteLength === expectedSize) return true;

    if (buffer.byteLength < 84) return false;

    const header = new Uint8Array(buffer, 0, 6);
    const isSolid = header[0] === 0x73 && header[1] === 0x6f && header[2] === 0x6c &&
                    header[3] === 0x69 && header[4] === 0x64 && header[5] === 0x20;
    return !isSolid;
  }

  private parseBinarySTL(buffer: ArrayBuffer): BufferGeometry {
    const reader = new DataView(buffer);
    const numTriangles = reader.getUint32(80, true);

    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    let offset = 84;

    for (let i = 0; i < numTriangles; i++) {
      const nx = reader.getFloat32(offset, true);
      const ny = reader.getFloat32(offset + 4, true);
      const nz = reader.getFloat32(offset + 8, true);
      offset += 12;

      for (let j = 0; j < 3; j++) {
        const x = reader.getFloat32(offset, true);
        const y = reader.getFloat32(offset + 4, true);
        const z = reader.getFloat32(offset + 8, true);
        offset += 12;

        positions.push(x, y, z);
        normals.push(nx, ny, nz);
      }

      offset += 2;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setIndex(new Uint32BufferAttribute(indices.length > 0 ? indices : this.generateSequentialIndex(positions.length / 3), 1));

    return geometry;
  }

  private parseASCIISTL(text: string): BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const lines = text.split('\n');
    let currentNormal: [number, number, number] = [0, 1, 0];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lower = line.toLowerCase();

      if (lower.startsWith('facet normal')) {
        const parts = lower.split(/\s+/);
        currentNormal = [
          parseFloat(parts[2]),
          parseFloat(parts[3]),
          parseFloat(parts[4]),
        ];
      } else if (lower.startsWith('vertex')) {
        const parts = line.split(/\s+/);
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        positions.push(x, y, z);
        normals.push(...currentNormal);
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));

    return geometry;
  }

  private parseOBJ(text: string): BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const tempVertices: number[] = [];
    const tempNormals: number[] = [];

    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      const parts = trimmed.split(/\s+/);
      if (parts[0] === 'v') {
        tempVertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      } else if (parts[0] === 'vn') {
        tempNormals.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      } else if (parts[0] === 'f') {
        for (let i = 1; i <= 3 && i < parts.length; i++) {
          const indices2 = parts[i].split('/');
          const vIdx = parseInt(indices2[0]) - 1;
          if (vIdx >= 0) {
            positions.push(tempVertices[vIdx * 3], tempVertices[vIdx * 3 + 1], tempVertices[vIdx * 3 + 2]);
            if (indices2.length >= 3 && indices2[2]) {
              const nIdx = parseInt(indices2[2]) - 1;
              if (nIdx >= 0 && tempNormals.length > nIdx * 3 + 2) {
                normals.push(tempNormals[nIdx * 3], tempNormals[nIdx * 3 + 1], tempNormals[nIdx * 3 + 2]);
              }
            }
          }
        }

        if (parts.length > 4) {
          const idx1 = positions.length / 3 - 3;
          const idx2 = positions.length / 3 - 2;
          const idx3 = positions.length / 3 - 1;
          indices.push(idx1, idx2, idx3);

          if (parts.length >= 5) {
            const i2 = parts[4].split('/')[0];
            const vIdx = parseInt(i2) - 1;
            if (vIdx >= 0) {
              positions.push(tempVertices[vIdx * 3], tempVertices[vIdx * 3 + 1], tempVertices[vIdx * 3 + 2]);
            }
            const idx4 = positions.length / 3 - 1;
            indices.push(idx1, idx3, idx4);
          }
        } else {
          const idx1 = positions.length / 3 - 3;
          const idx2 = positions.length / 3 - 2;
          const idx3 = positions.length / 3 - 1;
          indices.push(idx1, idx2, idx3);
        }
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    if (normals.length > 0) {
      geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    }
    geometry.setIndex(new Uint32BufferAttribute(indices, 1));

    return geometry;
  }

  private mergeVertices(geometry: BufferGeometry): BufferGeometry {
    const positions = geometry.attributes.position.array as Float32Array;
    const indices = geometry.index ? geometry.index.array : null;

    const tolerance = 1e-4;
    const vertexMap = new Map<string, number>();
    const newPositions: number[] = [];
    const newIndices: number[] = [];

    const getOrCreateVertex = (x: number, y: number, z: number): number => {
      const key = `${Math.round(x / tolerance)},${Math.round(y / tolerance)},${Math.round(z / tolerance)}`;
      const existing = vertexMap.get(key);
      if (existing !== undefined) return existing;
      const idx = newPositions.length / 3;
      newPositions.push(x, y, z);
      vertexMap.set(key, idx);
      return idx;
    };

    if (indices) {
      for (let i = 0; i < indices.length; i++) {
        const oldIdx = indices[i];
        const x = positions[oldIdx * 3];
        const y = positions[oldIdx * 3 + 1];
        const z = positions[oldIdx * 3 + 2];
        newIndices.push(getOrCreateVertex(x, y, z));
      }
    } else {
      for (let i = 0; i < positions.length; i += 3) {
        newIndices.push(getOrCreateVertex(positions[i], positions[i + 1], positions[i + 2]));
      }
    }

    const result = new BufferGeometry();
    result.setAttribute('position', new Float32BufferAttribute(newPositions, 3));
    result.setIndex(new Uint32BufferAttribute(newIndices, 1));
    return result;
  }

  private generateSequentialIndex(count: number): Uint32Array {
    const arr = new Uint32Array(count);
    for (let i = 0; i < count; i++) arr[i] = i;
    return arr;
  }

  private scaleGeometry(geometry: BufferGeometry, scale: number): void {
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(i, positions.getX(i) * scale, positions.getY(i) * scale, positions.getZ(i) * scale);
    }
    positions.needsUpdate = true;
  }

  private centerGeometry(geometry: BufferGeometry): void {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const center = new Vector3();
    box.getCenter(center);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(i, positions.getX(i) - center.x, positions.getY(i) - center.y, positions.getZ(i) - center.z);
    }
    positions.needsUpdate = true;
  }

  private stringToArrayBuffer(str: string): ArrayBuffer {
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
  }

  private arrayBufferToString(buffer: ArrayBuffer): string {
    const decoder = new TextDecoder();
    return decoder.decode(buffer);
  }
}
