import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react';
import { getSinkFieldConfig, LightWarpBackground } from '@/components/ui/LightWarpBackground';

describe('LightWarpBackground', () => {
  it('renders the light-mode WebGL space grid canvas marker', () => {
    const { container } = render(<LightWarpBackground />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas?.getAttribute('data-warp-mode')).toBe('cursor-webgl-space-grid');
  });

  it('reports the WebGL space-grid configuration', () => {
    const config = getSinkFieldConfig();

    expect(config.renderEngine).toBe('webgl');
    expect(config.gridLayerEnabled).toBe(true);
    expect(config.gridAnchoredToViewport).toBe(true);
    expect(config.gridAlwaysVisible).toBe(true);
    expect(config.boundaryVisible).toBe(false);
    expect(config.gridCoverage).toBe('full-screen');
    expect(config.gridPerspectiveMode).toBe('plane');
    expect(config.gridUsesStaticCache).toBe(false);
    expect(config.gridWarpRenderMode).toBe('mesh-displacement');
  });

  it('reports the interstitial space lens metadata', () => {
    const config = getSinkFieldConfig();
    expect(config.spaceLensEnabled).toBe(true);
    expect(config.spaceLensMode).toBe('interstitial-sheet');
    expect(config.spaceLensAlwaysOn).toBe(true);
  });

  it('reports the planet anchor well metadata', () => {
    const config = getSinkFieldConfig();
    expect(config.planetAnchorWellEnabled).toBe(true);
    expect(config.planetAnchorWellAlwaysOn).toBe(true);
  });
});
