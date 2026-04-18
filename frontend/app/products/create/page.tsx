'use client';

export const dynamic = 'force-dynamic';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductEditorForm } from '@/components/product/editor/ProductEditorForm';

export default function CreateProductPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        <ProductEditorForm
          title="Đăng sản phẩm mới"
          subtitle="Niêm yết sản phẩm với nhiều token thanh toán, gallery nhiều ảnh và preview đúng contract backend."
          submitLabel="Đăng sản phẩm"
          successMessage="Đăng sản phẩm thành công"
          backHref="/products"
          redirectTo="/products"
        />
      </main>
      <Footer />
    </div>
  );
}
