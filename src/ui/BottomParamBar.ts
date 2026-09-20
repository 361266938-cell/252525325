// ============================================================================
// BottomParamBar.ts — 底部笔刷参数调节条 (大小/强度/衰减)
// ============================================================================

import { NOMAD_THEME } from '../types';
import type { BrushParams } from '../types';

interface SliderConfig {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

const SLIDER_CONFIGS: SliderConfig[] = [
  { id: 'param-size', label: 'Size', min: 0.01, max: 5, step: 0.01, defaultValue: 0.5 },
  { id: 'param-strength', label: 'Strength', min: 0, max: 5, step: 0.01, defaultValue: 0.5 },
  { id: 'param-decay', label: 'Decay', min: 0, max: 3, step: 0.01, defaultValue: 0.3 },
];

export class BottomParamBar {
  private container: HTMLElement;
  private root: HTMLElement;
  private sliders: Map<string, HTMLInputElement> = new Map();
  private valueLabels: Map<string, HTMLElement> = new Map();
  private currentParams: BrushParams = { size: 0.5, strength: 0.5, decay: 0.3 };

  private onParamChange: ((params: BrushParams) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.root = document.createElement('div');
    this.root.className = 'mn-bottom-bar';
    this.root.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      background: ${NOMAD_THEME.panelColor};
      z-index: 100;
      box-shadow: 0 -1px 4px rgba(0,0,0,0.3);
      padding: 0 12px;
    `;

    for (const cfg of SLIDER_CONFIGS) {
      const sliderEl = this.createSlider(cfg);
      this.root.appendChild(sliderEl);
    }

    this.container.appendChild(this.root);
  }

  private createSlider(cfg: SliderConfig): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `mn-slider-wrapper mn-${cfg.id}`;
    wrapper.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      max-width: 200px;
    `;

    const label = document.createElement('label');
    label.textContent = cfg.label;
    label.style.cssText = `
      font-size: 11px;
      color: ${NOMAD_THEME.subtextColor};
      white-space: nowrap;
      min-width: 50px;
    `;
    wrapper.appendChild(label);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(cfg.min);
    slider.max = String(cfg.max);
    slider.step = String(cfg.step);
    slider.value = String(cfg.defaultValue);
    slider.style.cssText = `
      flex: 1;
      -webkit-appearance: none;
      appearance: none;
      height: 4px;
      border-radius: 2px;
      background: ${NOMAD_THEME.sliderTrackColor};
      outline: none;
      cursor: pointer;
    `;

    slider.style.setProperty('--slider-color', NOMAD_THEME.sliderColor);

    slider.addEventListener('input', () => {
      this.handleSliderChange(cfg.id, parseFloat(slider.value));
    });

    this.sliders.set(cfg.id, slider);
    wrapper.appendChild(slider);

    const valueLabel = document.createElement('span');
    valueLabel.textContent = cfg.defaultValue.toFixed(2);
    valueLabel.style.cssText = `
      font-size: 11px;
      color: ${NOMAD_THEME.textColor};
      min-width: 36px;
      text-align: right;
      font-family: monospace;
    `;
    this.valueLabels.set(cfg.id, valueLabel);
    wrapper.appendChild(valueLabel);

    return wrapper;
  }

  private handleSliderChange(id: string, value: number): void {
    const label = this.valueLabels.get(id);
    if (label) label.textContent = value.toFixed(2);

    if (id === 'param-size') this.currentParams.size = value;
    else if (id === 'param-strength') this.currentParams.strength = value;
    else if (id === 'param-decay') this.currentParams.decay = value;

    if (this.onParamChange) this.onParamChange({ ...this.currentParams });
  }

  setParams(params: BrushParams): void {
    this.currentParams = { ...params };

    const sizeSlider = this.sliders.get('param-size');
    if (sizeSlider) sizeSlider.value = String(params.size);
    const strengthSlider = this.sliders.get('param-strength');
    if (strengthSlider) strengthSlider.value = String(params.strength);
    const decaySlider = this.sliders.get('param-decay');
    if (decaySlider) decaySlider.value = String(params.decay);

    const sizeLabel = this.valueLabels.get('param-size');
    if (sizeLabel) sizeLabel.textContent = params.size.toFixed(2);
    const strengthLabel = this.valueLabels.get('param-strength');
    if (strengthLabel) strengthLabel.textContent = params.strength.toFixed(2);
    const decayLabel = this.valueLabels.get('param-decay');
    if (decayLabel) decayLabel.textContent = params.decay.toFixed(2);
  }

  getParams(): BrushParams {
    return { ...this.currentParams };
  }

  setHandler(onParamChange: (params: BrushParams) => void): void {
    this.onParamChange = onParamChange;
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  dispose(): void {
    this.container.removeChild(this.root);
    this.sliders.clear();
    this.valueLabels.clear();
  }
}
