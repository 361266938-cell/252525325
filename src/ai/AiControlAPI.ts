// ============================================================================
// AiControlAPI.ts — AI控制API: 标准接口 + 上帝模式 + window.MiniNomadAPI挂载
// ============================================================================

import { Vector3, Color, BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import type {
  MiniNomadAPI,
  MiniNomadGodAPI,
  MiniNomadFullAPI,
  BrushType,
  BrushConfig,
  BrushParams,
  SceneState,
  SerializedCameraState,
  SerializedMaterialConfig,
  DiagnosticsInfo,
  AppEvent,
  SculptLayer,
  ViewportConfig,
  ProjectMetadata,
  MemoryUsage,
} from '../types';
import type { SceneManager } from '../core/SceneManager';
import type { CameraController } from '../core/CameraController';
import type { SculptEngine } from '../core/SculptEngine';
import type { BrushSystem } from '../core/BrushSystem';
import type { MaskSystem } from '../core/MaskSystem';
import type { LayerSystem } from '../core/LayerSystem';
import type { MaterialSystem } from '../core/MaterialSystem';
import type { GeometryFactory } from '../core/GeometryFactory';
import type { VertexColorSystem } from '../core/VertexColorSystem';
import type { UndoRedoSystem } from '../core/UndoRedoSystem';
import type { MeshExporter } from '../core/MeshExporter';
import type { MeshImporter } from '../core/MeshImporter';
import type { MemoryGuard } from '../utils/memoryGuard';

interface EventListenerEntry {
  event: AppEvent;
  callback: (data: unknown) => void;
}

export class AiControlAPI implements MiniNomadFullAPI {
  private sm: SceneManager;
  private cameraController: CameraController;
  private sculptEngine: SculptEngine;
  private brush: BrushSystem;
  private mask: MaskSystem;
  private layers: LayerSystem;
  private material: MaterialSystem;
  private geometryFactory: GeometryFactory;
  private vertexColor: VertexColorSystem;
  private undoRedo: UndoRedoSystem;
  private exporter: MeshExporter;
  private importer: MeshImporter;
  private memoryGuard: MemoryGuard;

  private eventListeners: EventListenerEntry[] = [];
  private errors: Array<{ code: string; message: string; timestamp: number }> = [];
  private strokeCount: number = 0;
  private appVersion: string = '1.0.0';

  constructor(deps: {
    sm: SceneManager;
    cameraController: CameraController;
    sculptEngine: SculptEngine;
    brush: BrushSystem;
    mask: MaskSystem;
    layers: LayerSystem;
    material: MaterialSystem;
    geometryFactory: GeometryFactory;
    vertexColor: VertexColorSystem;
    undoRedo: UndoRedoSystem;
    exporter: MeshExporter;
    importer: MeshImporter;
    memoryGuard: MemoryGuard;
  }) {
    this.sm = deps.sm;
    this.cameraController = deps.cameraController;
    this.sculptEngine = deps.sculptEngine;
    this.brush = deps.brush;
    this.mask = deps.mask;
    this.layers = deps.layers;
    this.material = deps.material;
    this.geometryFactory = deps.geometryFactory;
    this.vertexColor = deps.vertexColor;
    this.undoRedo = deps.undoRedo;
    this.exporter = deps.exporter;
    this.importer = deps.importer;
    this.memoryGuard = deps.memoryGuard;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 标准接口 — MiniNomadAPI
  // ══════════════════════════════════════════════════════════════════════

  createSphere(radius: number, subdiv: number): void {
    try {
      this.memoryGuard.checkParameterBounds(
        { radius, subdiv },
        { radius: { min: 0.01, max: 100 }, subdiv: { min: 1, max: 7 } }
      );
      const geometry = this.geometryFactory.createSphere(radius, subdiv);
      this.applyNewGeometry(geometry);
      this.emit('geometryCreated', { type: 'sphere', radius, subdiv });
    } catch (e) {
      this.recordError('CREATE_SPHERE', (e as Error).message);
      throw e;
    }
  }

  createBox(size: number, subdiv: number): void {
    try {
      this.memoryGuard.checkParameterBounds(
        { size, subdiv },
        { size: { min: 0.01, max: 100 }, subdiv: { min: 1, max: 7 } }
      );
      const geometry = this.geometryFactory.createBox(size, subdiv);
      this.applyNewGeometry(geometry);
      this.emit('geometryCreated', { type: 'box', size, subdiv });
    } catch (e) {
      this.recordError('CREATE_BOX', (e as Error).message);
      throw e;
    }
  }

  createTorus(mainR: number, tubeR: number): void {
    try {
      this.memoryGuard.checkParameterBounds(
        { mainR, tubeR },
        { mainR: { min: 0.01, max: 100 }, tubeR: { min: 0.005, max: 50 } }
      );
      const geometry = this.geometryFactory.createTorus(mainR, tubeR);
      this.applyNewGeometry(geometry);
      this.emit('geometryCreated', { type: 'torus', mainR, tubeR });
    } catch (e) {
      this.recordError('CREATE_TORUS', (e as Error).message);
      throw e;
    }
  }

  createHeart(scale: number = 1): void {
    try {
      const geometry = this.geometryFactory.createHeart(scale);
      this.applyNewGeometry(geometry);
      this.material.setColor(0.95, 0.45, 0.4);
      this.material.setRoughness(0.18);
      this.material.setMetalness(0.05);
      this.emit('geometryCreated', { type: 'heart', scale });
      this.emit('materialChanged', { color: { r: 0.95, g: 0.45, b: 0.4 }, roughness: 0.18, metalness: 0.05 });
    } catch (e) {
      this.recordError('CREATE_HEART', (e as Error).message);
      throw e;
    }
  }

  setBrushType(type: BrushType): void {
    this.brush.setBrushType(type);
    this.emit('brushChanged', { type });
  }

  setBrushParam(size: number, strength: number, decay: number): void {
    this.memoryGuard.checkParameterBounds(
      { size, strength, decay },
      { size: { min: 0.001, max: 10 }, strength: { min: 0, max: 10 }, decay: { min: 0, max: 5 } }
    );
    this.brush.setBrushParams({ size, strength, decay });
    this.emit('brushChanged', { size, strength, decay });
  }

  simulateStroke(points: Array<{ x: number; y: number; pressure: number }>): void {
    if (!points || points.length === 0) return;
    try {
      this.sculptEngine.simulateStroke(points);
      this.strokeCount++;
      this.layers.recordStroke();
      this.emit('strokeStarted', { pointCount: points.length });
      this.emit('strokeEnded', { pointCount: points.length, totalStrokes: this.strokeCount });
      this.emit('sceneChanged', { vertexCount: this.getVertexCount() });
    } catch (e) {
      this.recordError('SIMULATE_STROKE', (e as Error).message);
      throw e;
    }
  }

  maskDraw(points: Array<{ x: number; y: number }>): void {
    if (!points || points.length === 0) return;
    const mesh = this.sculptEngine.getActiveMesh();
    if (!mesh) return;
    const canvas = this.sm.renderer.domElement;
    this.mask.drawFromPoints(
      mesh,
      points,
      this.sm.activeCamera,
      canvas.clientWidth,
      canvas.clientHeight
    );
    this.emit('maskChanged', { action: 'draw', pointCount: points.length });
  }

  maskClear(): void {
    this.mask.clearMask();
    this.emit('maskChanged', { action: 'clear' });
  }

  maskInvert(): void {
    this.mask.invertMask();
    this.emit('maskChanged', { action: 'invert' });
  }

  layerNew(): void {
    const newIndex = this.layers.newLayer();
    this.emit('layerAdded', { index: newIndex });
    this.emit('sceneChanged', { layerCount: this.layers.getLayerCount() });
  }

  layerToggleVisible(index: number): void {
    this.layers.toggleVisible(index);
    this.emit('layerVisibilityChanged', { index });
  }

  async exportSTL(filename: string): Promise<string> {
    const geo = this.sculptEngine.getActiveGeometry();
    if (!geo) throw new Error('No geometry to export');
    const mesh = this.sculptEngine.getActiveMesh();
    const useAndroid = typeof window !== 'undefined' && window.location.protocol === 'https:' && !window.location.hostname.includes('localhost');
    const result = await this.exporter.exportAndSaveSTL(geo, filename, true, useAndroid);
    this.emit('exported', { format: 'stl', filename });
    return result;
  }

  async exportOBJ(filename: string): Promise<string> {
    const geo = this.sculptEngine.getActiveGeometry();
    if (!geo) throw new Error('No geometry to export');
    const useAndroid = typeof window !== 'undefined' && window.location.protocol === 'https:' && !window.location.hostname.includes('localhost');
    const result = await this.exporter.exportAndSaveOBJ(geo, filename, useAndroid);
    this.emit('exported', { format: 'obj', filename });
    return result;
  }

  async saveProjectJson(filename: string): Promise<string> {
    try {
      const projectData = this.serializeProject();
      const jsonString = JSON.stringify(projectData, null, 2);

      const isAndroid = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
      if (isAndroid) {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        await Filesystem.mkdir({
          path: 'MiniNomad',
          directory: Directory.Documents,
          recursive: true,
        }).catch(() => {});
        await Filesystem.writeFile({
          path: `MiniNomad/${filename}`,
          data: jsonString,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        const uri = await Filesystem.getUri({
          path: `MiniNomad/${filename}`,
          directory: Directory.Documents,
        });
        this.emit('saved', { filename, uri: uri.uri });
        return uri.uri;
      } else {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.emit('saved', { filename });
        return `Downloaded: ${filename}`;
      }
    } catch (e) {
      this.recordError('SAVE_PROJECT', (e as Error).message);
      throw e;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 上帝模式接口 — MiniNomadGodAPI
  // ══════════════════════════════════════════════════════════════════════

  setCamera(position: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }): void {
    this.cameraController.setCameraPosition(position.x, position.y, position.z);
    this.cameraController.setCameraTarget(target.x, target.y, target.z);
    this.emit('cameraChanged', { position, target });
  }

  getCameraState(): SerializedCameraState {
    const cam = this.sm.activeCamera;
    const mode = this.sm.getCameraMode();
    return {
      position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
      target: { x: 0, y: 0, z: 0 },
      up: { x: cam.up.x, y: cam.up.y, z: cam.up.z },
      fov: mode === 'perspective' ? (cam as unknown as { fov: number }).fov : 0,
      near: cam.near,
      far: cam.far,
      zoom: cam.zoom,
      mode,
    };
  }

  getSceneState(): SceneState {
    const vertexCount = this.getVertexCount();
    const faceCount = this.sculptEngine.getFaceCount();
    const layerCount = this.layers.getLayerCount();
    const allLayers = this.layers.getAllLayers();
    const maskedCount = this.mask.getMaskedVertexCount();
    const memory = this.memoryGuard.getMemoryUsage(vertexCount);

    return {
      vertexCount,
      faceCount,
      layerCount,
      activeLayerIndex: this.layers.getActiveIndex(),
      layers: allLayers.map((l) => ({
        index: l.index,
        name: l.name,
        visible: l.visible,
        vertexCount: l.metadata.vertexCount,
        strokeCount: l.metadata.strokeCount,
        hasMask: l.mask !== null,
        maskedVertexCount: l.mask ? l.mask.vertexMask.reduce((s: number, v: number) => s + (v > 0 ? 1 : 0), 0) : 0,
      })),
      hasMask: this.mask.hasMask(),
      maskedVertexCount: maskedCount,
      brushConfig: this.brush.getBrushConfig(),
      cameraState: this.getCameraState(),
      materialConfig: this.material.getSerialized(),
      isWebGLContextLost: this.memoryGuard.isContextLost(),
      memoryUsage: memory,
    };
  }

  setMaterialParams(
    color: { r: number; g: number; b: number },
    roughness: number,
    metalness: number
  ): void {
    this.material.setColor(color.r, color.g, color.b);
    this.material.setRoughness(roughness);
    this.material.setMetalness(metalness);
    this.emit('materialChanged', { color, roughness, metalness });
  }

  getMaterialParams(): SerializedMaterialConfig {
    return this.material.getSerialized();
  }

  async getScreenshot(): Promise<string> {
    this.sm.renderer.render(this.sm.scene, this.sm.activeCamera);
    const canvas = this.sm.renderer.domElement;
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl;
  }

  clearScene(): void {
    const mesh = this.sculptEngine.getActiveMesh();
    if (mesh) {
      this.sm.scene.remove(mesh);
      const geo = mesh.geometry as BufferGeometry;
      geo.dispose();
      this.sculptEngine.setActiveMesh(mesh);
    }
    this.mask.clearMask();
    this.layers.dispose();
    this.undoRedo.clear();
    this.strokeCount = 0;
    this.emit('sceneChanged', { cleared: true });
  }

  undo(): void {
    this.undoRedo.undo();
    this.emit('undo', {});
    this.emit('sceneChanged', {});
  }

  redo(): void {
    this.undoRedo.redo();
    this.emit('redo', {});
    this.emit('sceneChanged', {});
  }

  getHistoryLength(): number {
    return this.undoRedo.getHistoryLength();
  }

  setBrushConfig(config: Partial<BrushConfig>): void {
    this.brush.setBrushConfig(config);
    this.emit('brushChanged', config);
  }

  getBrushConfig(): BrushConfig {
    return this.brush.getBrushConfig();
  }

  layerDuplicate(index: number): void {
    const newIndex = this.layers.duplicateLayer(index);
    if (newIndex >= 0) {
      this.emit('layerAdded', { index: newIndex, duplicatedFrom: index });
    }
  }

  layerDelete(index: number): void {
    this.layers.deleteLayer(index);
    this.emit('layerRemoved', { index });
  }

  layerSetActive(index: number): void {
    this.layers.setActive(index);
    this.emit('sceneChanged', { activeLayer: index });
  }

  layerGetAll(): SculptLayer[] {
    return this.layers.getAllLayers();
  }

  maskSetOpacity(opacity: number): void {
    this.mask.setOpacity(Math.max(0, Math.min(1, opacity)));
  }

  maskGetData(): Float32Array | null {
    return this.mask.getMaskData();
  }

  setVertexColor(
    points: Array<{ x: number; y: number; z: number }>,
    color: { r: number; g: number; b: number },
    radius: number
  ): void {
    const geo = this.sculptEngine.getActiveGeometry();
    if (!geo) return;
    for (const pt of points) {
      this.vertexColor.setVertexColorByPosition(
        geo,
        new Vector3(pt.x, pt.y, pt.z),
        radius,
        color.r,
        color.g,
        color.b,
        this.mask
      );
    }
    this.emit('sceneChanged', { action: 'vertexColor' });
  }

  pickVertexColor(point: { x: number; y: number }): { r: number; g: number; b: number } | null {
    const mesh = this.sculptEngine.getActiveMesh();
    if (!mesh) return null;
    const canvas = this.sm.renderer.domElement;
    const color = this.vertexColor.pickColor(
      mesh,
      point.x,
      point.y,
      this.sm.activeCamera,
      canvas.clientWidth,
      canvas.clientHeight
    );
    if (!color) return null;
    return { r: color.r, g: color.g, b: color.b };
  }

  subdivide(levels: number): void {
    const geo = this.sculptEngine.getActiveGeometry();
    if (!geo) return;
    const newGeo = this.geometryFactory.subdivideGeometry(geo, levels);
    this.sculptEngine.updateMeshGeometry(newGeo);
    this.layers.syncGeometry(newGeo);
    this.mask.syncGeometry(newGeo);
    this.emit('sceneChanged', { action: 'subdivide', vertexCount: newGeo.attributes.position.count });
  }

  getVertexCount(): number {
    return this.sculptEngine.getVertexCount();
  }

  setViewportConfig(config: Partial<ViewportConfig>): void {
    if (config.antialias !== undefined) {
      console.warn('[AiControlAPI] antialias requires renderer recreation');
    }
    this.sm.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.emit('sceneChanged', { action: 'viewportConfig' });
  }

  render(): void {
    this.sm.renderer.render(this.sm.scene, this.sm.activeCamera);
  }

  on(event: AppEvent, callback: (data: unknown) => void): void {
    this.eventListeners.push({ event, callback });
  }

  off(event: AppEvent, callback: (data: unknown) => void): void {
    this.eventListeners = this.eventListeners.filter(
      (entry) => !(entry.event === event && entry.callback === callback)
    );
  }

  async loadProjectJson(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);
      this.material.loadSerialized(data.materialConfig);
      this.emit('loaded', { version: data.version });
      return true;
    } catch (e) {
      this.recordError('LOAD_PROJECT', (e as Error).message);
      return false;
    }
  }

  getProjectInfo(): ProjectMetadata {
    return {
      totalVertices: this.getVertexCount(),
      layerCount: this.layers.getLayerCount(),
      strokeCount: this.strokeCount,
      appVersion: this.appVersion,
      deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };
  }

  getDiagnostics(): DiagnosticsInfo {
    const gl = this.sm.renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const info = this.sm.getWebGLInfo();
    const memory = this.memoryGuard.getMemoryUsage(this.getVertexCount());
    const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    return {
      webglVersion: info.version,
      renderer: info.renderer,
      vendor: info.vendor,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      maxVertexAttributes: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      fps: 0,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      programs: 0,
      memoryUsage: memory,
      isMobile,
      hasPenSupport: typeof window !== 'undefined' && !!window.PointerEvent,
      touchEventCount: 0,
      lastError: this.errors.length > 0 ? {
        code: this.errors[this.errors.length - 1].code,
        message: this.errors[this.errors.length - 1].message,
        module: 'AiControlAPI',
        recoverable: true,
        timestamp: this.errors[this.errors.length - 1].timestamp,
      } : null,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 内部方法
  // ══════════════════════════════════════════════════════════════════════

  private applyNewGeometry(geometry: BufferGeometry): void {
    const oldMesh = this.sculptEngine.getActiveMesh();
    if (oldMesh) {
      this.sm.scene.remove(oldMesh);
      const oldGeo = oldMesh.geometry as BufferGeometry;
      oldGeo.dispose();
    }

    this.mask.initialize(geometry);
    this.mask.attachToScene(this.sm.scene);

    const newMesh = this.layers.initialize(geometry, this.material.getMaterial());
    newMesh.geometry = geometry;
    this.sculptEngine.setActiveMesh(newMesh);
    this.sm.scene.add(newMesh);

    this.vertexColor.ensureColorAttribute(geometry);
  }

  private serializeProject(): unknown {
    const layers = this.layers.getAllLayers();
    const serializedLayers = layers.map((layer) => {
      const geo = layer.baseGeometry;
      const positions = geo ? (geo.attributes.position.array as Float32Array) : new Float32Array(0);
      const normals = geo && geo.attributes.normal ? (geo.attributes.normal.array as Float32Array) : new Float32Array(0);
      const indices = geo && geo.index ? (geo.index.array as Uint32Array) : new Uint32Array(0);
      const colors = geo && geo.attributes.color ? (geo.attributes.color.array as Float32Array) : new Float32Array(0);
      const mask = layer.mask ? Array.from(layer.mask.vertexMask) : null;
      const disp = layer.displacement ? Array.from(layer.displacement) : null;

      return {
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        vertexCount: layer.metadata.vertexCount,
        positions: Array.from(positions),
        normals: Array.from(normals),
        indices: Array.from(indices),
        colors: Array.from(colors),
        mask,
        displacement: disp,
      };
    });

    return {
      version: this.appVersion,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      layers: serializedLayers,
      cameraState: this.getCameraState(),
      materialConfig: this.material.getSerialized(),
      metadata: this.getProjectInfo(),
    };
  }

  private emit(event: AppEvent, data: unknown): void {
    for (const entry of this.eventListeners) {
      if (entry.event === event) {
        try {
          entry.callback(data);
        } catch (e) {
          console.error(`[AiControlAPI] Event listener error for "${event}":`, e);
        }
      }
    }
  }

  private recordError(code: string, message: string): void {
    const error = { code, message, timestamp: Date.now() };
    this.errors.push(error);
    this.emit('error', error);
    console.error(`[AiControlAPI] ${code}: ${message}`);
  }
}

// ── 全局挂载 ─────────────────────────────────────────────────────────────

declare global {
  interface Window {
    MiniNomadAPI?: MiniNomadFullAPI;
  }
}

export function mountAiControlAPI(api: AiControlAPI): void {
  if (typeof window !== 'undefined') {
    window.MiniNomadAPI = api;
    console.log('[AiControlAPI] Mounted to window.MiniNomadAPI');
  }
}

export function getGlobalAPI(): MiniNomadFullAPI | null {
  if (typeof window !== 'undefined' && window.MiniNomadAPI) {
    return window.MiniNomadAPI;
  }
  return null;
}
