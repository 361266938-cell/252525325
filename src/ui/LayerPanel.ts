// ============================================================================
// LayerPanel.ts — 图层管理面板 (新建/隐藏/复制)
// ============================================================================

import { NOMAD_THEME } from '../types';
import type { SculptLayer } from '../types';

export class LayerPanel {
  private container: HTMLElement;
  private root: HTMLElement;
  private layerList: HTMLElement;
  private layers: SculptLayer[] = [];
  private activeIndex: number = 0;

  private onLayerNew: (() => void) | null = null;
  private onLayerToggleVisible: ((index: number) => void) | null = null;
  private onLayerDuplicate: ((index: number) => void) | null = null;
  private onLayerDelete: ((index: number) => void) | null = null;
  private onLayerSelect: ((index: number) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.root = document.createElement('div');
    this.root.className = 'mn-layer-panel';
    this.root.style.cssText = `
      position: fixed;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      width: 180px;
      max-height: 400px;
      display: flex;
      flex-direction: column;
      background: ${NOMAD_THEME.panelColor};
      border-radius: 12px;
      z-index: 99;
      box-shadow: 0 2px 12px rgba(0,0,0,0.5);
      overflow: hidden;
    `;

    this.buildHeader();
    this.layerList = document.createElement('div');
    this.layerList.className = 'mn-layer-list';
    this.layerList.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 4px;
    `;
    this.root.appendChild(this.layerList);

    this.container.appendChild(this.root);
  }

  private buildHeader(): void {
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid ${NOMAD_THEME.borderColor};
    `;

    const title = document.createElement('span');
    title.textContent = 'Layers';
    title.style.cssText = `
      font-size: 13px;
      color: ${NOMAD_THEME.textColor};
      font-weight: bold;
    `;
    header.appendChild(title);

    const addBtn = document.createElement('button');
    addBtn.textContent = '+';
    addBtn.style.cssText = `
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 6px;
      background: ${NOMAD_THEME.accentColor};
      color: white;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    addBtn.addEventListener('click', () => {
      if (this.onLayerNew) this.onLayerNew();
    });
    header.appendChild(addBtn);

    this.root.appendChild(header);
  }

  updateLayers(layers: SculptLayer[], activeIndex: number): void {
    this.layers = layers;
    this.activeIndex = activeIndex;
    this.renderLayerList();
  }

  private renderLayerList(): void {
    this.layerList.innerHTML = '';

    for (const layer of this.layers) {
      const item = this.createLayerItem(layer);
      this.layerList.appendChild(item);
    }
  }

  private createLayerItem(layer: SculptLayer): HTMLElement {
    const item = document.createElement('div');
    item.className = 'mn-layer-item';
    item.dataset.index = String(layer.index);
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-radius: 6px;
      cursor: pointer;
      margin-bottom: 2px;
      background: ${layer.index === this.activeIndex ? NOMAD_THEME.borderColor : 'transparent'};
    `;

    const visBtn = document.createElement('button');
    visBtn.textContent = layer.visible ? 'eye' : 'eye-off';
    visBtn.style.cssText = `
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 4px;
      background: ${NOMAD_THEME.buttonColor};
      color: ${layer.visible ? NOMAD_THEME.accentColor : NOMAD_THEME.subtextColor};
      font-size: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    visBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onLayerToggleVisible) this.onLayerToggleVisible(layer.index);
    });
    item.appendChild(visBtn);

    const nameEl = document.createElement('span');
    nameEl.textContent = layer.name;
    nameEl.style.cssText = `
      flex: 1;
      font-size: 12px;
      color: ${layer.visible ? NOMAD_THEME.textColor : NOMAD_THEME.subtextColor};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    item.appendChild(nameEl);

    const dupBtn = document.createElement('button');
    dupBtn.textContent = 'copy';
    dupBtn.style.cssText = `
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 4px;
      background: ${NOMAD_THEME.buttonColor};
      color: ${NOMAD_THEME.subtextColor};
      font-size: 9px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    dupBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onLayerDuplicate) this.onLayerDuplicate(layer.index);
    });
    item.appendChild(dupBtn);

    if (this.layers.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.textContent = 'del';
      delBtn.style.cssText = `
        width: 24px;
        height: 24px;
        border: none;
        border-radius: 4px;
        background: ${NOMAD_THEME.buttonColor};
        color: #ff5555;
        font-size: 9px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onLayerDelete) this.onLayerDelete(layer.index);
      });
      item.appendChild(delBtn);
    }

    item.addEventListener('click', () => {
      if (this.onLayerSelect) this.onLayerSelect(layer.index);
    });

    return item;
  }

  setHandlers(handlers: {
    onLayerNew?: () => void;
    onLayerToggleVisible?: (index: number) => void;
    onLayerDuplicate?: (index: number) => void;
    onLayerDelete?: (index: number) => void;
    onLayerSelect?: (index: number) => void;
  }): void {
    this.onLayerNew = handlers.onLayerNew || null;
    this.onLayerToggleVisible = handlers.onLayerToggleVisible || null;
    this.onLayerDuplicate = handlers.onLayerDuplicate || null;
    this.onLayerDelete = handlers.onLayerDelete || null;
    this.onLayerSelect = handlers.onLayerSelect || null;
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  toggle(): void {
    const current = this.root.style.display;
    this.root.style.display = current === 'none' ? 'flex' : 'none';
  }

  dispose(): void {
    this.container.removeChild(this.root);
  }
}
