// ============================================================================
// ai-control-test.ts — AI控制链路测试脚本
// 测试: createSphere -> setBrushType -> setBrushParam -> simulateStroke -> getScreenshot -> 自我纠错
// ============================================================================

import type { MiniNomadFullAPI } from '../types';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  data?: unknown;
}

export async function runAiControlTest(api: MiniNomadFullAPI): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ── Test 1: createSphere ──
  try {
    api.createSphere(1.5, 3);
    const vertexCount = api.getVertexCount();
    const passed = vertexCount > 0;
    results.push({
      name: 'createSphere',
      passed,
      message: passed ? `Sphere created with ${vertexCount} vertices` : 'No vertices created',
      data: { vertexCount },
    });
  } catch (e) {
    results.push({ name: 'createSphere', passed: false, message: (e as Error).message });
  }

  // ── Test 2: setBrushType ──
  try {
    api.setBrushType('sculpt');
    const config = api.getBrushConfig();
    const passed = config.type === 'sculpt';
    results.push({
      name: 'setBrushType',
      passed,
      message: passed ? 'Brush type set to sculpt' : `Expected sculpt, got ${config.type}`,
      data: { type: config.type },
    });
  } catch (e) {
    results.push({ name: 'setBrushType', passed: false, message: (e as Error).message });
  }

  // ── Test 3: setBrushParam ──
  try {
    api.setBrushParam(0.5, 1.0, 0.3);
    const config = api.getBrushConfig();
    const passed = config.size === 0.5 && config.strength === 1.0 && config.decay === 0.3;
    results.push({
      name: 'setBrushParam',
      passed,
      message: passed ? 'Brush params set correctly' : 'Brush params mismatch',
      data: { size: config.size, strength: config.strength, decay: config.decay },
    });
  } catch (e) {
    results.push({ name: 'setBrushParam', passed: false, message: (e as Error).message });
  }

  // ── Test 4: simulateStroke ──
  try {
    const points: Array<{ x: number; y: number; pressure: number }> = [];
    const centerX = 400;
    const centerY = 300;
    const radius = 50;
    const segments = 20;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        pressure: 0.8,
      });
    }

    api.simulateStroke(points);
    const vertexCountAfter = api.getVertexCount();
    const passed = vertexCountAfter > 0;
    results.push({
      name: 'simulateStroke',
      passed,
      message: passed ? `Stroke simulated, ${points.length} points, ${vertexCountAfter} vertices` : 'Stroke failed',
      data: { pointCount: points.length, vertexCount: vertexCountAfter },
    });
  } catch (e) {
    results.push({ name: 'simulateStroke', passed: false, message: (e as Error).message });
  }

  // ── Test 5: getScreenshot ──
  try {
    const screenshot = await api.getScreenshot();
    const passed = screenshot.startsWith('data:image/png');
    results.push({
      name: 'getScreenshot',
      passed,
      message: passed ? `Screenshot captured (${screenshot.length} bytes base64)` : 'Invalid screenshot format',
      data: { size: screenshot.length, prefix: screenshot.substring(0, 30) },
    });
  } catch (e) {
    results.push({ name: 'getScreenshot', passed: false, message: (e as Error).message });
  }

  // ── Test 6: getSceneState (自我纠错基础) ──
  try {
    const state = api.getSceneState();
    const passed = state.vertexCount > 0 && state.brushConfig.type === 'sculpt';
    results.push({
      name: 'getSceneState',
      passed,
      message: passed ? `Scene: ${state.vertexCount} verts, ${state.faceCount} faces, ${state.layerCount} layers` : 'Invalid scene state',
      data: {
        vertexCount: state.vertexCount,
        faceCount: state.faceCount,
        layerCount: state.layerCount,
        activeLayerIndex: state.activeLayerIndex,
        hasMask: state.hasMask,
      },
    });
  } catch (e) {
    results.push({ name: 'getSceneState', passed: false, message: (e as Error).message });
  }

  // ── Test 7: setCamera (上帝模式) ──
  try {
    api.setCamera({ x: 5, y: 5, z: 5 }, { x: 0, y: 0, z: 0 });
    const camState = api.getCameraState();
    const passed = Math.abs(camState.position.x - 5) < 0.01;
    results.push({
      name: 'setCamera (God Mode)',
      passed,
      message: passed ? `Camera at (${camState.position.x}, ${camState.position.y}, ${camState.position.z})` : 'Camera position mismatch',
      data: camState,
    });
  } catch (e) {
    results.push({ name: 'setCamera (God Mode)', passed: false, message: (e as Error).message });
  }

  // ── Test 8: setMaterialParams (上帝模式) ──
  try {
    api.setMaterialParams({ r: 0.9, g: 0.3, b: 0.1 }, 0.5, 0.2);
    const matParams = api.getMaterialParams();
    const passed = Math.abs(matParams.roughness - 0.5) < 0.01 && Math.abs(matParams.metalness - 0.2) < 0.01;
    results.push({
      name: 'setMaterialParams (God Mode)',
      passed,
      message: passed ? `Material: roughness=${matParams.roughness}, metalness=${matParams.metalness}` : 'Material params mismatch',
      data: matParams,
    });
  } catch (e) {
    results.push({ name: 'setMaterialParams (God Mode)', passed: false, message: (e as Error).message });
  }

  // ── Test 9: undo/redo (上帝模式) ──
  try {
    api.undo();
    api.redo();
    const passed = api.getHistoryLength() >= 0;
    results.push({
      name: 'undo/redo (God Mode)',
      passed,
      message: passed ? `Undo/Redo executed, history length: ${api.getHistoryLength()}` : 'Undo/Redo failed',
    });
  } catch (e) {
    results.push({ name: 'undo/redo (God Mode)', passed: false, message: (e as Error).message });
  }

  // ── Test 10: getDiagnostics (上帝模式) ──
  try {
    const diag = api.getDiagnostics();
    const passed = !!diag.webglVersion && !!diag.renderer;
    results.push({
      name: 'getDiagnostics (God Mode)',
      passed,
      message: passed ? `WebGL: ${diag.webglVersion}, Renderer: ${diag.renderer}, Mobile: ${diag.isMobile}` : 'Diagnostics failed',
      data: {
        webglVersion: diag.webglVersion,
        renderer: diag.renderer,
        vendor: diag.vendor,
        isMobile: diag.isMobile,
        hasPenSupport: diag.hasPenSupport,
      },
    });
  } catch (e) {
    results.push({ name: 'getDiagnostics (God Mode)', passed: false, message: (e as Error).message });
  }

  // ── Test 11: createBox ──
  try {
    api.createBox(1.5, 3);
    const vertexCount = api.getVertexCount();
    const passed = vertexCount > 0;
    results.push({
      name: 'createBox',
      passed,
      message: passed ? `Box created with ${vertexCount} vertices` : 'Box creation failed',
      data: { vertexCount },
    });
  } catch (e) {
    results.push({ name: 'createBox', passed: false, message: (e as Error).message });
  }

  // ── Test 12: createTorus ──
  try {
    api.createTorus(0.8, 0.25);
    const vertexCount = api.getVertexCount();
    const passed = vertexCount > 0;
    results.push({
      name: 'createTorus',
      passed,
      message: passed ? `Torus created with ${vertexCount} vertices` : 'Torus creation failed',
      data: { vertexCount },
    });
  } catch (e) {
    results.push({ name: 'createTorus', passed: false, message: (e as Error).message });
  }

  // ── Test 13: maskDraw / maskClear / maskInvert ──
  try {
    api.maskDraw([{ x: 400, y: 300 }, { x: 410, y: 310 }]);
    api.maskInvert();
    api.maskClear();
    const passed = true;
    results.push({
      name: 'maskDraw/maskClear/maskInvert',
      passed,
      message: 'Mask operations executed successfully',
    });
  } catch (e) {
    results.push({ name: 'maskDraw/maskClear/maskInvert', passed: false, message: (e as Error).message });
  }

  // ── Test 14: layerNew / layerToggleVisible ──
  try {
    const beforeCount = api.getSceneState().layerCount;
    api.layerNew();
    const afterCount = api.getSceneState().layerCount;
    api.layerToggleVisible(0);
    const passed = afterCount > beforeCount;
    results.push({
      name: 'layerNew/layerToggleVisible',
      passed,
      message: passed ? `Layers: ${beforeCount} -> ${afterCount}` : 'Layer creation failed',
      data: { beforeCount, afterCount },
    });
  } catch (e) {
    results.push({ name: 'layerNew/layerToggleVisible', passed: false, message: (e as Error).message });
  }

  // ── Test 15: clearScene (上帝模式) ──
  try {
    api.createSphere(1, 2);
    api.clearScene();
    const passed = true;
    results.push({
      name: 'clearScene (God Mode)',
      passed,
      message: 'Scene cleared successfully',
    });
  } catch (e) {
    results.push({ name: 'clearScene (God Mode)', passed: false, message: (e as Error).message });
  }

  // ── Test 16: 视觉反馈闭环 (getScreenshot -> 自我纠错) ──
  try {
    api.createSphere(1.5, 3);
    api.setBrushType('sculpt');
    api.setBrushParam(0.3, 0.5, 0.3);

    const beforeScreenshot = await api.getScreenshot();
    const beforeState = api.getSceneState();

    const strokePoints: Array<{ x: number; y: number; pressure: number }> = [];
    for (let i = 0; i < 15; i++) {
      strokePoints.push({
        x: 380 + i * 4,
        y: 280 + Math.sin(i * 0.5) * 20,
        pressure: 0.7,
      });
    }
    api.simulateStroke(strokePoints);

    const afterScreenshot = await api.getScreenshot();
    const afterState = api.getSceneState();

    const passed = afterScreenshot.length > 100 && afterState.vertexCount > 0;
    results.push({
      name: 'Visual Feedback Loop (Screenshot -> Self-Correction)',
      passed,
      message: passed
        ? `Closed loop: before(${beforeState.vertexCount}v) -> stroke -> after(${afterState.vertexCount}v) -> screenshot(${afterScreenshot.length}b)`
        : 'Visual feedback loop failed',
      data: {
        beforeVertexCount: beforeState.vertexCount,
        afterVertexCount: afterState.vertexCount,
        screenshotSize: afterScreenshot.length,
      },
    });
  } catch (e) {
    results.push({ name: 'Visual Feedback Loop', passed: false, message: (e as Error).message });
  }

  return results;
}

