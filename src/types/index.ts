// ============================================================================
// MiniNomad-Android-AI — Global Type Definitions
// 全局类型定义：所有模块的接口契约
// ============================================================================

// ── Three.js 类型重导出 ──────────────────────────────────────────────────────
export type * from 'three';
import type {
  Scene,
  PerspectiveCamera,
  OrthographicCamera,
  WebGLRenderer,
  Mesh,
  Vector2,
  Vector3,
  Color,
  BufferGeometry,
  Float32BufferAttribute,
} from 'three';

// ════════════════════════════════════════════════════════════════════════════
// 1. 笔刷系统类型
// ════════════════════════════════════════════════════════════════════════════

export type BrushType =
  | 'sculpt'
  | 'smooth'
  | 'inflate'
  | 'pinch'
  | 'drag'
  | 'scrape';

export interface BrushParams {
  size: number;
  strength: number;
  decay: number;
}

export interface BrushConfig extends BrushParams {
  type: BrushType;
  pressureEnabled: boolean;
  pressureCurve: 'linear' | 'quadratic' | 'cubic';
  falloffCurve: 'smooth' | 'constant' | 'linear';
  symmetryX: boolean;
  symmetryY: boolean;
  symmetryZ: boolean;
}

export const DEFAULT_BRUSH_CONFIG: BrushConfig = {
  type: 'sculpt',
  size: 0.5,
  strength: 0.5,
  decay: 0.3,
  pressureEnabled: true,
  pressureCurve: 'quadratic',
  falloffCurve: 'smooth',
  symmetryX: false,
  symmetryY: false,
  symmetryZ: false,
};

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

export interface StrokeData {
  points: StrokePoint[];
  brushType: BrushType;
  brushParams: BrushParams;
  layerIndex: number;
  timestamp: number;
}

// ════════════════════════════════════════════════════════════════════════════
// 2. 遮罩系统类型
// ════════════════════════════════════════════════════════════════════════════

export type MaskMode = 'draw' | 'clear' | 'invert';

export interface MaskData {
  vertexMask: Float32Array;
  visible: boolean;
  opacity: number;
  color: Color;
}

export interface MaskConfig {
  brushSize: number;
  brushStrength: number;
  falloff: number;
  minOpacity: number;
  maxOpacity: number;
  highlightColor: Color;
}

export const DEFAULT_MASK_CONFIG: Omit<MaskConfig, 'highlightColor'> = {
  brushSize: 0.5,
  brushStrength: 1.0,
  falloff: 0.3,
  minOpacity: 0.2,
  maxOpacity: 0.8,
};

// ════════════════════════════════════════════════════════════════════════════
// 3. 图层系统类型
// ════════════════════════════════════════════════════════════════════════════

export interface SculptLayer {
  index: number;
  name: string;
  visible: boolean;
  opacity: number;
  baseGeometry: BufferGeometry | null;
  displacement: Float32Array | null;
  vertexColors: Float32Array | null;
  mask: MaskData | null;
  metadata: LayerMetadata;
}

export interface LayerMetadata {
  vertexCount: number;
  createdAt: number;
  modifiedAt: number;
  strokeCount: number;
}

export interface LayerSystemState {
  layers: SculptLayer[];
  activeLayerIndex: number;
  maxLayers: number;
}

// ════════════════════════════════════════════════════════════════════════════
// 4. 材质系统类型
// ════════════════════════════════════════════════════════════════════════════

export interface MaterialParams {
  color: Color;
  roughness: number;
  metalness: number;
  flatShading: boolean;
  wireframe: boolean;
  vertexColorsEnabled: boolean;
}

export interface MaterialConfig {
  baseColor: Color;
  roughness: number;
  metalness: number;
  emissive: Color;
  emissiveIntensity: number;
  flatShading: boolean;
  vertexColors: boolean;
  doubleSided: boolean;
}

export const DEFAULT_MATERIAL_CONFIG: Omit<MaterialConfig, 'baseColor' | 'emissive'> = {
  roughness: 0.6,
  metalness: 0.1,
  emissiveIntensity: 0.0,
  flatShading: false,
  vertexColors: false,
  doubleSided: true,
};

