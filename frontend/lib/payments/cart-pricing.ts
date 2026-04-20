import type { CartItem } from '@/store/cart-store';
import { toNumericAmount } from '@/lib/orders/amount';

export interface CartOrderSnapshot {
  order_id: number;
  product_id?: number | null;
  quantity?: number | null;
  total_amount?: number | string | null;
}

export interface LockedCartPreviewItem extends CartItem {
  lockedUsdAmount: number;
  orderId: number | null;
}

function findOrderSnapshot(
  item: CartItem,
  snapshots: CartOrderSnapshot[],
  usedOrderIds: Set<number>,
  index: number,
) {
  const snapshotAtIndex = snapshots[index];
  if (snapshotAtIndex && !usedOrderIds.has(snapshotAtIndex.order_id)) {
    return snapshotAtIndex;
  }

  return snapshots.find((snapshot) => {
    if (usedOrderIds.has(snapshot.order_id)) {
      return false;
    }

    return Number(snapshot.product_id) === Number(item.product_id)
      && Number(snapshot.quantity) === Number(item.quantity);
  });
}

export function buildLockedCartPreviewItems(
  items: CartItem[],
  snapshots: CartOrderSnapshot[],
): LockedCartPreviewItem[] {
  const usedOrderIds = new Set<number>();

  return items.map((item, index) => {
    const snapshot = findOrderSnapshot(item, snapshots, usedOrderIds, index);
    const lockedUsdAmount = snapshot
      ? toNumericAmount(snapshot.total_amount)
      : item.base_price_usd * item.quantity;

    if (snapshot) {
      usedOrderIds.add(snapshot.order_id);
    }

    return {
      ...item,
      lockedUsdAmount,
      orderId: snapshot?.order_id ?? null,
    };
  });
}

export function getLockedCartTotalUsd(
  items: CartItem[],
  snapshots: CartOrderSnapshot[],
) {
  return buildLockedCartPreviewItems(items, snapshots)
    .reduce((sum, item) => sum + item.lockedUsdAmount, 0);
}
