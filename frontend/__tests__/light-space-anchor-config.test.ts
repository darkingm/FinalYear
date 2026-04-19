import { describe, expect, it } from '@jest/globals';
import { getLightSpaceAnchorConfig } from '@/components/ui/light-space-anchor-config';

describe('light-space-anchor-config', () => {
  it('keeps the anchor well always on with low-to-medium strength', () => {
    const config = getLightSpaceAnchorConfig();
    expect(config.alwaysOn).toBe(true);
    expect(config.strength).toBeGreaterThan(0);
    expect(config.strength).toBeLessThan(0.5);
  });

  it('uses a broader radius than the cursor well', () => {
    const config = getLightSpaceAnchorConfig();
    expect(config.radius).toBeGreaterThan(0.2);
  });
});