// ════════════════════════════════════════════════════════════════════════════
// 5. 几何体类型
// ════════════════════════════════════════════════════════════════════════════

export type PrimitiveType = 'sphere' | 'box' | 'torus';

export interface SphereParams {
  radius: number;
  widthSegments: number;
  heightSegments: number;
  subdiv: number;
}

export interface BoxParams {
  width: number;
  height: number;
  depth: number;
  widthSegments: number;
  heightSegments: number;
  depthSegments: number;
  subdiv: number;
}

export interface TorusParams {
  radius: number;
  tube: number;
  radialSegments: number;
  tubularSegments: number;
  subdiv: number;
}

export interface SubdivisionConfig {
  levels: number;
  maxVertices: number;
  adaptive: boolean;
  boundaryMode: 'all' | 'edgeOnly' | 'none';
}

export const DEFAULT_SUBDIVISION: SubdivisionConfig = {
  levels: 3,
  maxVertices: 500000,
  adaptive: true,
  boundaryMode: 'all',
};

// ════════════════════════════════════════════════════════════════════════════
// 6. 相机与视口类型
// ════════════════════════════════════════════════════════════════════════════

export type CameraMode = 'perspective' | 'orthographic';

export interface CameraState {
  position: Vector3;
  target: Vector3;
  up: Vector3;
  fov: number;
  near: number;
  far: number;
  zoom: number;
  mode: CameraMode;
}

export interface ViewportConfig {
  antialias: boolean;
  alpha: boolean;
  powerPreference: 'default' | 'high-performance' | 'low-power';
  stencil: boolean;
  depth: boolean;
  preserveDrawingBuffer: boolean;
  localClippingEnabled: boolean;
}

export const DEFAULT_VIEWPORT: ViewportConfig = {
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
  stencil: false,
  depth: true,
  preserveDrawingBuffer: true,
  localClippingEnabled: true,
};

export interface GridConfig {
  size: number;
  divisions: number;
  color1: Color;
  color2: Color;
  opacity: number;
  visible: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// 7. 输入与指针类型
// ════════════════════════════════════════════════════════════════════════════

export type PointerType = 'mouse' | 'touch' | 'pen';

export interface PointerEvent {
  pointerId: number;
  pointerType: PointerType;
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  twist: number;
  isPrimary: boolean;
  buttons: number;
  timestamp: number;
}

export interface TouchGesture {
  type: 'rotate' | 'pan' | 'pinch' | 'doubleTap' | 'tripleFinger';
  pointers: PointerEvent[];
  centerX: number;
  centerY: number;
  scale: number;
  rotation: number;
}

export interface InputState {
  pointers: Map<number, PointerEvent>;
  activePointerCount: number;
  primaryPointer: PointerEvent | null;
  isStroking: boolean;
  currentStroke: StrokePoint[];
  gestureBuffer: TouchGesture[];
}

// ════════════════════════════════════════════════════════════════════════════
// 8. 文件导入导出类型
// ════════════════════════════════════════════════════════════════════════════

export type ExportFormat = 'stl' | 'obj' | 'json';

export type ImportFormat = 'stl' | 'obj';

export interface ImportOptions {
  format: ImportFormat;
  scale: number;
  center: boolean;
  recomputeNormals: boolean;
  mergeVertices: boolean;
  maxVertices: number;
}

export interface ExportOptions {
  format: ExportFormat;
  binary: boolean;
  flipY: boolean;
  includeColors: boolean;
  includeNormals: boolean;
}

export interface ProjectFile {
  version: string;
  createdAt: number;
  modifiedAt: number;
  layers: SerializedLayer[];
  cameraState: SerializedCameraState;
  materialConfig: SerializedMaterialConfig;
  metadata: ProjectMetadata;
}

export interface SerializedLayer {
  name: string;
  visible: boolean;
  opacity: number;
  vertexCount: number;
  positions: number[];
  normals: number[];
  indices: number[];
  colors: number[];
  mask: number[] | null;
  displacement: number[] | null;
}

export interface SerializedCameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
  fov: number;
  near: number;
  far: number;
  zoom: number;
  mode: CameraMode;
}

