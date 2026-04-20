'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Package, DollarSign, User, Calendar } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { disputeService, type Dispute } from '@/services/dispute.service';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';
import { toast } from 'sonner';
import Image from 'next/image';
import { buildLoginRedirectUrl } from '@/lib/auth/login-redirect';

export default function DisputeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const disputeId = parseInt(params.id as string);
  const { user, isAuthenticated, isLoading: authLoading, reauthRequired } = useAuth();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(buildLoginRedirectUrl('/disputes', reauthRequired ? 'reauth_required' : undefined));
    }
  }, [isAuthenticated, authLoading, router, reauthRequired]);

  useEffect(() => {
    if (isAuthenticated && disputeId) {
      fetchDispute();
    }
  }, [isAuthenticated, disputeId]);

  const fetchDispute = async () => {
    try {
      const data = await disputeService.getById(disputeId);
      setDispute(data as any);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load dispute');
      router.push('/disputes');
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!dispute) return;
    setResolving(true);
    try {
      await disputeService.escalate(dispute.dispute_id);
      toast.success('Dispute escalated');
      fetchDispute();
    } catch (error: any) {
      toast.error(error.message || 'Failed to escalate');
    } finally {
      setResolving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!dispute) return null;

  const isAdmin = (user as any)?.role === 'admin';
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Disputes
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-border bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-2">Dispute #{dispute.dispute_id}</h1>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${getStatusColor(dispute.status)}`}>
                    {dispute.status.toUpperCase()}
                  </span>
                  <span className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
                    {(dispute.reason_type || '').replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Info */}
          <div className="p-6 border-b border-border">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Order Information
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Order ID</p>
                <Link href={`/orders/${dispute.order_id}`} className="font-medium hover:text-primary">
                  #{dispute.internal_order_id?.slice(0, 12)}...
                </Link>
              </div>
              <div>
                <p className="text-muted-foreground">Order Total</p>
                <p className="font-medium">${parseFloat(dispute.total_usd?.toString() || '0').toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Order Status</p>
                <p className="font-medium">{dispute.order_status}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Raised By</p>
                <p className="font-medium">{dispute.raised_by_name}</p>
              </div>
            </div>
          </div>

          {/* Dispute Details */}
          <div className="p-6 border-b border-border">
            <h2 className="font-semibold mb-3">Dispute Details</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Reason:</p>
                <p className="text-sm">{dispute.reason}</p>
              </div>

              {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Evidence:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {dispute.evidence_urls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                        <Image src={url} alt={`Evidence ${idx + 1}`} fill className="object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Created: {new Date(dispute.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Resolution */}
          {dispute.resolution && (
            <div className="p-6 bg-success/5">
              <h2 className="font-semibold mb-3 text-success">Resolution</h2>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Type:</span> {dispute.resolution_type?.replace('_', ' ')}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Details:</span> {dispute.resolution}
                </p>
                {dispute.resolver_name && (
                  <p className="text-sm text-muted-foreground">
                    Resolved by: {dispute.resolver_name} on {new Date(dispute.resolved_at!).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {dispute.status === 'open' && !isAdmin && (
            <div className="p-6 bg-muted/30">
              <Button onClick={handleEscalate} disabled={resolving} variant="outline">
                Escalate to Admin
              </Button>
            </div>
          )}
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
