'use client';

import { LightSpaceGridScene } from '@/components/ui/LightSpaceGridScene';
import { getLightSpaceAnchorConfig } from '@/components/ui/light-space-anchor-config';
import { getLightSpaceGridConfig } from '@/components/ui/light-space-grid-config';
import { getLightSpaceLensConfig } from '@/components/ui/light-space-lens-config';

export function getSinkFieldConfig() {
  const anchorConfig = getLightSpaceAnchorConfig();
  const config = getLightSpaceGridConfig();
  const lensConfig = getLightSpaceLensConfig();

  return {
    sinkRadius: 0,
    auraRadius: 0,
    gridLayerEnabled: true,
    gridCellSize: 0,
    gridWarpStrength: config.displacementStrength,
    gridAnchoredToViewport: true,
    gridAlwaysVisible: true,
    boundaryVisible: false,
    gridCoverage: 'full-screen' as const,
    gridPerspectiveMode: 'plane' as const,
    gridHorizonRatio: config.horizonRatio,
    gridUsesStaticCache: false,
    gridWarpRenderMode: 'mesh-displacement' as const,
    renderEngine: config.renderEngine,
    spaceLensEnabled: lensConfig.enabled,
    spaceLensMode: lensConfig.mode,
    spaceLensAlwaysOn: lensConfig.alwaysOn,
    planetAnchorWellEnabled: anchorConfig.enabled,
    planetAnchorWellAlwaysOn: anchorConfig.alwaysOn,
  };
}

export function LightWarpBackground() {
  return <LightSpaceGridScene dataWarpMode="cursor-webgl-space-grid" />;
}
