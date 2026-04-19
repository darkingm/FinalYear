'use client';

export type LightSpaceLensConfig = {
  enabled: true;
  mode: 'interstitial-sheet';
  alwaysOn: true;
  opacity: number;
  width: number;
  height: number;
  segmentsX: number;
  segmentsY: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  falloff: number;
  centerBias: number;
};

export function getLightSpaceLensConfig(): LightSpaceLensConfig {
  return {
    enabled: true,
    mode: 'interstitial-sheet',
    alwaysOn: true,
    opacity: 0.115,
    width: 9.2,
    height: 4.8,
    segmentsX: 36,
    segmentsY: 20,
    positionY: -0.42,
    positionZ: -2.25,
    rotationX: -1.06,
    falloff: 0.72,
    centerBias: 0.18,
  };
}
