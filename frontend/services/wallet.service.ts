/**
 * Wallet Service – orchestrates wallet connection, balance fetching, linking.
 */
import { apiClient } from '@/lib/api/client';
import type { TokenBalance } from '@/types';
import { toast } from 'sonner';

class WalletService {
  /** Link wallet to user account via SIWE */
  async linkWallet(walletAddress: string, message: string, signature: string): Promise<boolean> {
    try {
      await apiClient.post('/api/auth/link-wallet', {
        wallet_address: walletAddress,
        message,
        signature,
      });
      toast.success('Liên kết ví thành công');
      return true;
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Liên kết ví thất bại');
      return false;
    }
  }

  /** Format address for display */
  shortenAddress(address: string, chars = 4): string {
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
  }

  /** Calculate total USD from balances */
  calculateTotalUSD(balances: TokenBalance[]): number {
    return balances.reduce((sum, t) => sum + t.usdValue, 0);
  }
}

export const walletService = new WalletService();
