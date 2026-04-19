import { getPrimaryProductImage } from '@/lib/products/images';
import { formatCrypto } from '@/lib/utils/format-price';
import { toNumericAmount } from '@/lib/orders/amount';

type RawImage =
  | string
  | { url?: string; image_url?: string; sort_order?: number; is_primary?: boolean };

interface OrderPresentationSource {
  primary_image?: string | null;
  token_symbol?: string | null;
  subtotal_token?: number | string | null;
  amount_token?: number | string | null;
  price_usd?: number | string | null;
  product_metadata?: {
    images?: RawImage[] | null;
  } | null;
}

interface ProductFallbackSource {
  primary_image?: string | null;
  images?: RawImage[] | null;
  product_metadata?: {
    images?: RawImage[] | null;
  } | null;
}

export interface OrderStatusMeta {
  label: string;
  summary: string;
  waitingOn: string;
  nextStep: string;
  escrowCopy: string;
}

export interface OrderVerificationContext {
  verificationState?: string | null;
  verificationMessage?: string | null;
  confirmations?: number | null;
  requiredConfirmations?: number | null;
}

export interface OrderPricingDisplay {
  mode: 'usd' | 'token';
  usdAmount: number;
  tokenSymbol: string | null;
  tokenAmount: number | null;
  tokenAmountLabel: string | null;
}

const ORDER_STATUS_META: Record<string, OrderStatusMeta> = {
  UNPAID: {
    label: 'Chờ thanh toán',
    summary: 'Đơn hàng đã được tạo nhưng chưa nạp tiền vào escrow.',
    waitingOn: 'Người mua',
    nextStep: 'Hoàn tất thanh toán để khóa tiền trong escrow.',
    escrowCopy: 'Escrow chưa giữ tiền. Hãy thanh toán để kích hoạt bảo vệ hợp đồng.',
  },
  TX_SUBMITTED: {
    label: 'Đang xác nhận giao dịch',
    summary: 'Giao dịch đã gửi lên blockchain và đang chờ block xác nhận.',
    waitingOn: 'Blockchain',
    nextStep: 'Chờ blockchain xác nhận để tiền được khóa trong escrow.',
    escrowCopy: 'Giao dịch đã gửi lên blockchain. Hệ thống đang chờ xác nhận on-chain.',
  },
  ONCHAIN_PENDING: {
    label: 'Đang xác nhận on-chain',
    summary: 'Hệ thống đang chờ blockchain hoàn tất xác nhận.',
    waitingOn: 'Blockchain',
    nextStep: 'Đợi đủ xác nhận để chuyển sang trạng thái đã thanh toán.',
    escrowCopy: 'Blockchain đang xác nhận giao dịch. Tiền sẽ sớm được ghi nhận trong escrow.',
  },
  ONCHAIN_CONFIRMED: {
    label: 'Đang khóa tiền trong escrow',
    summary: 'Thanh toán đã xác nhận on-chain và hệ thống đang đồng bộ escrow.',
    waitingOn: 'Hệ thống',
    nextStep: 'Đợi hệ thống cập nhật đơn hàng sang đã thanh toán.',
    escrowCopy: 'Thanh toán đã xác nhận on-chain. Hệ thống đang đồng bộ trạng thái escrow.',
  },
  PAYMENT_VALIDATED: {
    label: 'Đã thanh toán',
    summary: 'Tiền đã được xác nhận và khóa trong escrow.',
    waitingOn: 'Người bán',
    nextStep: 'Người bán chuẩn bị và gửi hàng.',
    escrowCopy: 'Tiền đã được khóa an toàn trong escrow, chờ người bán giao hàng.',
  },
  PAID: {
    label: 'Đã thanh toán',
    summary: 'Tiền đang được giữ trong escrow để bảo vệ giao dịch.',
    waitingOn: 'Người bán',
    nextStep: 'Người bán chuẩn bị và gửi hàng.',
    escrowCopy: 'Tiền đã được khóa an toàn trong escrow, chờ người bán giao hàng.',
  },
  PAID_PAYPAL: {
    label: 'Đã thanh toán',
    summary: 'Thanh toán PayPal đã hoàn tất và đơn hàng đang chờ người bán xử lý.',
    waitingOn: 'Người bán',
    nextStep: 'Người bán chuẩn bị và gửi hàng.',
    escrowCopy: 'Thanh toán đã hoàn tất. Đơn hàng đang chờ người bán xử lý.',
  },
  PROCESSING: {
    label: 'Đang xử lý',
    summary: 'Người bán đang chuẩn bị đơn hàng.',
    waitingOn: 'Người bán',
    nextStep: 'Người bán xác nhận giao hàng và cập nhật vận đơn.',
    escrowCopy: 'Tiền vẫn đang được giữ trong escrow trong lúc người bán xử lý đơn.',
  },
  SHIPPED: {
    label: 'Đang giao hàng',
    summary: 'Người bán đã gửi hàng và đơn đang trên đường giao.',
    waitingOn: 'Người mua',
    nextStep: 'Theo dõi vận đơn và xác nhận khi nhận hàng.',
    escrowCopy: 'Tiền vẫn bị khóa trong escrow cho đến khi người mua xác nhận nhận hàng.',
  },
  DELIVERED: {
    label: 'Đã giao hàng',
    summary: 'Người bán đã giao hàng thành công.',
    waitingOn: 'Người mua',
    nextStep: 'Xác nhận đã nhận hàng để giải ngân cho người bán.',
    escrowCopy: 'Tiền vẫn bị khóa trong escrow cho đến khi người mua xác nhận nhận hàng.',
  },
  COMPLETED: {
    label: 'Hoàn thành',
    summary: 'Đơn hàng đã hoàn tất và tiền đã giải ngân cho người bán.',
    waitingOn: 'Không ai',
    nextStep: 'Bạn có thể đánh giá sản phẩm hoặc lưu lại thông tin giao dịch.',
    escrowCopy: 'Escrow đã giải ngân thành công cho người bán.',
  },
  CANCELLED: {
    label: 'Đã hủy',
    summary: 'Đơn hàng đã bị hủy và không còn hiệu lực.',
    waitingOn: 'Không ai',
    nextStep: 'Tạo đơn hàng mới nếu bạn vẫn muốn mua sản phẩm này.',
    escrowCopy: 'Escrow không còn giữ tiền cho đơn hàng này.',
  },
  REFUNDED: {
    label: 'Đã hoàn tiền',
    summary: 'Khoản thanh toán đã được hoàn lại cho người mua.',
    waitingOn: 'Không ai',
    nextStep: 'Kiểm tra lại ví hoặc lịch sử giao dịch nếu cần đối soát.',
    escrowCopy: 'Escrow đã hoàn trả tiền về cho người mua.',
  },
  DISPUTED: {
    label: 'Đang khiếu nại',
    summary: 'Đơn hàng đang được admin xem xét.',
    waitingOn: 'Admin',
    nextStep: 'Bổ sung bằng chứng nếu admin yêu cầu thêm.',
    escrowCopy: 'Tiền đang bị đóng băng trong escrow chờ kết quả xử lý khiếu nại.',
  },
  TX_FAILED: {
    label: 'Thanh toán thất bại',
    summary: 'Giao dịch blockchain thất bại và tiền chưa bị trừ.',
    waitingOn: 'Người mua',
    nextStep: 'Thử lại thanh toán khi ví và mạng đã sẵn sàng.',
    escrowCopy: 'Giao dịch thất bại nên escrow chưa giữ tiền.',
  },
};

