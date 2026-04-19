import { describe, expect, it } from '@jest/globals';
import { getLightSpaceGridConfig } from '@/components/ui/light-space-grid-config';

describe('light-space-grid-config', () => {
  it('caps device pixel ratio for the WebGL scene', () => {
    expect(getLightSpaceGridConfig().maxDpr).toBeLessThanOrEqual(1.75);
  });

  it('uses a lower-half perspective floor layout', () => {
    const config = getLightSpaceGridConfig();
    expect(config.horizonRatio).toBeGreaterThan(0.45);
    expect(config.gridPlaneDepth).toBeGreaterThan(0);
  });
});
