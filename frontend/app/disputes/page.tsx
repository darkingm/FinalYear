'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertTriangle, Eye, ArrowLeft, Filter } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { disputeService, type Dispute } from '@/services/dispute.service';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';
import { toast } from 'sonner';

export default function DisputesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?callbackUrl=/disputes');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDisputes();
    }
  }, [isAuthenticated, statusFilter]);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const { disputes: data } = await disputeService.list({
        status: statusFilter || undefined,
      });
      setDisputes(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'investigating': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'resolved': return 'bg-success/10 text-success border-success/20';
      case 'escalated': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'closed': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-warning" />
              Disputes
            </h1>
            <p className="text-muted-foreground mt-1">Manage order disputes and resolutions</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-2 flex-wrap">
            {['', 'open', 'investigating', 'resolved', 'escalated', 'closed'].map((status) => (
              <Button
                key={status}
                size="sm"
                variant={statusFilter === status ? 'default' : 'outline'}
                onClick={() => setStatusFilter(status)}
              >
                {status || 'All'}
              </Button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-card rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && disputes.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 bg-card rounded-xl border border-border"
          >
            <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No disputes found</h2>
            <p className="text-muted-foreground">
              {statusFilter ? `No disputes with status "${statusFilter}"` : 'All orders are running smoothly'}
            </p>
          </motion.div>
        )}

        {/* Disputes List */}
        {!loading && disputes.length > 0 && (
          <div className="space-y-4">
            {disputes.map((dispute, idx) => (
              <motion.div
                key={dispute.dispute_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-card rounded-xl border border-border p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">
                        Dispute #{dispute.dispute_id}
                      </h3>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${getStatusColor(dispute.status)}`}>
                        {dispute.status.toUpperCase()}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                        {dispute.reason_type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Order: #{dispute.internal_order_id?.slice(0, 8)} • ${parseFloat(dispute.total_usd?.toString() || '0').toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Raised by: {dispute.raised_by_name} • {new Date(dispute.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Link href={`/disputes/${dispute.dispute_id}`}>
                    <Button size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </Link>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm font-medium mb-1">Reason:</p>
                  <p className="text-sm text-muted-foreground">{dispute.reason}</p>
                </div>

                {dispute.resolution && (
                  <div className="mt-3 p-4 bg-success/5 border border-success/20 rounded-lg">
                    <p className="text-sm font-medium text-success mb-1">
                      Resolution ({dispute.resolution_type?.replace('_', ' ')}):
                    </p>
                    <p className="text-sm text-muted-foreground">{dispute.resolution}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
