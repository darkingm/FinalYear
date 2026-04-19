import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { CoinImage } from '@/components/ui/CoinImage';

describe('CoinImage', () => {
  it('renders an image element for the USDT logo instead of falling back to text initials', () => {
    render(<CoinImage symbol="USDT" size={16} alt="USDT" />);

    expect(screen.getByAltText('USDT').tagName).toBe('IMG');
  });
});