export interface SerializedMaterialConfig {
  baseColor: { r: number; g: number; b: number };
  roughness: number;
  metalness: number;
  flatShading: boolean;
  vertexColors: boolean;
}

export interface ProjectMetadata {
  totalVertices: number;
  layerCount: number;
  strokeCount: number;
  appVersion: string;
  deviceInfo: string;
}

// ════════════════════════════════════════════════════════════════════════════
// 9. AI 控制接口类型 — 标准接口
// ════════════════════════════════════════════════════════════════════════════

export interface MiniNomadAPI {
  // ── 几何体创建 ──
  createSphere(radius: number, subdiv: number): void;
  createBox(size: number, subdiv: number): void;
  createTorus(mainR: number, tubeR: number): void;

  // ── 笔刷控制 ──
  setBrushType(type: BrushType): void;
  setBrushParam(size: number, strength: number, decay: number): void;

  // ── 笔触模拟 ──
  simulateStroke(points: Array<{ x: number; y: number; pressure: number }>): void;

  // ── 遮罩系统 ──
  maskDraw(points: Array<{ x: number; y: number }>): void;
  maskClear(): void;
  maskInvert(): void;

  // ── 图层系统 ──
  layerNew(): void;
  layerToggleVisible(index: number): void;

  // ── 导出 ──
  exportSTL(filename: string): Promise<string>;
  exportOBJ(filename: string): Promise<string>;
  saveProjectJson(filename: string): Promise<string>;
}

// ════════════════════════════════════════════════════════════════════════════
// 10. AI 上帝模式接口 — 绝对控制权扩展
// ════════════════════════════════════════════════════════════════════════════

export interface MiniNomadGodAPI {
  // ── 相机绝对控制 ──
  setCamera(position: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }): void;
  getCameraState(): SerializedCameraState;

  // ── 场景查询 ──
  getSceneState(): SceneState;

  // ── 材质控制 ──
  setMaterialParams(
    color: { r: number; g: number; b: number },
    roughness: number,
    metalness: number
  ): void;
  getMaterialParams(): SerializedMaterialConfig;

  // ── 视觉反馈闭环 ──
  getScreenshot(): Promise<string>;

  // ── 场景清空 ──
  clearScene(): void;

  // ── 撤销重做 ──
  undo(): void;
  redo(): void;
  getHistoryLength(): number;

  // ── 高级笔刷控制 ──
  setBrushConfig(config: Partial<BrushConfig>): void;
  getBrushConfig(): BrushConfig;

  // ── 高级图层控制 ──
  layerDuplicate(index: number): void;
  layerDelete(index: number): void;
  layerSetActive(index: number): void;
  layerGetAll(): SculptLayer[];

  // ── 高级遮罩控制 ──
  maskSetOpacity(opacity: number): void;
  maskGetData(): Float32Array | null;

  // ── 顶点颜色控制 ──
  setVertexColor(
    points: Array<{ x: number; y: number; z: number }>,
    color: { r: number; g: number; b: number },
    radius: number
  ): void;
  pickVertexColor(point: { x: number; y: number }): { r: number; g: number; b: number } | null;

  // ── 几何体高级控制 ──
  subdivide(levels: number): void;
  getVertexCount(): number;

  // ── 渲染控制 ──
  setViewportConfig(config: Partial<ViewportConfig>): void;
  render(): void;

  // ── 事件监听 ──
  on(event: AppEvent, callback: (data: unknown) => void): void;
  off(event: AppEvent, callback: (data: unknown) => void): void;

  // ── 项目管理 ──
  loadProjectJson(jsonString: string): Promise<boolean>;
  getProjectInfo(): ProjectMetadata;

  // ── 诊断 ──
  getDiagnostics(): DiagnosticsInfo;
}

// 完整 AI 接口 = 标准 + 上帝模式
export type MiniNomadFullAPI = MiniNomadAPI & MiniNomadGodAPI;

// ════════════════════════════════════════════════════════════════════════════
// 11. 场景状态类型 (getSceneState 返回)
// ════════════════════════════════════════════════════════════════════════════

