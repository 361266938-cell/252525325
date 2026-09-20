// ============================================================================
// MaterialSystem.ts — 材质系统: PBR color/roughness/metalness
// ============================================================================

import {
  MeshStandardMaterial,
  Color,
  DoubleSide,
  FrontSide,
} from 'three';
import type { MaterialConfig, MaterialParams, SerializedMaterialConfig } from '../types';
import { DEFAULT_MATERIAL_CONFIG } from '../types';

export class MaterialSystem {
  private material: MeshStandardMaterial;
  private config: MaterialConfig;

  constructor() {
    this.config = {
      baseColor: new Color(0xcccccc),
      roughness: DEFAULT_MATERIAL_CONFIG.roughness,
      metalness: DEFAULT_MATERIAL_CONFIG.metalness,
      emissive: new Color(0x000000),
      emissiveIntensity: DEFAULT_MATERIAL_CONFIG.emissiveIntensity,
      flatShading: DEFAULT_MATERIAL_CONFIG.flatShading,
      vertexColors: DEFAULT_MATERIAL_CONFIG.vertexColors,
      doubleSided: DEFAULT_MATERIAL_CONFIG.doubleSided,
    };

    this.material = new MeshStandardMaterial({
      color: this.config.baseColor,
      roughness: this.config.roughness,
      metalness: this.config.metalness,
      emissive: this.config.emissive,
      emissiveIntensity: this.config.emissiveIntensity,
      flatShading: this.config.flatShading,
      vertexColors: this.config.vertexColors,
      side: this.config.doubleSided ? DoubleSide : FrontSide,
    });

    this.material.needsUpdate = true;
  }

  getMaterial(): MeshStandardMaterial {
    return this.material;
  }

  setColor(r: number, g: number, b: number): void {
    this.config.baseColor.setRGB(r, g, b);
    this.material.color.copy(this.config.baseColor);
  }

  setColorHex(hex: number): void {
    this.config.baseColor.setHex(hex);
    this.material.color.copy(this.config.baseColor);
  }

  setRoughness(roughness: number): void {
    this.config.roughness = Math.max(0, Math.min(1, roughness));
    this.material.roughness = this.config.roughness;
  }

  setMetalness(metalness: number): void {
    this.config.metalness = Math.max(0, Math.min(1, metalness));
    this.material.metalness = this.config.metalness;
  }

  setEmissive(r: number, g: number, b: number, intensity: number = 1): void {
    this.config.emissive.setRGB(r, g, b);
    this.config.emissiveIntensity = intensity;
    this.material.emissive.copy(this.config.emissive);
    this.material.emissiveIntensity = intensity;
  }

  setFlatShading(enabled: boolean): void {
    this.config.flatShading = enabled;
    this.material.flatShading = enabled;
    this.material.needsUpdate = true;
  }

  setVertexColors(enabled: boolean): void {
    this.config.vertexColors = enabled;
    this.material.vertexColors = enabled;
    this.material.needsUpdate = true;
  }

  setDoubleSided(enabled: boolean): void {
    this.config.doubleSided = enabled;
    this.material.side = enabled ? DoubleSide : FrontSide;
    this.material.needsUpdate = true;
  }

  setWireframe(enabled: boolean): void {
    this.material.wireframe = enabled;
  }

  getParams(): MaterialParams {
    return {
      color: this.config.baseColor.clone(),
      roughness: this.config.roughness,
      metalness: this.config.metalness,
      flatShading: this.config.flatShading,
      wireframe: this.material.wireframe,
      vertexColorsEnabled: this.config.vertexColors,
    };
  }

  getConfig(): MaterialConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<MaterialConfig>): void {
    if (config.baseColor) this.config.baseColor.copy(config.baseColor);
    if (config.roughness !== undefined) this.setRoughness(config.roughness);
    if (config.metalness !== undefined) this.setMetalness(config.metalness);
    if (config.emissive) this.config.emissive.copy(config.emissive);
    if (config.emissiveIntensity !== undefined) this.config.emissiveIntensity = config.emissiveIntensity;
    if (config.flatShading !== undefined) this.setFlatShading(config.flatShading);
    if (config.vertexColors !== undefined) this.setVertexColors(config.vertexColors);
    if (config.doubleSided !== undefined) this.setDoubleSided(config.doubleSided);
    this.applyConfig();
  }

  private applyConfig(): void {
    this.material.color.copy(this.config.baseColor);
    this.material.roughness = this.config.roughness;
    this.material.metalness = this.config.metalness;
    this.material.emissive.copy(this.config.emissive);
    this.material.emissiveIntensity = this.config.emissiveIntensity;
    this.material.flatShading = this.config.flatShading;
    this.material.vertexColors = this.config.vertexColors;
    this.material.side = this.config.doubleSided ? DoubleSide : FrontSide;
    this.material.needsUpdate = true;
  }

  getSerialized(): SerializedMaterialConfig {
    return {
      baseColor: { r: this.config.baseColor.r, g: this.config.baseColor.g, b: this.config.baseColor.b },
      roughness: this.config.roughness,
      metalness: this.config.metalness,
      flatShading: this.config.flatShading,
      vertexColors: this.config.vertexColors,
    };
  }

  loadSerialized(data: SerializedMaterialConfig): void {
    this.config.baseColor.setRGB(data.baseColor.r, data.baseColor.g, data.baseColor.b);
    this.config.roughness = data.roughness;
    this.config.metalness = data.metalness;
    this.config.flatShading = data.flatShading;
    this.config.vertexColors = data.vertexColors;
    this.applyConfig();
  }

  dispose(): void {
    this.material.dispose();
  }
}
