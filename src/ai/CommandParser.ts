// ============================================================================
// CommandParser.ts — 命令解析器: JSON指令解析分发
// ============================================================================

import type {
  AICommand,
  CommandResult,
  CommandBatch,
  CommandScript,
  CommandType,
  MiniNomadFullAPI,
  BrushType,
} from '../types';

export class CommandParser {
  private api: MiniNomadFullAPI;
  private logEnabled: boolean = true;
  private results: CommandResult[] = [];
  private maxResults: number = 500;

  constructor(api: MiniNomadFullAPI) {
    this.api = api;
  }

  parse(jsonString: string): AICommand | CommandBatch | null {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) {
        return parsed as CommandBatch;
      }
      if (parsed && typeof parsed.action === 'string') {
        return parsed as AICommand;
      }
      if (parsed && typeof parsed.name === 'string' && Array.isArray(parsed.commands)) {
        return parsed as CommandScript;
      }
      this.log(`[CommandParser] Invalid JSON structure: ${jsonString.substring(0, 100)}`);
      return null;
    } catch (e) {
      this.log(`[CommandParser] JSON parse error: ${(e as Error).message}`);
      return null;
    }
  }

  async execute(command: AICommand): Promise<CommandResult> {
    const start = performance.now();
    const timestamp = Date.now();

    try {
      let data: unknown = undefined;

      switch (command.action) {
        // ── 几何体创建 ──
        case 'createSphere': {
          const params = command.params || {};
          this.api.createSphere(
            (params.radius as number) ?? 1,
            (params.subdiv as number) ?? 3
          );
          data = { created: 'sphere' };
          break;
        }
        case 'createBox': {
          const params = command.params || {};
          this.api.createBox(
            (params.size as number) ?? 1,
            (params.subdiv as number) ?? 3
          );
          data = { created: 'box' };
          break;
        }
        case 'createTorus': {
          const params = command.params || {};
          this.api.createTorus(
            (params.mainR as number) ?? 0.8,
            (params.tubeR as number) ?? 0.25
          );
          data = { created: 'torus' };
          break;
        }

        // ── 笔刷控制 ──
        case 'setBrushType': {
          const params = command.params || {};
          this.api.setBrushType(params.type as BrushType);
          data = { brushType: params.type };
          break;
        }
        case 'setBrushParam': {
          const params = command.params || {};
          this.api.setBrushParam(
            (params.size as number) ?? 0.5,
            (params.strength as number) ?? 0.5,
            (params.decay as number) ?? 0.3
          );
          data = { brushParams: params };
          break;
        }

        // ── 笔触模拟 ──
        case 'simulateStroke': {
          const params = command.params || {};
          const points = (params.points as Array<{ x: number; y: number; pressure: number }>) ?? [];
          this.api.simulateStroke(points);
          data = { pointCount: points.length };
          break;
        }

        // ── 遮罩系统 ──
        case 'maskDraw': {
          const params = command.params || {};
          const points = (params.points as Array<{ x: number; y: number }>) ?? [];
          this.api.maskDraw(points);
          data = { pointCount: points.length };
          break;
        }
        case 'maskClear':
          this.api.maskClear();
          data = { cleared: true };
          break;
        case 'maskInvert':
          this.api.maskInvert();
          data = { inverted: true };
          break;

        // ── 图层系统 ──
        case 'layerNew':
          this.api.layerNew();
          data = { created: true };
          break;
        case 'layerToggleVisible': {
          const params = command.params || {};
          this.api.layerToggleVisible((params.index as number) ?? 0);
          data = { toggled: params.index };
          break;
        }

        // ── 导出 ──
        case 'exportSTL': {
          const params = command.params || {};
          const result = this.api.exportSTL((params.filename as string) ?? 'export.stl');
          data = { result };
          break;
        }
        case 'exportOBJ': {
          const params = command.params || {};
          const result = this.api.exportOBJ((params.filename as string) ?? 'export.obj');
          data = { result };
          break;
        }
        case 'saveProjectJson': {
          const params = command.params || {};
          const result = this.api.saveProjectJson((params.filename as string) ?? 'project.json');
          data = { result };
          break;
        }

        // ── 上帝模式命令 ──
        case 'setCamera': {
          const params = command.params || {};
          this.api.setCamera(
            (params.position as { x: number; y: number; z: number }) ?? { x: 5, y: 4, z: 5 },
            (params.target as { x: number; y: number; z: number }) ?? { x: 0, y: 0, z: 0 }
          );
          data = { cameraSet: true };
          break;
        }
        case 'getSceneState': {
          data = this.api.getSceneState();
          break;
        }
        case 'setMaterialParams': {
          const params = command.params || {};
          this.api.setMaterialParams(
            (params.color as { r: number; g: number; b: number }) ?? { r: 0.8, g: 0.8, b: 0.8 },
            (params.roughness as number) ?? 0.6,
            (params.metalness as number) ?? 0.1
          );
          data = { materialSet: true };
          break;
        }
        case 'getScreenshot': {
          data = { screenshot: this.api.getScreenshot() };
          break;
        }
        case 'clearScene':
          this.api.clearScene();
          data = { cleared: true };
          break;
        case 'undo':
          this.api.undo();
          data = { undone: true };
          break;
        case 'redo':
          this.api.redo();
          data = { redone: true };
          break;
        case 'setBrushConfig': {
          const params = command.params || {};
          this.api.setBrushConfig(params as Record<string, unknown> as never);
          data = { configSet: true };
          break;
        }
        case 'layerDuplicate': {
          const params = command.params || {};
          this.api.layerDuplicate((params.index as number) ?? 0);
          data = { duplicated: params.index };
          break;
        }
        case 'layerDelete': {
          const params = command.params || {};
          this.api.layerDelete((params.index as number) ?? 0);
          data = { deleted: params.index };
          break;
        }
        case 'layerSetActive': {
          const params = command.params || {};
          this.api.layerSetActive((params.index as number) ?? 0);
          data = { active: params.index };
          break;
        }
        case 'subdivide': {
          const params = command.params || {};
          this.api.subdivide((params.levels as number) ?? 1);
          data = { subdivided: params.levels };
          break;
        }
        case 'getVertexCount': {
          data = { vertexCount: this.api.getVertexCount() };
          break;
        }
        case 'pickVertexColor': {
          const params = command.params || {};
          const result = this.api.pickVertexColor(
            (params.point as { x: number; y: number }) ?? { x: 0, y: 0 }
          );
          data = { color: result };
          break;
        }
        case 'setVertexColor': {
          const params = command.params || {};
          this.api.setVertexColor(
            (params.points as Array<{ x: number; y: number; z: number }>) ?? [],
            (params.color as { r: number; g: number; b: number }) ?? { r: 1, g: 0, b: 0 },
            (params.radius as number) ?? 0.2
          );
          data = { colored: true };
          break;
        }
        case 'loadProjectJson': {
          const params = command.params || {};
          const result = await this.api.loadProjectJson((params.json as string) ?? '{}');
          data = { loaded: result };
          break;
        }
        case 'getDiagnostics': {
          data = this.api.getDiagnostics();
          break;
        }

        default:
          throw new Error(`Unknown command action: ${command.action}`);
      }

      const result: CommandResult = {
        success: true,
        action: command.action,
        data,
        timestamp,
      };
      this.recordResult(result);
      return result;

    } catch (e) {
      const result: CommandResult = {
        success: false,
        action: command.action,
        error: (e as Error).message,
        timestamp,
      };
      this.recordResult(result);
      this.log(`[CommandParser] Command failed: ${command.action} - ${(e as Error).message}`);
      return result;
    }
  }

  async executeBatch(batch: CommandBatch): Promise<CommandResult[]> {
    const results: CommandResult[] = [];
    for (const cmd of batch) {
      const result = await this.execute(cmd);
      results.push(result);
      if (!result.success) {
        this.log(`[CommandParser] Batch stopped at failed command: ${cmd.action}`);
        break;
      }
    }
    return results;
  }

  async executeScript(script: CommandScript): Promise<CommandResult[]> {
    const allResults: CommandResult[] = [];
    const delay = script.delayMs ?? 0;

    const runOnce = async (): Promise<void> => {
      for (const cmd of script.commands) {
        const result = await this.execute(cmd);
        allResults.push(result);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    };

    await runOnce();

    if (script.loop) {
      while (true) {
        await runOnce();
      }
    }

    return allResults;
  }

  async executeJson(jsonString: string): Promise<CommandResult | CommandResult[] | null> {
    const parsed = this.parse(jsonString);
    if (!parsed) return null;

    if (Array.isArray(parsed)) {
      return this.executeBatch(parsed);
    }

    if ('commands' in parsed && Array.isArray((parsed as CommandScript).commands)) {
      return this.executeScript(parsed as CommandScript);
    }

    return this.execute(parsed as AICommand);
  }

  getResults(): CommandResult[] {
    return [...this.results];
  }

  getLastResult(): CommandResult | null {
    return this.results.length > 0 ? this.results[this.results.length - 1] : null;
  }

  clearResults(): void {
    this.results = [];
  }

  setLogEnabled(enabled: boolean): void {
    this.logEnabled = enabled;
  }

  private recordResult(result: CommandResult): void {
    this.results.push(result);
    if (this.results.length > this.maxResults) {
      this.results.shift();
    }
  }

  private log(message: string): void {
    if (this.logEnabled) {
      console.log(message);
    }
  }

  getSupportedCommands(): CommandType[] {
    return [
      'createSphere', 'createBox', 'createTorus',
      'setBrushType', 'setBrushParam',
      'simulateStroke',
      'maskDraw', 'maskClear', 'maskInvert',
      'layerNew', 'layerToggleVisible',
      'exportSTL', 'exportOBJ', 'saveProjectJson',
      'setCamera', 'getSceneState',
      'setMaterialParams', 'getScreenshot',
      'clearScene', 'undo', 'redo',
      'setBrushConfig', 'layerDuplicate', 'layerDelete', 'layerSetActive',
      'subdivide', 'getVertexCount',
      'pickVertexColor', 'setVertexColor',
      'loadProjectJson', 'getDiagnostics',
    ];
  }

  generateHelp(): string {
    const commands = this.getSupportedCommands();
    let help = 'Available commands:\n';
    for (const cmd of commands) {
      help += `  - ${cmd}\n`;
    }
    help += '\nUsage: {"action": "createSphere", "params": {"radius": 1, "subdiv": 5}}\n';
    help += 'Batch: [{"action": "createSphere", ...}, {"action": "setBrushType", ...}]\n';
    help += 'Script: {"name": "myScript", "commands": [...], "delayMs": 100}';
    return help;
  }
}
