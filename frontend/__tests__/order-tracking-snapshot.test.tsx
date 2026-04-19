import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { OrderTrackingSnapshot } from '@/components/order/OrderTrackingSnapshot';

describe('OrderTrackingSnapshot', () => {
  it('shows current state, waiting actor, and next step for the order status', () => {
    render(<OrderTrackingSnapshot status="SHIPPED" />);

    expect(screen.getByText('Hiện tại')).toBeTruthy();
    expect(screen.getByText('Đang chờ')).toBeTruthy();
    expect(screen.getByText('Bước tiếp theo')).toBeTruthy();
    expect(screen.getByText(/Người bán đã gửi hàng/i)).toBeTruthy();
    expect(screen.getByText('Người mua')).toBeTruthy();
  });
});
