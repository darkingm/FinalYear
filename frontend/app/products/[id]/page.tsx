'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Image from 'next/image';

interface Product {
  product_id: number;
  name: string;
  description: string;
  base_price_usd: number;
  metadata: {
    images?: string[];
    category?: string;
    accepted_tokens?: { crypto?: string[]; fiat?: string[] };
    attributes?: any;
  };
  stock: number;
  seller_name: string;
  seller_id: number;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (params.id) {
      fetchProduct();
    }
  }, [params.id]);

  const fetchProduct = async () => {
    try {
      const response = await apiClient.get(`/api/products/${params.id}`);
      setProduct(response.data.data);
    } catch (error) {
      toast.error('Product not found');
      router.push('/products');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = async () => {
    if (!session) {
      toast.error('Please login first');
      router.push('/login');
      return;
    }

    try {
      const response = await apiClient.post('/api/orders', {
        product_id: product?.product_id,
        quantity,
      });

      toast.success('Order created! Redirecting to checkout...');
      router.push(`/checkout/${response.data.order.order_id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create order');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!product) {
    return <div className="min-h-screen flex items-center justify-center">Product not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid md:grid-cols-2 gap-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          {/* Image */}
          <div className="relative h-96 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
            {product.metadata?.images?.[0] ? (
              <Image
                src={product.metadata.images[0]}
                alt={product.name}
                fill
                className="object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No Image
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
            
            <div className="mb-4">
              <span className="text-sm text-gray-500">Category:</span>
              <span className="ml-2 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">
                {product.metadata?.category}
              </span>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              {product.description}
            </p>

            <div className="border-t border-b py-4 mb-6">
              <div className="text-3xl font-bold text-primary mb-2">
                ${Number(product.base_price_usd).toFixed(2)}
              </div>
              <div className="text-sm text-gray-500">
                In stock: {product.stock} units
              </div>
            </div>

            {/* Accepted Payment Methods */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Accepted Payments:</h3>
              <div className="flex gap-2 flex-wrap">
                {product.metadata?.accepted_tokens?.crypto?.map((token) => (
                  <div key={token} className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900 rounded-lg">
                    <span className="text-lg">
                      {token === 'BTC' ? '₿' : token === 'ETH' ? 'Ξ' : token === 'MATIC' ? '⬡' : token === 'USDT' ? '₮' : token === 'USDC' ? '$' : token === 'DAI' ? '◆' : '💎'}
                    </span>
                    <span className="font-medium">{token}</span>
                  </div>
                ))}
                {product.metadata?.accepted_tokens?.fiat?.includes('paypal') && (
                  <div className="px-3 py-2 bg-green-50 dark:bg-green-900 rounded-lg font-medium">
                    PayPal
                  </div>
                )}
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Quantity</label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </Button>
                <span className="text-xl font-semibold w-12 text-center">{quantity}</span>
                <Button
                  variant="outline"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={handleBuyNow}
                className="w-full"
                disabled={product.stock === 0}
              >
                {product.stock === 0 ? 'Out of Stock' : 'Buy Now'}
              </Button>
              
              <Button variant="outline" className="w-full" onClick={() => router.push('/products')}>
                Back to Products
              </Button>
            </div>

            {/* Seller Info */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-gray-500">
                Sold by: <span className="font-medium text-gray-800 dark:text-gray-200">{product.seller_name}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
