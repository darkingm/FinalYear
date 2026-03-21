'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Store, Package, DollarSign, TrendingUp, Clock, CheckCircle,
  XCircle, AlertCircle, Users, Star, ArrowUpRight, Plus,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';
import { toast } from 'sonner';

interface DashboardStats {
  orders: {
    total_orders: number;
    unpaid: number;
    paid_pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    completed: number;
    cancelled: number;
    disputed: number;
    total_revenue: string;
  };
  products: {
    total_products: number;
    active_products: number;
    low_stock_count: number;
  };
  recent_orders: any[];
  reviews: {
    avg_rating: string;
    review_count: number;
  };
}

export default function SellerDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login?callbackUrl=/seller/dashboard');
      }
      // No role check — any logged-in user can be a seller
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboard();
    }
  }, [isAuthenticated, user]);

  const fetchDashboard = async () => {
    try {
      const { data } = await apiClient.get('/api/sellers/dashboard');
      if (data.success) {
        setStats(data.dashboard);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-7xl text-center">
        <Store className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Chưa có dữ liệu gian hàng</h2>
        <p className="text-muted-foreground mt-2">Hãy tạo sản phẩm đầu tiên để bắt đầu bán hàng!</p>
        <Link href="/products/create" className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#f0b90b] text-black font-bold rounded-xl hover:bg-[#f0b90b]/90 transition-colors">
          <Plus className="w-4 h-4" /> Tạo sản phẩm đầu tiên
        </Link>
      </main>
      <Footer />
    </div>
  );

  const statCards = [
    {
      title: 'Total Orders',
      value: stats.orders.total_orders,
      icon: Package,
      color: 'from-blue-500 to-blue-600',
      change: null,
    },
    {
      title: 'Processing',
      value: stats.orders.processing + stats.orders.paid_pending,
      icon: Clock,
      color: 'from-yellow-500 to-orange-500',
    },
    {
      title: 'Completed',
      value: stats.orders.completed,
      icon: CheckCircle,
      color: 'from-green-500 to-emerald-600',
    },
    {
      title: 'Total Revenue',
      value: `$${parseFloat(stats.orders.total_revenue).toLocaleString()}`,
      icon: DollarSign,
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'Active Products',
      value: stats.products.active_products,
      icon: Store,
      color: 'from-cyan-500 to-teal-500',
    },
    {
      title: 'Avg Rating',
      value: parseFloat(stats.reviews.avg_rating).toFixed(1),
      icon: Star,
      color: 'from-yellow-400 to-orange-500',
      subtitle: `${stats.reviews.review_count} reviews`,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Store className="w-8 h-8 text-primary" />
              Seller Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Manage your store and orders</p>
          </div>
          <Link href="/products/create">
            <Button className="bg-gradient-to-r from-ocean-500 to-ocean-600">
              <Plus className="w-4 h-4 mr-2" />
              New Product
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {statCards.map((stat: any, idx) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-card rounded-xl border border-border p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                {stat.change && (
                  <span className="text-xs text-success flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    {stat.change}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</h3>
              <p className="text-3xl font-bold">{stat.value}</p>
              {stat.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/products/seller/my">
            <div className="p-4 bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
              <Package className="w-5 h-5 text-primary mb-2" />
              <h3 className="font-semibold">My Products</h3>
              <p className="text-sm text-muted-foreground">Manage inventory & listings</p>
            </div>
          </Link>
          <Link href="/orders?role=seller">
            <div className="p-4 bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
              <TrendingUp className="w-5 h-5 text-primary mb-2" />
              <h3 className="font-semibold">Orders</h3>
              <p className="text-sm text-muted-foreground">Process & ship orders</p>
            </div>
          </Link>
          <Link href="/reviews/seller/my">
            <div className="p-4 bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
              <Star className="w-5 h-5 text-primary mb-2" />
              <h3 className="font-semibold">Reviews</h3>
              <p className="text-sm text-muted-foreground">Customer feedback</p>
            </div>
          </Link>
        </div>

        {/* Recent Orders */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Recent Orders</h2>
            <Link href="/orders?role=seller">
              <Button variant="ghost" size="sm">
                View All
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {stats.recent_orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No recent orders</p>
          ) : (
            <div className="space-y-3">
              {stats.recent_orders.map((order) => (
                <Link key={order.order_id} href={`/orders/${order.order_id}`}>
                  <div className="p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Order #{order.internal_order_id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.buyer_name} • {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">${parseFloat(order.total_usd).toFixed(2)}</p>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${order.status === 'COMPLETED'
                            ? 'bg-success/10 text-success'
                            : order.status === 'SHIPPED'
                              ? 'bg-blue-500/10 text-blue-500'
                              : order.status === 'PROCESSING'
                                ? 'bg-yellow-500/10 text-yellow-600'
                                : 'bg-muted text-muted-foreground'
                            }`}
                        >
                          {order.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Alerts */}
        {stats.products.low_stock_count > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 p-4 bg-warning/10 border border-warning/30 rounded-xl flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-warning">Low Stock Alert</h3>
              <p className="text-sm text-muted-foreground">
                {stats.products.low_stock_count} product(s) are running low on stock
              </p>
              <Link href="/inventory/seller/my?lowStockOnly=true">
                <Button variant="ghost" size="sm" className="mt-2 text-warning hover:text-warning">
                  View Inventory
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </main>

      <Footer />
    </div>
  );
}
