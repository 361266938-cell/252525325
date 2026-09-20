// ============================================================================
// main.ts — 应用入口: 初始化所有模块
// ============================================================================

import { SceneManager } from './core/SceneManager';
import { CameraController } from './core/CameraController';
import { BrushSystem } from './core/BrushSystem';
import { SculptEngine } from './core/SculptEngine';
import { MaskSystem } from './core/MaskSystem';
import { LayerSystem } from './core/LayerSystem';
import { MaterialSystem } from './core/MaterialSystem';
import { GeometryFactory } from './core/GeometryFactory';
import { VertexColorSystem } from './core/VertexColorSystem';
import { UndoRedoSystem } from './core/UndoRedoSystem';
import { MeshExporter } from './core/MeshExporter';
import { MeshImporter } from './core/MeshImporter';
import { PointerInput } from './core/PointerInput';
import { MemoryGuard } from './utils/memoryGuard';
import { AiControlAPI, mountAiControlAPI } from './ai/AiControlAPI';
import { CommandParser } from './ai/CommandParser';
import { StrokeScheduler } from './ai/StrokeScheduler';
import { Toolbar } from './ui/Toolbar';
import { TopMenu } from './ui/TopMenu';
import { BottomParamBar } from './ui/BottomParamBar';
import { LayerPanel } from './ui/LayerPanel';
import { DEFAULT_VIEWPORT, DEFAULT_ENGINE_CONFIG } from './types';
import type { BrushType, UIToolMode, BrushParams } from './types';

