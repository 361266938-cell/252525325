// ============================================================================
// MeshExporter.ts — 网格导出: STL/OBJ序列化
// ============================================================================

import type { BufferGeometry } from 'three';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export class MeshExporter {
  exportSTLBinary(geometry: BufferGeometry): ArrayBuffer {
    const positions = geometry.attributes.position;
    const index = geometry.index;
    const triCount = index ? index.count / 3 : positions.count / 3;

    const bufferLength = 84 + triCount * 50;
    const buffer = new ArrayBuffer(bufferLength);
    const view = new DataView(buffer);

    view.setUint32(80, triCount, true);

    let offset = 84;
    const posArray = positions.array as Float32Array;

    for (let i = 0; i < triCount; i++) {
      let a: number, b: number, c: number;
      if (index) {
        a = index.getX(i * 3);
        b = index.getX(i * 3 + 1);
        c = index.getX(i * 3 + 2);
      } else {
        a = i * 3;
        b = i * 3 + 1;
        c = i * 3 + 2;
      }

      const ax = posArray[a * 3], ay = posArray[a * 3 + 1], az = posArray[a * 3 + 2];
      const bx = posArray[b * 3], by = posArray[b * 3 + 1], bz = posArray[b * 3 + 2];
      const cx = posArray[c * 3], cy = posArray[c * 3 + 1], cz = posArray[c * 3 + 2];

      const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
      const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      const nlen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

      view.setFloat32(offset, nx / nlen, true);
      view.setFloat32(offset + 4, ny / nlen, true);
      view.setFloat32(offset + 8, nz / nlen, true);
      offset += 12;

      view.setFloat32(offset, ax, true);
      view.setFloat32(offset + 4, ay, true);
      view.setFloat32(offset + 8, az, true);
      offset += 12;
      view.setFloat32(offset, bx, true);
      view.setFloat32(offset + 4, by, true);
      view.setFloat32(offset + 8, bz, true);
      offset += 12;
      view.setFloat32(offset, cx, true);
      view.setFloat32(offset + 4, cy, true);
      view.setFloat32(offset + 8, cz, true);
      offset += 12;

      view.setUint16(offset, 0, true);
      offset += 2;
    }

    return buffer;
  }

  exportSTLASCII(geometry: BufferGeometry): string {
    const positions = geometry.attributes.position;
    const index = geometry.index;
    const triCount = index ? index.count / 3 : positions.count / 3;
    const posArray = positions.array as Float32Array;

    let stl = 'solid MiniNomad\n';

    for (let i = 0; i < triCount; i++) {
      let a: number, b: number, c: number;
      if (index) {
        a = index.getX(i * 3);
        b = index.getX(i * 3 + 1);
        c = index.getX(i * 3 + 2);
      } else {
        a = i * 3;
        b = i * 3 + 1;
        c = i * 3 + 2;
      }

      const ax = posArray[a * 3], ay = posArray[a * 3 + 1], az = posArray[a * 3 + 2];
      const bx = posArray[b * 3], by = posArray[b * 3 + 1], bz = posArray[b * 3 + 2];
      const cx = posArray[c * 3], cy = posArray[c * 3 + 1], cz = posArray[c * 3 + 2];

      const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
      const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      const nlen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

      stl += `  facet normal ${nx / nlen} ${ny / nlen} ${nz / nlen}\n`;
      stl += `    outer loop\n`;
      stl += `      vertex ${ax} ${ay} ${az}\n`;
      stl += `      vertex ${bx} ${by} ${bz}\n`;
      stl += `      vertex ${cx} ${cy} ${cz}\n`;
      stl += `    endloop\n`;
      stl += `  endfacet\n`;
    }

    stl += 'endsolid MiniNomad\n';
    return stl;
  }

  exportOBJ(geometry: BufferGeometry): string {
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    const index = geometry.index;
    const posArray = positions.array as Float32Array;
    const normArray = normals ? (normals.array as Float32Array) : null;

    let obj = '# MiniNomad OBJ Export\n';
    obj += `# Vertices: ${positions.count}\n`;
    obj += `# Faces: ${index ? index.count / 3 : positions.count / 3}\n\n`;

    for (let i = 0; i < positions.count; i++) {
      obj += `v ${posArray[i * 3].toFixed(6)} ${posArray[i * 3 + 1].toFixed(6)} ${posArray[i * 3 + 2].toFixed(6)}\n`;
    }

    if (normArray) {
      for (let i = 0; i < positions.count; i++) {
        obj += `vn ${normArray[i * 3].toFixed(6)} ${normArray[i * 3 + 1].toFixed(6)} ${normArray[i * 3 + 2].toFixed(6)}\n`;
      }
    }

    obj += '\n';

    const triCount = index ? index.count / 3 : positions.count / 3;
    for (let i = 0; i < triCount; i++) {
      let a: number, b: number, c: number;
      if (index) {
        a = index.getX(i * 3) + 1;
        b = index.getX(i * 3 + 1) + 1;
        c = index.getX(i * 3 + 2) + 1;
      } else {
        a = i * 3 + 1;
        b = i * 3 + 2;
        c = i * 3 + 3;
      }

      if (normArray) {
        obj += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
      } else {
        obj += `f ${a} ${b} ${c}\n`;
      }
    }

    return obj;
  }

  async saveToAndroid(filename: string, data: string | ArrayBuffer, isBinary: boolean = false): Promise<string> {
    try {
      const dirResult = await Filesystem.mkdir({
        path: 'MiniNomad',
        directory: Directory.Documents,
        recursive: true,
      }).catch(() => null);

      const path = `MiniNomad/${filename}`;

      if (isBinary && data instanceof ArrayBuffer) {
        const uint8 = new Uint8Array(data);
        let binary = '';
        const chunkSize = 8192;
        for (let i =  0; i < uint8.length; i += chunkSize) {
          binary += String.fromCharCode(...uint8.subarray(i, Math.min(i + chunkSize, uint8.length)));
        }
        await Filesystem.writeFile({
          path,
          data: btoa(binary),
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
      } else {
        await Filesystem.writeFile({
          path,
          data: typeof data === 'string' ? data : '',
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
      }

      const uri = await Filesystem.getUri({ path, directory: Directory.Documents });
      return uri.uri;
    } catch (err) {
      console.error('[MeshExporter] Save error:', err);
      throw err;
    }
  }

  async downloadFile(filename: string, content: string, mimeType: string = 'text/plain'): Promise<string> {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return `Downloaded: ${filename}`;
  }

  async exportAndSaveSTL(
    geometry: BufferGeometry,
    filename: string,
    binary: boolean = true,
    useAndroid: boolean = false
  ): Promise<string> {
    if (binary) {
      const data = this.exportSTLBinary(geometry);
      if (useAndroid && typeof Filesystem !== 'undefined') {
        return this.saveToAndroid(filename, data, true);
      }
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return `Exported: ${filename}`;
    } else {
      const data = this.exportSTLASCII(geometry);
      if (useAndroid && typeof Filesystem !== 'undefined') {
        return this.saveToAndroid(filename, data, false);
      }
      return this.downloadFile(filename, data, 'application/sla');
    }
  }

  async exportAndSaveOBJ(
    geometry: BufferGeometry,
    filename: string,
    useAndroid: boolean = false
  ): Promise<string> {
    const data = this.exportOBJ(geometry);
    if (useAndroid && typeof Filesystem !== 'undefined') {
      return this.saveToAndroid(filename, data, false);
    }
    return this.downloadFile(filename, data, 'text/plain');
  }
}
