// ============================================================================
// Toolbar.ts — 右侧垂直工具栏 (笔刷/遮罩/图层/材质)
// ============================================================================

import type { BrushType, UIToolMode } from '../types';
import { NOMAD_THEME } from '../types';

interface ToolbarButton {
  id: string;
  label: string;
  icon: string;
  toolMode: UIToolMode;
  brushType?: BrushType;
}

const BRUSH_BUTTONS: ToolbarButton[] = [
  { id: 'brush-sculpt', label: 'Sculpt', icon: ' sculpt', toolMode: 'sculpt', brushType: 'sculpt' },
  { id: 'brush-smooth', label: 'Smooth', icon: 'smooth', toolMode: 'sculpt', brushType: 'smooth' },
  { id: 'brush-inflate', label: 'Inflate', icon: 'inflate', toolMode: 'sculpt', brushType: 'inflate' },
  { id: 'brush-pinch', label: 'Pinch', icon: 'pinch', toolMode: 'sculpt', brushType: 'pinch' },
  { id: 'brush-drag', label: 'Drag', icon: 'drag', toolMode: 'sculpt', brushType: 'drag' },
  { id: 'brush-scrape', label: 'Scrape', icon: 'scrape', toolMode: 'sculpt', brushType: 'scrape' },
];

const TOOL_BUTTONS: ToolbarButton[] = [
  { id: 'tool-brush', label: 'Brush', icon: 'brush', toolMode: 'sculpt' },
  { id: 'tool-mask', label: 'Mask', icon: 'mask', toolMode: 'mask' },
  { id: 'tool-layer', label: 'Layer', icon: 'layer', toolMode: 'layer' },
  { id: 'tool-material', label: 'Material', icon: 'material', toolMode: 'material' },
  { id: 'tool-color', label: 'Color', icon: 'color', toolMode: 'color' },
  { id: 'tool-transform', label: 'Transform', icon: 'transform', toolMode: 'transform' },
];

export class Toolbar {
  private container: HTMLElement;
  private root: HTMLElement;
  private buttons: Map<string, HTMLElement> = new Map();
  private activeToolMode: UIToolMode = 'sculpt';
  private activeBrushType: BrushType = 'sculpt';
  private brushSectionVisible: boolean = true;

  private onToolModeChange: ((mode: UIToolMode) => void) | null = null;
  private onBrushTypeChange: ((type: BrushType) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.root = document.createElement('div');
    this.root.className = 'mn-toolbar';
    this.root.style.cssText = `
      position: fixed;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: ${NOMAD_THEME.panelColor};
      border-radius: 12px;
      padding: 8px 4px;
      z-index: 100;
      box-shadow: 0 2px 12px rgba(0,0,0,0.5);
    `;

    this.buildToolButtons();
    this.buildSeparator();
    this.buildBrushButtons();
    this.buildSeparator();
    this.buildActionButtons();

    this.container.appendChild(this.root);
  }

  private buildToolButtons(): void {
    for (const btn of TOOL_BUTTONS) {
      const el = this.createButton(btn);
      this.buttons.set(btn.id, el);
      this.root.appendChild(el);
    }
  }

  private buildBrushButtons(): void {
    for (const btn of BRUSH_BUTTONS) {
      const el = this.createButton(btn);
      el.classList.add('mn-brush-btn');
      this.buttons.set(btn.id, el);
      this.root.appendChild(el);
    }
  }

  private buildSeparator(): void {
    const sep = document.createElement('div');
    sep.className = 'mn-toolbar-separator';
    sep.style.cssText = `
      height: 1px;
      background: ${NOMAD_THEME.borderColor};
      margin: 4px 8px;
    `;
    this.root.appendChild(sep);
  }

  private buildActionButtons(): void {
    const actions = [
      { id: 'action-undo', label: 'Undo', icon: 'undo' },
      { id: 'action-redo', label: 'Redo', icon: 'redo' },
      { id: 'action-clear', label: 'Clear', icon: 'clear' },
      { id: 'action-export', label: 'Export', icon: 'export' },
    ];

    for (const btn of actions) {
      const el = document.createElement('button');
      el.className = 'mn-toolbar-btn mn-action-btn';
      el.id = btn.id;
      el.title = btn.label;
      el.textContent = this.getIconChar(btn.icon);
      el.style.cssText = `
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 8px;
        background: ${NOMAD_THEME.buttonColor};
        color: ${NOMAD_THEME.textColor};
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
      `;
      el.addEventListener('mouseenter', () => {
        el.style.background = NOMAD_THEME.borderColor;
      });
      el.addEventListener('mouseleave', () => {
        if (!el.classList.contains('mn-active')) {
          el.style.background = NOMAD_THEME.buttonColor;
        }
      });
      el.addEventListener('click', () => {
        this.handleAction(btn.id);
      });
      this.buttons.set(btn.id, el);
      this.root.appendChild(el);
    }
  }

