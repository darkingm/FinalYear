import { describe, expect, it } from '@jest/globals';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductGalleryViewer } from '@/components/product/ProductGalleryViewer';

const mockImages = [
  { url: 'https://cdn.example.com/camera-1.jpg', sort_order: 0, is_primary: true },
  { url: 'https://cdn.example.com/camera-2.jpg', sort_order: 1, is_primary: false },
];

describe('ProductGalleryViewer', () => {
  it('opens the lightbox and navigates next images', async () => {
    const user = userEvent.setup();
    render(<ProductGalleryViewer images={mockImages} productName="Camera" />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /phóng to ảnh hiện tại/i }));
    });
    const lightbox = await screen.findByRole('dialog');
    await act(async () => {
      await user.click(within(lightbox).getByRole('button', { name: /xem ảnh tiếp theo/i }));
    });
    expect(await within(lightbox).findByAltText(/camera - ảnh 2/i)).toBeTruthy();
  });

  it('shows a placeholder state when no product image rows exist', () => {
    render(<ProductGalleryViewer images={[]} productName="No image product" />);
    expect(screen.getByText(/chưa có ảnh/i)).toBeTruthy();
  });
});
