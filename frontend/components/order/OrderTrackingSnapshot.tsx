'use client';

import { getOrderStatusMeta } from '@/lib/orders/presentation';

interface OrderTrackingSnapshotProps {
  status: string;
  className?: string;
}

export function OrderTrackingSnapshot({ status, className = '' }: OrderTrackingSnapshotProps) {
  const meta = getOrderStatusMeta(status);

  const items = [
    {
      label: 'Hiện tại',
      value: meta.summary,
      marker: '01',
      tone: 'text-cyan-300',
    },
    {
      label: 'Đang chờ',
      value: meta.waitingOn,
      marker: '02',
      tone: 'text-amber-300',
    },
    {
      label: 'Bước tiếp theo',
      value: meta.nextStep,
      marker: '03',
      tone: 'text-emerald-300',
    },
  ];

  return (
    <div className={['grid grid-cols-1 gap-3 md:grid-cols-3', className].filter(Boolean).join(' ')}>
      {items.map(({ label, value, marker, tone }) => (
        <div key={label} className="rounded-2xl border border-white/5 bg-black/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-[10px] font-black tracking-[0.18em] ${tone}`}>
              {marker}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">{label}</p>
          </div>
          <p className="text-sm font-semibold leading-relaxed text-gray-100">{value}</p>
        </div>
      ))}
    </div>
  );
}
