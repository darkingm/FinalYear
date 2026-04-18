'use client';

export const dynamic = 'force-dynamic';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductEditorForm } from '@/components/product/editor/ProductEditorForm';

export default function SellerUploadPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        <ProductEditorForm
          title="Seller Upload"
          subtitle="Dùng cùng editor chuẩn với trang create để dữ liệu giá, token và ảnh luôn đồng nhất trên toàn hệ thống."
          submitLabel="Lưu listing"
          successMessage="Đã tạo listing thành công"
          backHref="/products"
          redirectTo="/products"
        />
      </main>
      <Footer />
    </div>
  );
}
