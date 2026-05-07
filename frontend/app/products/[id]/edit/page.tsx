'use client';

export const dynamic = 'force-dynamic';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductEditorForm } from '@/components/product/editor/ProductEditorForm';
import { useAuth } from '@/lib/hooks/useAuth';
import { buildLoginRedirectUrl } from '@/lib/auth/login-redirect';

/**
 * Seller-only edit page reached via the "Sản phẩm của tôi" cards on the
 * seller dashboard. The form component runs in `productId` mode — fetches
 * current values, lets the seller change name/price/tokens/images, and PUTs
 * the result back to /api/products/:id (which already enforces ownership).
 *
 * NOTE: this is intentionally NOT linked from the public /products/[id]
 * detail page. Editing belongs only inside the seller workflow.
 */
export default function ProductEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const productIdNum = Number(params?.id);
  const { isAuthenticated, isLoading } = useAuth();

  const redirectTo = useMemo(() => {
    return search?.get('redirect') || '/seller/dashboard';
  }, [search]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(buildLoginRedirectUrl(`/products/${productIdNum}/edit`));
    }
  }, [isAuthenticated, isLoading, router, productIdNum]);

  if (!Number.isFinite(productIdNum) || productIdNum <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Mã sản phẩm không hợp lệ.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        <ProductEditorForm
          productId={productIdNum}
          title="Chỉnh sửa sản phẩm"
          subtitle="Cập nhật giá, token thanh toán, gallery ảnh hoặc trạng thái sản phẩm."
          submitLabel="Lưu thay đổi"
          successMessage="Cập nhật sản phẩm thành công"
          backHref="/seller/dashboard"
          redirectTo={redirectTo}
        />
      </main>
      <Footer />
    </div>
  );
}