async function main(): Promise<void> {
  const container = document.getElementById('canvas-container');
  if (!container) throw new Error('Canvas container not found');

  const loadingEl = document.getElementById('loading');
  const statusEl = document.getElementById('status');

  const memoryGuard = new MemoryGuard(500000);
  const sm = new SceneManager(container, DEFAULT_VIEWPORT);
  sm.attachResizeObserver();
  sm.startRenderLoop();

  const cameraController = new CameraController(sm);
  const brush = new BrushSystem();
  const mask = new MaskSystem();
  const layers = new LayerSystem();
  const material = new MaterialSystem();
  const geometryFactory = new GeometryFactory(memoryGuard, DEFAULT_ENGINE_CONFIG.subdivision);
  const vertexColor = new VertexColorSystem();
  const undoRedo = new UndoRedoSystem();
  const exporter = new MeshExporter();
  const importer = new MeshImporter(memoryGuard);
  const sculptEngine = new SculptEngine(sm, brush, mask, layers);

  const api = new AiControlAPI({
    sm, cameraController, sculptEngine, brush, mask, layers, material,
    geometryFactory, vertexColor, undoRedo, exporter, importer, memoryGuard,
  });
  mountAiControlAPI(api);

  const commandParser = new CommandParser(api);
  const strokeScheduler = new StrokeScheduler(api);

  api.createSphere(1.5, 3);
  cameraController.resetCamera();

  const toolbar = new Toolbar(document.getElementById('app')!);
  const topMenu = new TopMenu(document.getElementById('app')!);
  const bottomBar = new BottomParamBar(document.getElementById('app')!);
  const layerPanel = new LayerPanel(document.getElementById('app')!);
  layerPanel.hide();

  toolbar.setHandlers({
    onToolModeChange: (mode: UIToolMode) => {
      if (mode === 'layer') layerPanel.show();
      else layerPanel.hide();
      if (statusEl) statusEl.textContent = `Mode: ${mode}`;
    },
    onBrushTypeChange: (type: BrushType) => {
      api.setBrushType(type);
      if (statusEl) statusEl.textContent = `Brush: ${type}`;
    },
  });

  bottomBar.setHandler((params: BrushParams) => {
    api.setBrushParam(params.size, params.strength, params.decay);
  });

  layerPanel.setHandlers({
    onLayerNew: () => api.layerNew(),
    onLayerToggleVisible: (i: number) => api.layerToggleVisible(i),
    onLayerDuplicate: (i: number) => api.layerDuplicate(i),
    onLayerDelete: (i: number) => api.layerDelete(i),
    onLayerSelect: (i: number) => api.layerSetActive(i),
  });

  const updateLayerPanel = () => {
    layerPanel.updateLayers(layers.getAllLayers(), layers.getActiveIndex());
  };
  api.on('layerAdded', updateLayerPanel);
  api.on('layerRemoved', updateLayerPanel);
  api.on('layerVisibilityChanged', updateLayerPanel);

  document.getElementById('app')!.addEventListener('mn-toolbar-action', (e) => {
    const action = (e as CustomEvent).detail.action as string;
    switch (action) {
      case 'action-undo': api.undo(); break;
      case 'action-redo': api.redo(); break;
      case 'action-clear': api.clearScene(); break;
      case 'action-export': api.exportSTL('export.stl'); break;
    }
  });

  document.getElementById('app')!.addEventListener('mn-top-menu-action', (e) => {
    const action = (e as CustomEvent).detail.action as string;
    switch (action) {
      case 'top-export-stl': api.exportSTL('export.stl'); break;
      case 'top-export-obj': api.exportOBJ('export.obj'); break;
      case 'top-save': api.saveProjectJson('project.json'); break;
      case 'top-import-stl': {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.stl';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          const buf = await file.arrayBuffer();
          const geo = importer.importSTL(buf);
          const mesh = sculptEngine.getActiveMesh();
          if (mesh) {
            sm.scene.remove(mesh);
            mesh.geometry.dispose();
          }
          mesh.geometry = geo;
          sculptEngine.setActiveMesh(mesh);
          mask.initialize(geo);
          mask.attachToScene(sm.scene);
          sm.scene.add(mesh);
        };
        input.click();
        break;
      }
      case 'top-import-obj': {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.obj';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          const text = await file.text();
          const geo = importer.importOBJ(text);
          const mesh = sculptEngine.getActiveMesh();
          if (mesh) {
            sm.scene.remove(mesh);
            mesh.geometry.dispose();
          }
          mesh.geometry = geo;
          sculptEngine.setActiveMesh(mesh);
          mask.initialize(geo);
          mask.attachToScene(sm.scene);
          sm.scene.add(mesh);
        };
        input.click();
        break;
      }
    }
  });

  const pointerInput = new PointerInput(sm.renderer.domElement);
  pointerInput.setHandlers({
    onPointerDown: (pe) => {
      if (pe.pointerType === 'mouse' && pe.buttons === 1) {
        sculptEngine.beginStroke({ x: pe.x, y: pe.y, pressure: pe.pressure, timestamp: pe.timestamp });
      } else if (pe.pointerType === 'touch' || pe.pointerType === 'pen') {
        sculptEngine.beginStroke({ x: pe.x, y: pe.y, pressure: pe.pressure, timestamp: pe.timestamp });
      }
    },
    onPointerMove: (pe) => {
      if (pointerInput.isStrokingInProgress()) {
        sculptEngine.continueStroke({ x: pe.x, y: pe.y, pressure: pe.pressure, timestamp: pe.timestamp });
      }
    },
    onPointerUp: (pe) => {
      if (sculptEngine.isStrokeInProgress()) {
        sculptEngine.endStroke();
      }
    },
    onDoubleTap: () => {
      api.undo();
    },
    onTripleFinger: () => {
      cameraController.toggleCameraMode();
    },
    onGesture: (gesture) => {
      if (gesture.type === 'pan' && gesture.pointers.length === 2) {
        const cam = sm.activeCamera;
        const panLeft = new Float32Array([1,0,0]);
        const panUp = new Float32Array([0,1,0]);
        const dx = -(gesture.centerX - (gesture.pointers[0].x + gesture.pointers[1].x) / 2) * 0.005;
        const dy = (gesture.centerY - (gesture.pointers[0].y + gesture.pointers[1].y) / 2) * 0.005;
      }
    },
  });

  if (loadingEl) loadingEl.style.display = 'none';
  if (statusEl) statusEl.textContent = 'Ready';

  (window as unknown as { MiniNomadCommandParser: CommandParser }).MiniNomadCommandParser = commandParser;
  (window as unknown as { MiniNomadStrokeScheduler: StrokeScheduler }).MiniNomadStrokeScheduler = strokeScheduler;

  console.log('[MiniNomad] Initialized. API at window.MiniNomadAPI');
  console.log('[MiniNomad] CommandParser at window.MiniNomadCommandParser');
  console.log('[MiniNomad] StrokeScheduler at window.MiniNomadStrokeScheduler');
  console.log('[MiniNomad] Available commands:', commandParser.getSupportedCommands());
}

main().catch((err) => {
  console.error('[MiniNomad] Init error:', err);
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.textContent = `Error: ${err.message}`;
    loadingEl.style.color = '#ff5555';
  }
});
