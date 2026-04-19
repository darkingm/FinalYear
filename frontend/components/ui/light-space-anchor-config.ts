'use client';

export type LightSpaceAnchorConfig = {
  enabled: true;
  alwaysOn: true;
  uv: readonly [number, number];
  radius: number;
  strength: number;
  softness: number;
};

export function getLightSpaceAnchorConfig(): LightSpaceAnchorConfig {
  return {
    enabled: true,
    alwaysOn: true,
    uv: [0.5, 0.34] as const,
    radius: 0.29,
    strength: 0.16,
    softness: 1.55,
  };
}