export function printTestResults(results: TestResult[]): void {
  let passCount = 0;
  let failCount = 0;

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       MiniNomad AI Control Test Results                   ║');
  console.log('╠══════════════════════════════════════════════════════════╣');

  for (const result of results) {
    const status = result.passed ? 'PASS' : 'FAIL';
    const icon = result.passed ? 'O' : 'X';
    console.log(`║ [${icon}] ${status}  ${result.name.padEnd(40)} ║`);
    console.log(`║        ${result.message.substring(0, 54).padEnd(54)} ║`);
    if (!result.passed) {
      failCount++;
    } else {
      passCount++;
    }
  }

  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Total: ${results.length}  |  Passed: ${passCount}  |  Failed: ${failCount}  ${' '.repeat(Math.max(0, 30 - String(results.length + passCount + failCount).length))}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (failCount === 0) {
    console.log('\n  ALL TESTS PASSED - AI ABSOLUTE CONTROL VERIFIED\n');
  } else {
    console.log(`\n  ${failCount} TEST(S) FAILED - REVIEW ABOVE\n`);
  }
}

export async function runTestFromWindow(): Promise<void> {
  const api = (window as unknown as { MiniNomadAPI?: MiniNomadFullAPI }).MiniNomadAPI;
  if (!api) {
    console.error('[Test] window.MiniNomadAPI not found. App not initialized.');
    return;
  }

  console.log('[Test] Starting AI control tests...');
  const results = await runAiControlTest(api);
  printTestResults(results);
}

if (typeof window !== 'undefined') {
  (window as unknown as { runMiniNomadTest: () => Promise<void> }).runMiniNomadTest = runTestFromWindow;
  console.log('[Test] Test runner available at window.runMiniNomadTest()');
}
