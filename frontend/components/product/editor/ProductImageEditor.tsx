'use client';

import { useRef } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from 'lucide-react';
import type { ProductEditorImageDraft } from '@/lib/products/types';

interface ProductImageEditorProps {
  images: ProductEditorImageDraft[];
  onAddFiles: (files: File[]) => void;
  onRemove: (imageId: string) => void;
  onMove: (imageId: string, direction: 'up' | 'down') => void;
  onSetPrimary: (imageId: string) => void;
  limit?: number;
}

export function ProductImageEditor({
  images,
  onAddFiles,
  onRemove,
  onMove,
  onSetPrimary,
  limit = 8,
}: ProductImageEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canAddMore = images.length < limit;

  return (
    <div className="space-y-4">
      <div
        onClick={() => canAddMore && fileInputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!canAddMore) return;
          onAddFiles(Array.from(event.dataTransfer.files));
        }}
        className={[
          'rounded-3xl border-2 border-dashed p-6 text-center transition',
          canAddMore ? 'cursor-pointer border-border hover:border-primary/40 hover:bg-primary/5' : 'border-border/60 opacity-70',
        ].join(' ')}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => onAddFiles(Array.from(event.target.files || []))}
        />
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ImagePlus className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-foreground">Kéo thả ảnh vào đây hoặc bấm để tải lên</p>
        <p className="mt-1 text-xs text-muted-foreground">Tối đa {limit} ảnh. Ảnh đầu tiên hoặc ảnh được gắn sao sẽ là ảnh chính.</p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image, index) => (
            <div key={image.id} className="overflow-hidden rounded-3xl border border-border bg-card/80 shadow-sm">
              <div className="relative aspect-square overflow-hidden bg-muted">
                <img src={image.url} alt={`Product upload ${index + 1}`} className="h-full w-full object-cover" />
                {image.is_primary && (
                  <span className="absolute left-2 top-2 rounded-full bg-[#f0b90b] px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-black shadow">
                    Primary
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                <button
                  type="button"
                  onClick={() => onSetPrimary(image.id)}
                  className="flex items-center justify-center gap-1 rounded-2xl border border-border px-2 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <Star className="h-3.5 w-3.5" />
                  Chính
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(image.id)}
                  className="flex items-center justify-center gap-1 rounded-2xl border border-red-500/20 px-2 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa
                </button>
                <button
                  type="button"
                  onClick={() => onMove(image.id, 'up')}
                  disabled={index === 0}
                  className="flex items-center justify-center gap-1 rounded-2xl border border-border px-2 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  Lên
                </button>
                <button
                  type="button"
                  onClick={() => onMove(image.id, 'down')}
                  disabled={index === images.length - 1}
                  className="flex items-center justify-center gap-1 rounded-2xl border border-border px-2 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  Xuống
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
