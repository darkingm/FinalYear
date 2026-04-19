import { describe, expect, it } from '@jest/globals';
import { getLightSpaceLensConfig } from '@/components/ui/light-space-lens-config';

describe('light-space-lens-config', () => {
  it('keeps the lens always on at low intensity', () => {
    const config = getLightSpaceLensConfig();
    expect(config.alwaysOn).toBe(true);
    expect(config.opacity).toBeLessThanOrEqual(0.2);
  });

  it('positions the lens between globe and grid', () => {
    const config = getLightSpaceLensConfig();
    expect(config.positionY).toBeLessThan(0);
    expect(config.positionZ).toBeLessThan(0);
  });
});
