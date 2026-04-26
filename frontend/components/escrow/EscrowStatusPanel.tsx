'use client';

/**
 * EscrowStatusPanel — read on-chain truth for an order and display it
 * side-by-side with the database record. Highlights any discrepancy that
 * users / admins should be aware of.
 *
 * The panel is purely read-only and is safe to embed on order detail pages,
 * the wallet "Trạng thái Escrow" tab, and admin views.
 */

import { useMemo } from 'react';
import { formatUnits, type Address } from 'viem';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Sparkles,
  TimerReset,
  XCircle,
} from 'lucide-react';
import { useEscrowOrder, type OnchainEscrowOrder } from '@/lib/web3/useEscrowOrder';
import {
  useEscrowEvents,
  type EscrowEventEntry,
  type EscrowEventName,
} from '@/lib/web3/useEscrowEvents';
import { CHAIN_META } from '@/lib/web3/config';
import { ZERO_ADDRESS } from '@/lib/web3/contracts';

interface DbOrderInfo {
  /** Status from DB orders table (English token: pending/paid/shipped/etc.) */
  status: string;
  /** Optional payment-side status (paid/confirming/refunded/...) */
  paymentStatus?: string | null;
  /** Buyer wallet on the order */
  buyerWallet?: string | null;
  /** Seller payout wallet on the order */
  sellerWallet?: string | null;
  /** Token contract address (zero address = native coin). */
  tokenAddress?: string | null;
  /** Token symbol for display */
  tokenSymbol?: string | null;
  /** Token decimals for amount formatting (ERC-20 typically 6 or 18). */
  tokenDecimals?: number | null;
  /** Amount expected in smallest unit (wei / token base units). */
  amountWei?: string | bigint | null;
}

interface EscrowStatusPanelProps {
  /** Off-chain string id used to derive the bytes32 contract key. */
  internalOrderId: string;
  /** Chain on which the escrow lives. */
  chainId: number;
  /** Database snapshot for side-by-side comparison. */
  db: DbOrderInfo;
  /** Optional className override. */
  className?: string;
}