export interface SceneState {
  vertexCount: number;
  faceCount: number;
  layerCount: number;
  activeLayerIndex: number;
  layers: Array<{
    index: number;
    name: string;
    visible: boolean;
    vertexCount: number;
    strokeCount: number;
    hasMask: boolean;
    maskedVertexCount: number;
  }>;
  hasMask: boolean;
  maskedVertexCount: number;
  brushConfig: BrushConfig;
  cameraState: SerializedCameraState;
  materialConfig: SerializedMaterialConfig;
  isWebGLContextLost: boolean;
  memoryUsage: MemoryUsage;
}

export interface MemoryUsage {
  estimated: number;
  vertexLimit: number;
  ratio: number;
  warning: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// 12. 事件系统类型
// ════════════════════════════════════════════════════════════════════════════

export type AppEvent =
  | 'sceneChanged'
  | 'layerAdded'
  | 'layerRemoved'
  | 'layerVisibilityChanged'
  | 'brushChanged'
  | 'strokeStarted'
  | 'strokeEnded'
  | 'maskChanged'
  | 'materialChanged'
  | 'cameraChanged'
  | 'geometryCreated'
  | 'geometryImported'
  | 'exported'
  | 'saved'
  | 'loaded'
  | 'undo'
  | 'redo'
  | 'error'
  | 'webglContextLost'
  | 'webglContextRestored'
  | 'memoryWarning'
  | 'vertexLimitReached';

export interface AppError {
  code: string;
  message: string;
  module: string;
  recoverable: boolean;
  timestamp: number;
  details?: unknown;
}

// ════════════════════════════════════════════════════════════════════════════
// 13. 诊断信息类型
// ════════════════════════════════════════════════════════════════════════════

export interface DiagnosticsInfo {
  webglVersion: string;
  renderer: string;
  vendor: string;
  maxTextureSize: number;
  maxVertexUniformVectors: number;
  maxFragmentUniformVectors: number;
  maxVertexAttributes: number;
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  memoryUsage: MemoryUsage;
  isMobile: boolean;
  hasPenSupport: boolean;
  touchEventCount: number;
  lastError: AppError | null;
}

// ════════════════════════════════════════════════════════════════════════════
// 14. CommandParser 类型
// ════════════════════════════════════════════════════════════════════════════

export type CommandType =
  | 'createSphere'
  | 'createBox'
  | 'createTorus'
  | 'setBrushType'
  | 'setBrushParam'
  | 'simulateStroke'
  | 'maskDraw'
  | 'maskClear'
  | 'maskInvert'
  | 'layerNew'
  | 'layerToggleVisible'
  | 'exportSTL'
  | 'exportOBJ'
  | 'saveProjectJson'
  // 上帝模式命令
  | 'setCamera'
  | 'getSceneState'
  | 'setMaterialParams'
  | 'getScreenshot'
  | 'clearScene'
  | 'undo'
  | 'redo'
  | 'setBrushConfig'
  | 'layerDuplicate'
  | 'layerDelete'
  | 'layerSetActive'
  | 'subdivide'
  | 'setViewportConfig'
  | 'loadProjectJson'
  | 'getDiagnostics'
  | 'getVertexCount'
  | 'pickVertexColor'
  | 'setVertexColor';

export interface AICommand {
  action: CommandType;
  params?: Record<string, unknown>;
}

export interface CommandResult {
  success: boolean;
  action: CommandType;
  data?: unknown;
  error?: string;
  timestamp: number;
}

export type CommandBatch = AICommand[];

export interface CommandScript {
  name: string;
  commands: CommandBatch;
  loop?: boolean;
  delayMs?: number;
}

// ════════════════════════════════════════════════════════════════════════════
// 15. StrokeScheduler 类型
// ════════════════════════════════════════════════════════════════════════════

export interface ScheduledStrokeFrame {
  points: StrokePoint[];
  brushType: BrushType;
  brushParams: BrushParams;
  layerIndex: number;
  frameIndex: number;
  totalFrames: number;
}

export interface StrokeSchedulerConfig {
  maxPointsPerFrame: number;
  targetFPS: number;
  batchSize: number;
  interpolationEnabled: boolean;
  interpolationSteps: number;
}

export const DEFAULT_STROKE_SCHEDULER: StrokeSchedulerConfig = {
  maxPointsPerFrame: 8,
  targetFPS: 60,
  batchSize: 4,
  interpolationEnabled: true,
  interpolationSteps: 2,
};

export type StrokeSchedulerStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface StrokeSchedulerState {
  status: StrokeSchedulerStatus;
  totalPoints: number;
  processedPoints: number;
  currentFrame: number;
  totalFrames: number;
  queueLength: number;
  lastError: string | null;
}

// ════════════════════════════════════════════════════════════════════════════
// 16. UndoRedo 系统类型
// ════════════════════════════════════════════════════════════════════════════

export type CommandType2 =
  | 'stroke'
  | 'mask'
  | 'layer'
  | 'material'
  | 'geometry'
  | 'transform'
  | 'camera'
  | 'color';

export interface UndoCommand {
  type: CommandType2;
  description: string;
  timestamp: number;
  execute(): void;
  undo(): void;
  data?: unknown;
}

export interface UndoRedoState {
  undoStack: UndoCommand[];
  redoStack: UndoCommand[];
  maxStackSize: number;
  isExecuting: boolean;
}

export const MAX_UNDO_STACK = 100;

// ════════════════════════════════════════════════════════════════════════════
// 17. UI 事件与配置类型
// ════════════════════════════════════════════════════════════════════════════

export type UIToolMode =
  | 'sculpt'
  | 'mask'
  | 'layer'
  | 'material'
  | 'color'
  | 'transform';

export interface UITheme {
  backgroundColor: string;
  panelColor: string;
  accentColor: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  buttonColor: string;
  buttonActiveColor: string;
  sliderColor: string;
  sliderTrackColor: string;
  maskColor: string;
}

export const NOMAD_THEME: UITheme = {
  backgroundColor: '#1a1a1a',
  panelColor: '#2a2a2a',
  accentColor: '#e8731a',
  textColor: '#e0e0e0',
  subtextColor: '#888888',
  borderColor: '#3a3a3a',
  buttonColor: '#333333',
  buttonActiveColor: '#e8731a',
  sliderColor: '#e8731a',
  sliderTrackColor: '#444444',
  maskColor: '#ff9900',
};

export interface UIState {
  toolMode: UIToolMode;
  bottomBarVisible: boolean;
  topMenuVisible: boolean;
  layerPanelVisible: boolean;
  rightToolbarVisible: boolean;
  brushParams: BrushParams;
  currentBrushType: BrushType;
  isStroking: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// 18. 核心引擎引用类型
// ════════════════════════════════════════════════════════════════════════════

export interface CoreEngineRefs {
  scene: Scene;
  camera: PerspectiveCamera | OrthographicCamera;
  renderer: WebGLRenderer;
  activeMesh: Mesh | null;
  brushSystem: unknown;
  maskSystem: unknown;
  layerSystem: unknown;
  materialSystem: unknown;
  cameraController: unknown;
  sculptEngine: unknown;
  undoRedoSystem: unknown;
  geometryFactory: unknown;
}

export type EngineReady = boolean;

export interface EngineConfig {
  viewport: ViewportConfig;
  camera: Partial<CameraState>;
  material: Partial<MaterialConfig>;
  subdivision: SubdivisionConfig;
  grid: Partial<GridConfig>;
  strokeScheduler: Partial<StrokeSchedulerConfig>;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  viewport: DEFAULT_VIEWPORT,
  camera: {
    fov: 45,
    near: 0.1,
    far: 1000,
    zoom: 1,
    mode: 'perspective',
  },
  material: {
    roughness: 0.6,
    metalness: 0.1,
    flatShading: false,
    vertexColors: false,
    doubleSided: true,
    emissiveIntensity: 0,
  },
  subdivision: DEFAULT_SUBDIVISION,
  grid: {
    size: 20,
    divisions: 20,
    opacity: 0.3,
    visible: true,
  },
  strokeScheduler: DEFAULT_STROKE_SCHEDULER,
};
