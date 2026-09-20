// ============================================================================
// SceneManager.ts — 场景管理: Scene/Renderer/灯光/网格地面
// ============================================================================

import {
  Scene,
  WebGLRenderer,
  PerspectiveCamera,
  OrthographicCamera,
  DirectionalLight,
  AmbientLight,
  HemisphereLight,
  GridHelper,
  Color,
  Vector3,
  PCFSoftShadowMap,
  REVISION,
} from 'three';
import type { ViewportConfig, CameraMode, GridConfig, CameraState } from '../types';

export class SceneManager {
  public scene: Scene;
  public renderer: WebGLRenderer;
  public perspectiveCamera: PerspectiveCamera;
  public orthographicCamera: OrthographicCamera;
  public activeCamera: PerspectiveCamera | OrthographicCamera;
  public grid: GridHelper;

  private dirLight: DirectionalLight;
  private ambLight: AmbientLight;
  private hemiLight: HemisphereLight;
  private container: HTMLElement;
  private cameraMode: CameraMode = 'perspective';
  private resizeObserver: ResizeObserver | null = null;
  private animFrameId: number = 0;
  private renderCallbacks: Array<() => void> = [];

  constructor(container: HTMLElement, viewportConfig: ViewportConfig) {
    this.container = container;

    this.scene = new Scene();
    this.scene.background = new Color(0x1a1a1a);

    this.renderer = new WebGLRenderer({
      antialias: viewportConfig.antialias,
      alpha: viewportConfig.alpha,
      powerPreference: viewportConfig.powerPreference,
      stencil: viewportConfig.stencil,
      depth: viewportConfig.depth,
      preserveDrawingBuffer: viewportConfig.preserveDrawingBuffer,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.localClippingEnabled = viewportConfig.localClippingEnabled;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';

    const aspect = container.clientWidth / container.clientHeight;
    this.perspectiveCamera = new PerspectiveCamera(45, aspect, 0.1, 1000);
    this.perspectiveCamera.position.set(5, 4, 5);
    this.perspectiveCamera.lookAt(0, 0, 0);

    const frustumSize = 5;
    this.orthographicCamera = new OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    this.orthographicCamera.position.copy(this.perspectiveCamera.position);
    this.orthographicCamera.lookAt(0, 0, 0);

    this.activeCamera = this.perspectiveCamera;

    this.ambLight = new AmbientLight(0xffffff, 0.35);
    this.scene.add(this.ambLight);

    this.hemiLight = new HemisphereLight(0xffffff, 0x444444, 0.4);
    this.hemiLight.position.set(0, 20, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(5, 10, 7.5);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 50;
    this.dirLight.shadow.camera.left = -10;
    this.dirLight.shadow.camera.right = 10;
    this.dirLight.shadow.camera.top = 10;
    this.dirLight.shadow.camera.bottom = -10;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    this.grid = new GridHelper(20, 20, 0x555555, 0x333333);
    this.grid.visible = true;
    this.scene.add(this.grid);

    this.onContextLost = this.onContextLost.bind(this);
    this.onContextRestored = this.onContextRestored.bind(this);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost as EventListener);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored as EventListener);
  }

  private onContextLost(event: Event): void {
    event.preventDefault();
    console.error('[SceneManager] WebGL context lost');
  }

  private onContextRestored(): void {
    console.log('[SceneManager] WebGL context restored');
    this.renderer = new WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    if (mode === 'perspective') {
      this.activeCamera = this.perspectiveCamera;
    } else {
      this.orthographicCamera.position.copy(this.perspectiveCamera.position);
      this.orthographicCamera.quaternion.copy(this.perspectiveCamera.quaternion);
      this.activeCamera = this.orthographicCamera;
    }
  }

  getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  setCameraPosition(position: Vector3, target: Vector3): void {
    this.perspectiveCamera.position.copy(position);
    this.perspectiveCamera.lookAt(target);
    this.orthographicCamera.position.copy(position);
    this.orthographicCamera.lookAt(target);
  }

  getCameraState(): CameraState {
    const cam = this.activeCamera;
    return {
      position: cam.position.clone(),
      target: new Vector3(0, 0, 0).applyQuaternion(cam.quaternion).add(cam.position).negate().normalize(),
      up: cam.up.clone(),
      fov: this.cameraMode === 'perspective' ? (this.perspectiveCamera.fov) : 0,
      near: cam.near,
      far: cam.far,
      zoom: cam.zoom,
      mode: this.cameraMode,
    };
  }

  setGridConfig(config: Partial<GridConfig>): void {
    if (config.visible !== undefined) this.grid.visible = config.visible;
    if (config.opacity !== undefined) {
      const mat = this.grid.material as { opacity: number; transparent: boolean };
      mat.opacity = config.opacity;
      mat.transparent = config.opacity < 1;
    }
  }

  onRender(callback: () => void): void {
    this.renderCallbacks.push(callback);
  }

  offRender(callback: () => void): void {
    this.renderCallbacks = this.renderCallbacks.filter((cb) => cb !== callback);
  }

  startRenderLoop(): void {
    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate);
      for (const cb of this.renderCallbacks) {
        cb();
      }
      this.renderer.render(this.scene, this.activeCamera);
    };
    animate();
  }

  stopRenderLoop(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();
    const frustumSize = 5;
    this.orthographicCamera.left = (-frustumSize * aspect) / 2;
    this.orthographicCamera.right = (frustumSize * aspect) / 2;
    this.orthographicCamera.top = frustumSize / 2;
    this.orthographicCamera.bottom = -frustumSize / 2;
    this.orthographicCamera.updateProjectionMatrix();
  }

  attachResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  getWebGLInfo(): { version: string; renderer: string; vendor: string } {
    const gl = this.renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      version: gl.getParameter(gl.VERSION),
      renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
      vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
    };
  }

  getThreeRevision(): string {
    return REVISION;
  }

  dispose(): void {
    this.stopRenderLoop();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost as EventListener);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored as EventListener);
    this.scene.traverse((obj) => {
      if ((obj as unknown as { geometry?: { dispose: () => void } }).geometry) {
        (obj as unknown as { geometry: { dispose: () => void } }).geometry.dispose();
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
