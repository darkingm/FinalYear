'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { OrderStatusIndicator, type OrderStatus } from '@/components/order/OrderStepper';
import { Package, Clock, CheckCircle, XCircle, Filter, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface Order {
  order_id: number;
  product_name: string;
  product_metadata?: { images?: string[] };
  quantity: number;
  price_usd: number;
  total_price_usd?: number;
  status: OrderStatus;
  payment_method?: string;
  created_at: string;
}

const PLACEHOLDER_IMAGE = '/placeholder-product.svg';

function OrderCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 animate-pulse">
      <div className="flex gap-4">
        <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, index }: { order: Order; index: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const imageSrc = order.product_metadata?.images?.[0] && !imgFailed
    ? order.product_metadata.images[0]
    : PLACEHOLDER_IMAGE;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link href={`/orders/${order.order_id}`}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all p-6 cursor-pointer group">
          <div className="flex gap-4">
            {/* Product Image */}
            <div className="relative w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
              <Image
                src={imageSrc}
                alt={order.product_name}
                fill
                className="object-cover group-hover:scale-105 transition-transform"
                unoptimized
                onError={() => setImgFailed(true)}
              />
            </div>

            {/* Order Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                  {order.product_name}
                </h3>
                <OrderStatusIndicator status={order.status} />
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-2">
                <span>Order #{order.order_id}</span>
                <span>Qty: {order.quantity}</span>
                <span>{new Date(order.created_at).toLocaleDateString()}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-primary">
                  ${Number(order.price_usd ?? order.total_price_usd ?? 0).toFixed(2)}
                </span>
                <span className="text-sm text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  View Details →
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function OrdersPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated, isLoading]);

  const fetchOrders = async () => {
    try {
      const response = await apiClient.get('/api/orders');
      setOrders(response.data.orders || []);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    // Status filter
    if (filter !== 'all') {
      const statusGroups: Record<string, string[]> = {
        pending: ['UNPAID', 'TX_SUBMITTED', 'ONCHAIN_PENDING'],
        processing: ['ONCHAIN_CONFIRMED', 'PAYMENT_VALIDATED', 'PAID', 'PROCESSING'],
        shipped: ['SHIPPED'],
        completed: ['DELIVERED', 'COMPLETED'],
        cancelled: ['CANCELLED', 'REFUNDED', 'DISPUTED'],
      };
      if (!statusGroups[filter]?.includes(order.status)) return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return order.product_name.toLowerCase().includes(query)
        || order.order_id.toString().includes(query);
    }

    return true;
  });

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => <OrderCardSkeleton key={i} />)}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <Button variant="ghost" onClick={() => router.push('/')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">My Orders</h1>
          </div>
        </motion.div>

        {/* Filters & Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col md:flex-row gap-4 mb-6"
        >
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { value: 'all', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'processing', label: 'Processing' },
              { value: 'shipped', label: 'Shipped' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ].map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === tab.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white dark:bg-gray-800 text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl"
          >
            <Package className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No orders found</h3>
            <p className="text-muted-foreground mb-6">
              {filter !== 'all' || searchQuery
                ? 'Try adjusting your filters or search'
                : "You haven't placed any orders yet"}
            </p>
            <Link href="/products">
              <Button>Start Shopping</Button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order, index) => (
              <OrderCard key={order.order_id} order={order} index={index} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