export function EscrowStatusPanel({
  internalOrderId,
  chainId,
  db,
  className = '',
}: EscrowStatusPanelProps) {
  const order = useEscrowOrder({ internalOrderId, chainId });
  const events = useEscrowEvents({ internalOrderId, chainId });

  const explorer = CHAIN_META[chainId]?.explorer || '';

  if (order.unsupportedChain) {
    return (
      <Section className={className} title="Trạng thái Escrow on-chain">
        <Empty
          icon={<AlertTriangle className="w-5 h-5" />}
          title="Chain chưa hỗ trợ Escrow"
          description={`Chưa có hợp đồng EscrowCore deploy trên chain ${chainId}. Không có dữ liệu on-chain để hiển thị.`}
        />
      </Section>
    );
  }

  if (!order.contractAddress) {
    return (
      <Section className={className} title="Trạng thái Escrow on-chain">
        <Empty
          icon={<AlertTriangle className="w-5 h-5" />}
          title="Thiếu địa chỉ contract"
          description="Cấu hình ESCROW_CONTRACTS chưa có địa chỉ cho chain này."
        />
      </Section>
    );
  }

  if (order.isLoading) {
    return (
      <Section className={className} title="Trạng thái Escrow on-chain">
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Đang đọc dữ liệu on-chain…
        </div>
      </Section>
    );
  }

  if (order.error) {
    return (
      <Section className={className} title="Trạng thái Escrow on-chain">
        <Empty
          icon={<XCircle className="w-5 h-5 text-red-400" />}
          title="Không đọc được on-chain"
          description={order.error.message || 'RPC error'}
        />
      </Section>
    );
  }

  const oc = order.data;
  const isEmpty = !oc || oc.isEmpty;

  return (
    <Section
      className={className}
      title="Trạng thái Escrow on-chain"
      action={
        <a
          href={
            explorer
              ? `${explorer}/address/${order.contractAddress}`
              : `#`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {shortAddr(order.contractAddress)}
          {explorer && <ExternalLink className="w-3 h-3" />}
        </a>
      }
    >
      {isEmpty ? (
        <Empty
          icon={<TimerReset className="w-5 h-5 text-amber-400" />}
          title="Chưa có dữ liệu trên blockchain"
          description="Đơn hàng chưa được nạp vào hợp đồng EscrowCore. Sau khi buyer ký giao dịch deposit, panel này sẽ hiện số liệu real-time."
        />
      ) : (
        <ComparisonGrid db={db} oc={oc!} chainId={chainId} />
      )}

      <EventTimeline events={events.events} chainId={chainId} />
    </Section>
  );
}

/* ─── Comparison grid ─────────────────────────────────────────────────── */

function ComparisonGrid({
  db,
  oc,
  chainId,
}: {
  db: DbOrderInfo;
  oc: OnchainEscrowOrder;
  chainId: number;
}) {
  const explorer = CHAIN_META[chainId]?.explorer || '';
  const dbAmount = useMemo(() => normaliseAmount(db.amountWei), [db.amountWei]);
  const decimals = db.tokenDecimals ?? 18;

  const buyerMismatch = !sameAddr(db.buyerWallet, oc.buyer);
  const sellerMismatch = !sameAddr(db.sellerWallet, oc.seller);
  const tokenMismatch = !sameAddr(db.tokenAddress, oc.token);
  const totalAmountOnchain = oc.amount + oc.fee;
  const amountMismatch = dbAmount !== null && dbAmount !== totalAmountOnchain;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
      <Column icon={<Database className="w-4 h-4" />} label="Database">
        <Field label="Trạng thái">
          <span className="font-bold text-foreground">{db.status}</span>
          {db.paymentStatus && (
            <span className="text-[10px] text-muted-foreground ml-2">
              payment: {db.paymentStatus}
            </span>
          )}
        </Field>
        <Field label="Buyer">{shortAddr(db.buyerWallet) || '—'}</Field>
        <Field label="Seller">{shortAddr(db.sellerWallet) || '—'}</Field>
        <Field label="Token">
          {db.tokenSymbol || '—'}{' '}
          <span className="text-muted-foreground">
            ({shortAddr(db.tokenAddress) || 'native?'})
          </span>
        </Field>
        <Field label="Số tiền">
          {dbAmount !== null ? formatUnits(dbAmount, decimals) : '—'}
        </Field>
      </Column>

      <Column icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />} label="On-chain">
        <Field label="Trạng thái">
          <StatusPill status={oc.status} />
        </Field>
        <Field label="Buyer" mismatch={buyerMismatch}>
          <AddrLink addr={oc.buyer} explorer={explorer} />
        </Field>
        <Field label="Seller" mismatch={sellerMismatch}>
          <AddrLink addr={oc.seller} explorer={explorer} />
        </Field>
        <Field label="Token" mismatch={tokenMismatch}>
          <AddrLink addr={oc.token} explorer={explorer} />
          {oc.token === ZERO_ADDRESS && (
            <span className="text-[10px] text-muted-foreground ml-2">native</span>
          )}
        </Field>
        <Field label="Số tiền + phí" mismatch={amountMismatch}>
          {formatUnits(oc.amount, decimals)} + {formatUnits(oc.fee, decimals)} phí
        </Field>
        <Field label="Tạo / Hết hạn">
          <span className="text-[10px] text-muted-foreground">
            {oc.createdAt.toLocaleString('vi-VN')} → {oc.expiresAt.toLocaleString('vi-VN')}
          </span>
        </Field>
      </Column>

      {(buyerMismatch || sellerMismatch || tokenMismatch || amountMismatch) && (
        <div className="md:col-span-2 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-300 flex-1">
            <p className="font-bold">Phát hiện sai lệch giữa DB và blockchain</p>
            <p className="text-amber-300/80 mt-0.5">
              Dữ liệu on-chain là nguồn tin cậy duy nhất. Vui lòng liên hệ
              support nếu các trường được đánh dấu không khớp với mong đợi.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Event timeline ──────────────────────────────────────────────────── */

const EVENT_LABEL: Record<EscrowEventName, string> = {
  OrderCreated: 'Đã tạo đơn (deposit)',
  OrderCompleted: 'Hoàn tất / đã release',
  OrderRefunded: 'Đã hoàn tiền',
  OrderExpired: 'Hết hạn (auto-refund)',
  OrderDisputed: 'Đã raise tranh chấp',
  DeliveryConfirmed: 'Buyer xác nhận đã nhận',
};

const EVENT_COLOR: Record<EscrowEventName, string> = {
  OrderCreated: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  OrderCompleted: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  OrderRefunded: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  OrderExpired: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  OrderDisputed: 'text-red-400 bg-red-500/10 border-red-500/30',
  DeliveryConfirmed: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
};

function EventTimeline({
  events,
  chainId,
}: {
  events: EscrowEventEntry[];
  chainId: number;
}) {
  const explorer = CHAIN_META[chainId]?.explorer || '';
  if (events.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Chưa có sự kiện on-chain nào trong session này. Khi có giao dịch mới,
        nó sẽ tự xuất hiện ở đây.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3 h-3" /> Sự kiện realtime
      </p>
      {events
        .slice()
        .reverse()
        .map((e) => (
          <div
            key={e.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${EVENT_COLOR[e.name]}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-bold">{EVENT_LABEL[e.name]}</span>
            <span className="text-muted-foreground ml-auto truncate font-mono">
              {e.txHash.slice(0, 10)}…{e.txHash.slice(-6)}
            </span>
            {explorer && (
              <a
                href={`${explorer}/tx/${e.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-current hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ))}
    </div>
  );
}

/* ─── Small atoms ─────────────────────────────────────────────────────── */

function Section({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#f0b90b]" /> {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Column({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background border border-border rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-muted-foreground">
        {icon} {label}
      </div>
      <div className="space-y-1.5 text-xs">{children}</div>
    </div>
  );
}

function Field({
  label,
  mismatch,
  children,
}: {
  label: string;
  mismatch?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${mismatch ? 'bg-amber-500/10 -mx-2 px-2 py-1 rounded' : ''}`}
    >
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex-shrink-0">
        {label}
        {mismatch && <span className="ml-1 text-amber-400">⚠</span>}
      </span>
      <span className="text-right font-mono break-all">{children}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, string> = {
    Pending: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    Paid: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    Completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    Refunded: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    Disputed: 'bg-red-500/15 text-red-300 border-red-500/30',
    Expired: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    Unknown: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full border ${palette[status] || palette.Unknown}`}>
      {status}
    </span>
  );
}

function AddrLink({ addr, explorer }: { addr: Address; explorer: string }) {
  if (addr === ZERO_ADDRESS) return <span className="text-muted-foreground">{shortAddr(addr)}</span>;
  if (!explorer) return <span>{shortAddr(addr)}</span>;
  return (
    <a
      href={`${explorer}/address/${addr}`}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:underline inline-flex items-center gap-1"
    >
      {shortAddr(addr)}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}

function Empty({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-3">{icon}</div>
      <p className="font-bold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-md">{description}</p>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function shortAddr(value: string | null | undefined): string {
  if (!value) return '';
  if (value.length < 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function sameAddr(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return !a && !b;
  return a.toLowerCase() === b.toLowerCase();
}

function normaliseAmount(value: string | bigint | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value;
  if (typeof value !== 'string') return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}
