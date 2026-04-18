import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react';
import { LightWarpBackground } from '@/components/ui/LightWarpBackground';

describe('LightWarpBackground', () => {
  it('renders a canvas backdrop', () => {
    const { container } = render(<LightWarpBackground />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
