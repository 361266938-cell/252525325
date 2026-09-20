// ============================================================================
// UndoRedoSystem.ts — 撤销重做: 命令历史栈
// ============================================================================

import type { UndoCommand, UndoRedoState } from '../types';
import { MAX_UNDO_STACK } from '../types';

export class UndoRedoSystem {
  private state: UndoRedoState = {
    undoStack: [],
    redoStack: [],
    maxStackSize: MAX_UNDO_STACK,
    isExecuting: false,
  };

  private onUndoCallbacks: Array<() => void> = [];
  private onRedoCallbacks: Array<() => void> = [];

  execute(command: UndoCommand): void {
    if (this.state.isExecuting) return;
    this.state.isExecuting = true;
    command.execute();
    this.state.undoStack.push(command);
    if (this.state.undoStack.length > this.state.maxStackSize) {
      this.state.undoStack.shift();
    }
    this.state.redoStack = [];
    this.state.isExecuting = false;
  }

  undo(): boolean {
    if (this.state.undoStack.length === 0) return false;
    this.state.isExecuting = true;
    const command = this.state.undoStack.pop()!;
    command.undo();
    this.state.redoStack.push(command);
    this.state.isExecuting = false;
    this.onUndoCallbacks.forEach((cb) => cb());
    return true;
  }

  redo(): boolean {
    if (this.state.redoStack.length === 0) return false;
    this.state.isExecuting = true;
    const command = this.state.redoStack.pop()!;
    command.execute();
    this.state.undoStack.push(command);
    this.state.isExecuting = false;
    this.onRedoCallbacks.forEach((cb) => cb());
    return true;
  }

  canUndo(): boolean {
    return this.state.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.state.redoStack.length > 0;
  }

  getUndoCount(): number {
    return this.state.undoStack.length;
  }

  getRedoCount(): number {
    return this.state.redoStack.length;
  }

  getHistoryLength(): number {
    return this.state.undoStack.length + this.state.redoStack.length;
  }

  clear(): void {
    this.state.undoStack = [];
    this.state.redoStack = [];
  }

  onUndo(cb: () => void): void {
    this.onUndoCallbacks.push(cb);
  }

  onRedo(cb: () => void): void {
    this.onRedoCallbacks.push(cb);
  }

  offUndo(cb: () => void): void {
    this.onUndoCallbacks = this.onUndoCallbacks.filter((c) => c !== cb);
  }

  offRedo(cb: () => void): void {
    this.onRedoCallbacks = this.onRedoCallbacks.filter((c) => c !== cb);
  }

  getState(): UndoRedoState {
    return {
      undoStack: [...this.state.undoStack],
      redoStack: [...this.state.redoStack],
      maxStackSize: this.state.maxStackSize,
      isExecuting: this.state.isExecuting,
    };
  }

  setMaxStackSize(size: number): void {
    this.state.maxStackSize = size;
    while (this.state.undoStack.length > size) {
      this.state.undoStack.shift();
    }
  }

  createSnapshotCommand(
    description: string,
    executeFn: () => void,
    undoFn: () => void,
    data?: unknown
  ): UndoCommand {
    return {
      type: 'stroke',
      description,
      timestamp: Date.now(),
      execute: executeFn,
      undo: undoFn,
      data,
    };
  }

  createGeometrySnapshotCommand(
    description: string,
    geometry: { attributes: { position: { array: Float32Array; count: number } } },
    beforePositions: Float32Array,
    afterPositions: Float32Array
  ): UndoCommand {
    const before = new Float32Array(beforePositions);
    const after = new Float32Array(afterPositions);
    const posAttr = geometry.attributes.position;

    return {
      type: 'stroke',
      description,
      timestamp: Date.now(),
      execute: () => {
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < after.length && i < arr.length; i++) {
          arr[i] = after[i];
        }
        posAttr.needsUpdate = true;
      },
      undo: () => {
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < before.length && i < arr.length; i++) {
          arr[i] = before[i];
        }
        posAttr.needsUpdate = true;
      },
      data: { before, after },
    };
  }

  dispose(): void {
    this.clear();
    this.onUndoCallbacks = [];
    this.onRedoCallbacks = [];
  }
}