  private createButton(btn: ToolbarButton): HTMLElement {
    const el = document.createElement('button');
    el.className = 'mn-toolbar-btn';
    el.id = btn.id;
    el.title = btn.label;
    el.textContent = this.getIconChar(btn.icon);
    el.style.cssText = `
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 8px;
      background: ${NOMAD_THEME.buttonColor};
      color: ${NOMAD_THEME.textColor};
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    `;

    el.addEventListener('mouseenter', () => {
      el.style.background = NOMAD_THEME.borderColor;
    });
    el.addEventListener('mouseleave', () => {
      if (!el.classList.contains('mn-active')) {
        el.style.background = NOMAD_THEME.buttonColor;
      }
    });

    if (btn.toolMode === 'sculpt' && btn.brushType) {
      el.addEventListener('click', () => {
        this.setActiveBrushType(btn.brushType!);
        this.setActiveToolMode('sculpt');
        if (this.onBrushTypeChange) this.onBrushTypeChange(btn.brushType!);
        if (this.onToolModeChange) this.onToolModeChange('sculpt');
      });
    } else {
      el.addEventListener('click', () => {
        this.setActiveToolMode(btn.toolMode);
        if (this.onToolModeChange) this.onToolModeChange(btn.toolMode);
      });
    }

    if (btn.id === 'tool-brush' || btn.id === 'brush-sculpt') {
      el.classList.add('mn-active');
      el.style.background = NOMAD_THEME.buttonActiveColor;
    }

    return el;
  }

  private getIconChar(icon: string): string {
    const iconMap: Record<string, string> = {
      brush: 'B',
      mask: 'M',
      layer: 'L',
      material: 'm',
      color: 'C',
      transform: 'T',
      sculpt: 'S',
      smooth: '~',
      inflate: '+',
      pinch: '<',
      drag: 'D',
      scrape: 'X',
      undo: 'U',
      redo: 'R',
      clear: 'clr',
      export: 'E',
    };
    return iconMap[icon] || '?';
  }

  private handleAction(actionId: string): void {
    const event = new CustomEvent('mn-toolbar-action', {
      detail: { action: actionId },
    });
    this.container.dispatchEvent(event);
  }

  setActiveToolMode(mode: UIToolMode): void {
    this.activeToolMode = mode;
    for (const [id, el] of this.buttons) {
      if (id.startsWith('tool-')) {
        const btnDef = TOOL_BUTTONS.find((b) => b.id === id);
        if (btnDef && btnDef.toolMode === mode) {
          el.classList.add('mn-active');
          el.style.background = NOMAD_THEME.buttonActiveColor;
        } else {
          el.classList.remove('mn-active');
          el.style.background = NOMAD_THEME.buttonColor;
        }
      }
    }
  }

  setActiveBrushType(type: BrushType): void {
    this.activeBrushType = type;
    for (const [id, el] of this.buttons) {
      if (id.startsWith('brush-')) {
        const btnDef = BRUSH_BUTTONS.find((b) => b.id === id);
        if (btnDef && btnDef.brushType === type) {
          el.classList.add('mn-active');
          el.style.background = NOMAD_THEME.buttonActiveColor;
        } else {
          el.classList.remove('mn-active');
          el.style.background = NOMAD_THEME.buttonColor;
        }
      }
    }
  }

  setBrushSectionVisible(visible: boolean): void {
    this.brushSectionVisible = visible;
    for (const [id, el] of this.buttons) {
      if (id.startsWith('brush-')) {
        el.style.display = visible ? 'flex' : 'none';
      }
    }
  }

  getActiveToolMode(): UIToolMode {
    return this.activeToolMode;
  }

  getActiveBrushType(): BrushType {
    return this.activeBrushType;
  }

  setHandlers(handlers: {
    onToolModeChange?: (mode: UIToolMode) => void;
    onBrushTypeChange?: (type: BrushType) => void;
  }): void {
    this.onToolModeChange = handlers.onToolModeChange || null;
    this.onBrushTypeChange = handlers.onBrushTypeChange || null;
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  dispose(): void {
    this.container.removeChild(this.root);
    this.buttons.clear();
  }
}
