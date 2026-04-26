'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage, useChainId } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api/auth';
import { toast } from 'sonner';
import { Link2, Check } from 'lucide-react';

export function LinkWalletSection() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
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
      toast.error('Vui lòng kết nối ví trước');
      return;
    }
    setLinking(true);
    try {
      const domain = window.location.host;
      const origin = window.location.origin;
      const nonce = crypto.randomUUID().replace(/-/g, '');
      const issuedAt = new Date().toISOString();
      const expiration = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nLink wallet to Web3Market account\n\nURI: ${origin}\nVersion: 1\nChain ID: ${chainId || 1}\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expiration}`;

      const signature = await signMessageAsync({ message });
      await authApi.linkWallet({ wallet_address: address, message, signature });
      setProfileWallet(address);
      toast.success('Đã liên kết ví. Bạn có thể nhận thanh toán crypto khi bán hàng.');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Liên kết ví thất bại');
    } finally {
      setLinking(false);
    }
  };

  if (profileWallet === undefined) return null;
  if (profileWallet) {
    return (
      <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden h-full flex flex-col justify-center">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-2xl rounded-full pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Check className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Đã liên kết ví</h2>
        </div>
        <p className="text-sm text-gray-400 mt-1 relative z-10">
          Địa chỉ nhận thanh toán: <span className="font-mono text-gray-300 font-medium bg-black/30 px-2 py-1 rounded select-all">{profileWallet.slice(0, 6)}…{profileWallet.slice(-4)}</span>
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden h-full flex flex-col justify-center group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#f0b90b]/10 blur-2xl rounded-full pointer-events-none group-hover:bg-[#f0b90b]/20 transition-all duration-700" />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-[#f0b90b]" />
          </div>
          <h2 className="text-lg font-bold text-white">Liên kết ví (cho người bán)</h2>
        </div>
        <p className="text-sm text-gray-400 mb-5 leading-relaxed">
          Người bán cần liên kết ví để nhận thanh toán bằng Crypto. Kết nối ví của bạn và ký xác nhận.
        </p>
        <div className="flex flex-col gap-3">
          <ConnectButton.Custom>
            {({ openConnectModal, account, mounted }) => {
              if (!mounted) return null;
              if (!account) {
                return (
                  <button onClick={openConnectModal} className="w-full py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-medium rounded-xl border border-blue-500/20 transition-colors">
                    Kết nối ví Web3
                  </button>
                );
              }
              return (
                <div className="flex items-center gap-2">
                  <ConnectButton />
                </div>
              );
            }}
          </ConnectButton.Custom>
          {isConnected && address && (
            <button 
              onClick={handleLinkWallet} 
              disabled={linking}
              className="w-full py-3 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(240,185,11,0.2)] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {linking ? 'Đang liên kết...' : 'Ký xác nhận liên kết ví'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
