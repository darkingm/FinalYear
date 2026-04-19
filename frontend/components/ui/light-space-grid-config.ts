'use client';

export type LightSpaceGridConfig = {
  mode: 'cursor-webgl-space-grid';
  renderEngine: 'webgl';
  maxDpr: number;
  horizonRatio: number;
  gridPlaneDepth: number;
  gridWidth: number;
  gridHeight: number;
  gridSegmentsX: number;
  gridSegmentsY: number;
  gridMinorDensity: [number, number];
  gridMajorDensity: [number, number];
  displacementRadius: number;
  displacementStrength: number;
  cursorEase: number;
  idleDistanceThreshold: number;
};

export function getLightSpaceGridConfig(): LightSpaceGridConfig {
  return {
    mode: 'cursor-webgl-space-grid',
    renderEngine: 'webgl',
    maxDpr: 1.5,
    horizonRatio: 0.58,
    gridPlaneDepth: 1,
    gridWidth: 18,
    gridHeight: 14,
    gridSegmentsX: 96,
    gridSegmentsY: 64,
    gridMinorDensity: [28, 20],
    gridMajorDensity: [7, 5],
    displacementRadius: 0.17,
    displacementStrength: 0.52,
    cursorEase: 0.18,
    idleDistanceThreshold: 0.0025,
  };
}
