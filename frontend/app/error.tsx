'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, Home, AlertTriangle, Zap } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] right-[15%] w-[350px] h-[350px] bg-red-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[15%] left-[10%] w-[300px] h-[300px] bg-[#8247e5]/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 text-center max-w-md">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2 mb-10 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <Zap className="w-5 h-5 text-black fill-black" />
          </div>
          <span className="font-bold text-xl text-foreground">
            Web3<span className="text-[#f0b90b]">Market</span>
          </span>
        </Link>

        {/* Error icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-3">
          Đã xảy ra lỗi
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-2">
          Trang gặp sự cố khi tải. Nguyên nhân có thể do mất kết nối mạng, phiên bản cũ được cache, hoặc lỗi hệ thống tạm thời.
        </p>

        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono mb-6">
            Mã lỗi: {error.digest}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-black bg-gradient-to-r from-[#f0b90b] to-[#e6a800] rounded-xl hover:shadow-lg hover:shadow-yellow-500/20 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-colors"
          >
            <Home className="w-4 h-4" />
            Về trang chủ
          </Link>
        </div>

        {/* Help text */}
        <p className="mt-8 text-xs text-muted-foreground/50">
          Nếu lỗi tiếp tục xảy ra, vui lòng thử xóa cache trình duyệt hoặc liên hệ support@web3market.com
        </p>
      </div>
    </div>
  );
}