const DEFAULT_STATUS_META: OrderStatusMeta = {
  label: 'Đang xử lý',
  summary: 'Đơn hàng đang được hệ thống cập nhật.',
  waitingOn: 'Hệ thống',
  nextStep: 'Chờ trạng thái tiếp theo được đồng bộ.',
  escrowCopy: 'Hệ thống đang đồng bộ dữ liệu cho đơn hàng này.',
};

function normalizeSymbol(symbol: string | null | undefined): string | null {
  const normalized = String(symbol ?? '').trim().toUpperCase();
  return normalized ? normalized : null;
}

export function getOrderStatusMeta(
  status: string | null | undefined,
  verification?: OrderVerificationContext | null,
): OrderStatusMeta {
  const base = ORDER_STATUS_META[String(status ?? '').trim().toUpperCase()] ?? DEFAULT_STATUS_META;

  if (!verification) {
    return base;
  }

  const verificationState = String(verification.verificationState ?? '').trim().toLowerCase();
  const verificationMessage = String(verification.verificationMessage ?? '').trim();
  const confirmations = Number(verification.confirmations ?? 0);
  const requiredConfirmations = Number(verification.requiredConfirmations ?? 0);

  if (verificationState === 'retrying') {
    return {
      ...base,
      summary: requiredConfirmations > 0
        ? `Giao dịch đã gửi lên blockchain. Hệ thống đang thử kiểm tra lại xác nhận (${confirmations}/${requiredConfirmations} block).`
        : 'Giao dịch đã gửi lên blockchain. Hệ thống đang thử kiểm tra lại xác nhận.',
      waitingOn: 'RPC / blockchain',
      nextStep: 'Chờ hệ thống thử kiểm tra lại, hoặc dùng nút kiểm tra lại blockchain để làm mới trạng thái.',
      escrowCopy: verificationMessage || base.escrowCopy,
    };
  }

  if (verificationState === 'confirming') {
    return {
      ...base,
      summary: `Giao dịch đã có ${confirmations}/${requiredConfirmations} block xác nhận.`,
      waitingOn: 'Blockchain',
      nextStep: 'Đợi đủ xác nhận để hệ thống khóa tiền vào escrow.',
      escrowCopy: verificationMessage || base.escrowCopy,
    };
  }

  if (verificationMessage) {
    return {
      ...base,
      escrowCopy: verificationMessage,
    };
  }

  return base;
}

export function resolveOrderProductImage(
  order?: OrderPresentationSource | null,
  product?: ProductFallbackSource | null,
): string | null {
  const rawImages =
    order?.product_metadata?.images ??
    product?.images ??
    product?.product_metadata?.images ??
    null;

  const primaryImage = order?.primary_image ?? product?.primary_image ?? null;
  const resolved = getPrimaryProductImage(rawImages, primaryImage);
  return resolved === '/placeholder-product.svg' ? null : resolved;
}

export function getOrderPricingDisplay(order: OrderPresentationSource): OrderPricingDisplay {
  const tokenSymbol = normalizeSymbol(order.token_symbol);
  const subtotalToken = toNumericAmount(order.subtotal_token);
  const amountToken = toNumericAmount(order.amount_token);
  const usdAmount = toNumericAmount(order.price_usd);

  if (tokenSymbol && (subtotalToken > 0 || amountToken > 0)) {
    const tokenAmount = subtotalToken > 0 ? subtotalToken : amountToken;
    return {
      mode: 'token',
      usdAmount,
      tokenSymbol,
      tokenAmount,
      tokenAmountLabel: formatCrypto(tokenAmount, tokenSymbol),
    };
  }

  return {
    mode: 'usd',
    usdAmount,
    tokenSymbol: tokenSymbol ?? null,
    tokenAmount: null,
    tokenAmountLabel: null,
  };
}
