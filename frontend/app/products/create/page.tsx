'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import Image from 'next/image';
import { X } from 'lucide-react';

const productSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().nonnegative('Stock must be non-negative'),
  category: z.string().min(1, 'Category is required'),
});

type ProductFormData = z.infer<typeof productSchema>;

export default function CreateProductPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [acceptedTokens, setAcceptedTokens] = useState<string[]>(['USDT']);
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});
  const [acceptPayPal, setAcceptPayPal] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [priceConverting, setPriceConverting] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
  });

  const basePrice = watch('price');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }

    setImages([...images, ...files]);

    // Generate previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const toggleToken = (token: string) => {
    setAcceptedTokens((prev) => {
      const isSelected = prev.includes(token);
      if (isSelected) {
        const next = prev.filter((t) => t !== token);
        const newPrices = { ...tokenPrices };
        delete newPrices[token];
        setTokenPrices(newPrices);
        return next;
      }
      return [...prev, token];
    });
  };

  const setTokenPrice = (token: string, value: number) => {
    setTokenPrices((prev) => ({ ...prev, [token]: value }));
  };

  const handleFetchBinancePrice = async (token: string) => {
    if (!basePrice) {
      toast.error('Vui lòng nhập giá USD trước');
      return;
    }
    setPriceConverting(token);
    try {
      if (['USDT', 'USDC', 'DAI', 'BUSD'].includes(token)) {
        setTokenPrice(token, basePrice);
        toast.success(`Đã tự động điền ${basePrice} ${token}`);
      } else {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${token}USDT`);
        const data = await res.json();
        const priceInToken = basePrice / parseFloat(data.price);
        setTokenPrice(token, Number(priceInToken.toFixed(6)));
        toast.success(`Quy đổi thành công: ${priceInToken.toFixed(6)} ${token}`);
      }
    } catch (err) {
      toast.error(`Lỗi quy đổi giá cho ${token}`);
    } finally {
      setPriceConverting(null);
    }
  };

  const onSubmit = async (data: ProductFormData) => {
    if (images.length === 0) {
      toast.error('Please upload at least one image');
      return;
    }

    setIsLoading(true);
    try {
      // Upload images first
      const formData = new FormData();
      images.forEach((image) => formData.append('images', image));

      const imageResponse = await apiClient.post('/products/upload-images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Create product
      await apiClient.post('/products', {
        ...data,
        pricing: tokenPrices,
        metadata: {
          images: imageResponse.data.urls,
          category: data.category,
          accepted_tokens: {
            crypto: acceptedTokens,
            fiat: acceptPayPal ? ['paypal'] : [],
          },
        },
      });

      toast.success(t('product.listingSuccess'));
      router.push('/products');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create product');
    } finally {
      setIsLoading(false);
    }
  };

  const tokenOptions = ['USDT', 'USDC', 'DAI', 'MATIC', 'ETH'];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-8">{t('product.createListing')}</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Product Name */}
          <Input
            label={t('product.productName')}
            {...register('name')}
            error={errors.name?.message}
            placeholder="iPhone 15 Pro Max"
          />

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('product.description')}</label>
            <textarea
              {...register('description')}
              rows={5}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Detailed product description..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Price and Stock */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('product.priceInUSD')}
              type="number"
              step="0.01"
              {...register('price', { valueAsNumber: true })}
              error={errors.price?.message}
              placeholder="999.99"
            />

            <Input
              label={t('product.stock')}
              type="number"
              {...register('stock', { valueAsNumber: true })}
              error={errors.stock?.message}
              placeholder="10"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('product.category')}</label>
            <select {...register('category')} className="w-full px-3 py-2 border rounded-md">
              <option value="">Select category</option>
              <option value="electronics">Electronics</option>
              <option value="fashion">Fashion</option>
              <option value="home">Home & Garden</option>
              <option value="sports">Sports</option>
              <option value="other">Other</option>
            </select>
            {errors.category && (
              <p className="mt-1 text-sm text-destructive">{errors.category.message}</p>
            )}
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('product.uploadImages')}</label>
            <div className="border-2 border-dashed rounded-lg p-4">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer flex flex-col items-center justify-center py-4"
              >
                <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm text-gray-600">Click to upload images (max 5)</span>
              </label>
            </div>

            {/* Image Previews */}
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mt-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <Image
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      width={200}
                      height={200}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Methods */}
          <div>
            <label className="block text-sm font-medium mb-3">{t('product.acceptedPayments')}</label>

            {/* Crypto Tokens */}
            <div className="space-y-4 mb-6">
              <p className="text-sm text-muted-foreground">{t('product.acceptCrypto')}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {tokenOptions.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => toggleToken(token)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      acceptedTokens.includes(token)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={`https://cryptologos.cc/logos/${token.toLowerCase()}-logo.svg`}
                        alt={token}
                        className="w-5 h-5"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="font-medium">{token}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Token Pricing Inputs */}
              {acceptedTokens.length > 0 && (
                <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-border">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Giá cho từng token</p>
                  {acceptedTokens.map(token => (
                    <div key={token} className="flex items-center gap-3">
                      <div className="w-20 font-bold flex items-center gap-1.5 flex-shrink-0">
                        <img src={`https://cryptologos.cc/logos/${token.toLowerCase()}-logo.svg`} alt="" className="w-5 h-5 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        {token}
                      </div>
                      <Input
                        type="number"
                        placeholder="VD: 0.05"
                        value={tokenPrices[token] || ''}
                        onChange={(e) => setTokenPrice(token, parseFloat(e.target.value))}
                        className="flex-1"
                        step="any"
                      />
                      <button
                        type="button"
                        onClick={() => handleFetchBinancePrice(token)}
                        disabled={priceConverting === token}
                        className="px-3 py-2 bg-[#f0b90b] text-black font-bold rounded-md hover:bg-[#e6a800] transition-colors text-xs whitespace-nowrap disabled:opacity-50"
                        title="Tự động tính từ giá USD (Binance Realtime)"
                      >
                        {priceConverting === token ? '...' : '~='}
                      </button>
                    </div>
                  ))}
                  <div className="text-[10px] text-muted-foreground/80 mt-1 flex items-start gap-1">
                    <span>ℹ️</span> 
                    <span>Bấm nút "~=" để mượn API Binance tính toán tự động số lượng {acceptedTokens.join(', ')} tương đương với {basePrice || 0}$</span>
                  </div>
                </div>
              )}
            </div>

            {/* PayPal */}
            <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <input
                type="checkbox"
                checked={acceptPayPal}
                onChange={(e) => setAcceptPayPal(e.target.checked)}
                className="w-4 h-4"
              />
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l1.293-8.209h2.83c5.48 0 9.092-2.166 10.102-7.711z"/>
                </svg>
                <span className="font-medium">{t('product.acceptPayPal')}</span>
              </div>
            </label>
          </div>

          {/* Submit Button */}
          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? t('common.loading') : t('product.createListing')}
          </Button>
        </form>
      </main>
    </div>
  );
}
