'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api/auth';
import { toast } from 'sonner';
import { Link2, Check } from 'lucide-react';

export function LinkWalletSection() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [profileWallet, setProfileWallet] = useState<string | null | undefined>(undefined);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    authApi
      .getProfile()
      .then((res) => setProfileWallet(res.data?.user?.wallet_address ?? null))
      .catch(() => setProfileWallet(null));
  }, []);

  const handleLinkWallet = async () => {
    if (!isConnected || !address) {
      toast.error('Connect your wallet first');
      return;
    }
    setLinking(true);
    try {
      const message = `Link this wallet to your Crypto Marketplace account\n\nNonce: ${Date.now()}`;
      const signature = await signMessageAsync({ message });
      await authApi.linkWallet({ wallet_address: address, message, signature });
      setProfileWallet(address);
      toast.success('Wallet linked. You can now receive crypto payments as a seller.');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to link wallet');
    } finally {
      setLinking(false);
    }
  };

  if (profileWallet === undefined) return null;
  if (profileWallet) {
    return (
      <section className="rounded-2xl border bg-card p-6 mb-8">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <Check className="w-5 h-5" />
          <span className="font-medium">Wallet linked</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Receiving address: {profileWallet.slice(0, 6)}…{profileWallet.slice(-4)}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-6 mb-8">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Link wallet (for sellers)</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Sellers need a linked wallet to receive crypto payments. Connect your wallet and sign to link it to your account.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <ConnectButton />
        {isConnected && address && (
          <Button onClick={handleLinkWallet} disabled={linking}>
            {linking ? 'Linking…' : 'Sign to link wallet'}
          </Button>
        )}
      </div>
    </section>
  );
}
