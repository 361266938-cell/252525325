// ============================================================================
// TopMenu.ts — 顶部极简菜单 (导入/导出/设置)
// ============================================================================

import { NOMAD_THEME } from '../types';

export class TopMenu {
  private container: HTMLElement;
  private root: HTMLElement;
  private buttons: Map<string, HTMLElement> = new Map();

  constructor(container: HTMLElement) {
    this.container = container;
    this.root = document.createElement('div');
    this.root.className = 'mn-top-menu';
    this.root.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 44px;
      display: flex;
      align-items: center;
      padding: 0 8px;
      background: ${NOMAD_THEME.panelColor};
      z-index: 100;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    `;

    this.buildLogo();
    this.buildMenuButtons();
    this.buildSpacer();
    this.buildRightButtons();

    this.container.appendChild(this.root);
  }

  private buildLogo(): void {
    const logo = document.createElement('div');
    logo.textContent = 'MiniNomad';
    logo.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      color: ${NOMAD_THEME.accentColor};
      margin-right: 16px;
      white-space: nowrap;
    `;
    this.root.appendChild(logo);
  }

  private buildMenuButtons(): void {
    const menus = [
      { id: 'menu-file', label: 'File' },
      { id: 'menu-edit', label: 'Edit' },
      { id: 'menu-view', label: 'View' },
    ];

    for (const m of menus) {
      const btn = document.createElement('button');
      btn.className = 'mn-menu-btn';
      btn.textContent = m.label;
      btn.style.cssText = `
        background: none;
        border: none;
        color: ${NOMAD_THEME.textColor};
        font-size: 13px;
        padding: 6px 12px;
        cursor: pointer;
        border-radius: 4px;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = NOMAD_THEME.borderColor;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'none';
      });
      btn.addEventListener('click', () => {
        this.emitAction(m.id);
      });
      this.buttons.set(m.id, btn);
      this.root.appendChild(btn);
    }
  }

  private buildSpacer(): void {
    const spacer = document.createElement('div');
    spacer.style.cssText = `flex: 1;`;
    this.root.appendChild(spacer);
  }

  private buildRightButtons(): void {
    const rightBtns = [
      { id: 'top-import-stl', label: 'Import STL' },
      { id: 'top-import-obj', label: 'Import OBJ' },
      { id: 'top-export-stl', label: 'Export STL' },
      { id: 'top-export-obj', label: 'Export OBJ' },
      { id: 'top-save', label: 'Save' },
      { id: 'top-settings', label: 'Settings' },
    ];

    for (const rb of rightBtns) {
      const btn = document.createElement('button');
      btn.className = 'mn-top-action-btn';
      btn.textContent = rb.label;
      btn.style.cssText = `
        background: ${NOMAD_THEME.buttonColor};
        border: none;
        color: ${NOMAD_THEME.textColor};
        font-size: 12px;
        padding: 6px 10px;
        cursor: pointer;
        border-radius: 6px;
        margin-left: 4px;
        white-space: nowrap;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = NOMAD_THEME.borderColor;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = NOMAD_THEME.buttonColor;
      });
      btn.addEventListener('click', () => {
        this.emitAction(rb.id);
      });
      this.buttons.set(rb.id, btn);
      this.root.appendChild(btn);
    }
  }

  private emitAction(action: string): void {
    const event = new CustomEvent('mn-top-menu-action', {
      detail: { action },
    });
    this.container.dispatchEvent(event);
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
