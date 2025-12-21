import { ethers } from 'ethers';
import { BaseProvider, BalanceResult, TransactionResult, TransactionDetails, TransferParams, TokenTransferParams, GasEstimate } from './BaseProvider';
import { NetworkConfig } from '../config/networks';
import logger from '../utils/logger';

// ERC20 ABI for token transfers
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export class EVMProvider extends BaseProvider {
  private provider: ethers.JsonRpcProvider;
  private providers: ethers.JsonRpcProvider[];

  constructor(network: NetworkConfig) {
    super(network);
    
    // Create primary provider
    this.provider = new ethers.JsonRpcProvider(network.rpcUrl);
    
    // Create fallback providers
    this.providers = [this.provider];
    if (network.rpcUrlFallback && network.rpcUrlFallback.length > 0) {
      for (const fallbackUrl of network.rpcUrlFallback) {
        this.providers.push(new ethers.JsonRpcProvider(fallbackUrl));
      }
    }
  }

  private async getProvider(): Promise<ethers.JsonRpcProvider> {
    // Try primary provider first
    try {
      await this.provider.getBlockNumber();
      return this.provider;
    } catch (error) {
      logger.warn('Primary RPC provider failed, trying fallback');
      // Try fallback providers
      for (const fallbackProvider of this.providers.slice(1)) {
        try {
          await fallbackProvider.getBlockNumber();
          return fallbackProvider;
        } catch {
          continue;
        }
      }
      throw new Error('All RPC providers failed');
    }
  }

  async getBalance(address: string): Promise<BalanceResult> {
    try {
      const provider = await this.getProvider();
      const balance = await provider.getBalance(address);
      const balanceInEther = ethers.formatEther(balance);

      return {
        balance: balanceInEther,
        decimals: this.network.nativeCurrency.decimals,
        symbol: this.network.nativeCurrency.symbol,
      };
    } catch (error: any) {
      logger.error('EVM getBalance error:', error);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  async getTokenBalance(address: string, tokenAddress: string): Promise<BalanceResult> {
    try {
      const provider = await this.getProvider();
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      const [balance, decimals, symbol] = await Promise.all([
        tokenContract.balanceOf(address),
        tokenContract.decimals(),
        tokenContract.symbol(),
      ]);

      const formattedBalance = ethers.formatUnits(balance, decimals);

      return {
        balance: formattedBalance,
        decimals: Number(decimals),
        symbol: symbol,
      };
    } catch (error: any) {
      logger.error('EVM getTokenBalance error:', error);
      throw new Error(`Failed to get token balance: ${error.message}`);
    }
  }

  async transfer(params: TransferParams): Promise<TransactionResult> {
    try {
      const provider = await this.getProvider();
      
      // Create wallet from private key
      const wallet = new ethers.Wallet(params.privateKey, provider);
      
      // Get nonce
      const nonce = await provider.getTransactionCount(wallet.address, 'pending');
      
      // Get gas price
      const feeData = await provider.getFeeData();
      const gasPrice = params.gasPrice 
        ? ethers.parseUnits(params.gasPrice, 'gwei')
        : (feeData.gasPrice || await provider.getFeeData().then(f => f.gasPrice) || ethers.parseUnits('20', 'gwei'));
      
      // Estimate gas
      const gasLimit = params.gasLimit || 21000;
      
      // Build transaction
      const tx = {
        to: params.toAddress,
        value: ethers.parseEther(params.amount),
        gasLimit: gasLimit,
        gasPrice: gasPrice,
        nonce: nonce,
      };

      // Send transaction
      const txResponse = await wallet.sendTransaction(tx);
      
      // Wait for transaction to be mined
      const receipt = await txResponse.wait();

      return {
        txHash: txResponse.hash,
        blockNumber: receipt?.blockNumber,
        blockHash: receipt?.blockHash,
        confirmations: receipt?.confirmations || 0,
        status: receipt?.status === 1 ? 'confirmed' : 'failed',
        gasUsed: receipt?.gasUsed.toString(),
        gasPrice: gasPrice.toString(),
      };
    } catch (error: any) {
      logger.error('EVM transfer error:', error);
      throw new Error(`Failed to transfer: ${error.message}`);
    }
  }

  async transferToken(params: TokenTransferParams): Promise<TransactionResult> {
    try {
      const provider = await this.getProvider();
      
      // Create wallet from private key
      const wallet = new ethers.Wallet(params.privateKey, provider);
      
      // Create token contract instance
      const tokenContract = new ethers.Contract(params.tokenAddress, ERC20_ABI, wallet);
      
      // Convert amount to token units
      const amount = ethers.parseUnits(params.amount, params.decimals);
      
      // Get gas price
      const feeData = await provider.getFeeData();
      const gasPrice = params.gasPrice 
        ? ethers.parseUnits(params.gasPrice, 'gwei')
        : (feeData.gasPrice || ethers.parseUnits('20', 'gwei'));
      
      // Estimate gas
      const gasLimit = params.gasLimit || 65000;
      
      // Send transaction
      const txResponse = await tokenContract.transfer(params.toAddress, amount, {
        gasLimit: gasLimit,
        gasPrice: gasPrice,
      });
      
      // Wait for transaction to be mined
      const receipt = await txResponse.wait();

      return {
        txHash: txResponse.hash,
        blockNumber: receipt?.blockNumber,
        blockHash: receipt?.blockHash,
        confirmations: receipt?.confirmations || 0,
        status: receipt?.status === 1 ? 'confirmed' : 'failed',
        gasUsed: receipt?.gasUsed.toString(),
        gasPrice: gasPrice.toString(),
      };
    } catch (error: any) {
      logger.error('EVM transferToken error:', error);
      throw new Error(`Failed to transfer token: ${error.message}`);
    }
  }

  async getTransaction(txHash: string): Promise<TransactionDetails | null> {
    try {
      const provider = await this.getProvider();
      const [tx, receipt] = await Promise.all([
        provider.getTransaction(txHash),
        provider.getTransactionReceipt(txHash).catch(() => null),
      ]);

      if (!tx) {
        return null;
      }

      const block = tx.blockNumber ? await provider.getBlock(tx.blockNumber) : null;
      const currentBlock = await provider.getBlockNumber();
      const confirmations = tx.blockNumber ? currentBlock - tx.blockNumber + 1 : 0;

      return {
        txHash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: ethers.formatEther(tx.value),
        blockNumber: tx.blockNumber || undefined,
        blockHash: block?.hash || undefined,
        confirmations,
        status: receipt ? (receipt.status === 1 ? 'confirmed' : 'failed') : 'pending',
        gasUsed: receipt?.gasUsed.toString(),
        gasPrice: tx.gasPrice?.toString(),
        nonce: tx.nonce,
        timestamp: block?.timestamp ? new Date(block.timestamp * 1000) : undefined,
      };
    } catch (error: any) {
      logger.error('EVM getTransaction error:', error);
      return null;
    }
  }

  async getTransactionReceipt(txHash: string): Promise<any> {
    try {
      const provider = await this.getProvider();
      return await provider.getTransactionReceipt(txHash);
    } catch (error: any) {
      logger.error('EVM getTransactionReceipt error:', error);
      throw new Error(`Failed to get transaction receipt: ${error.message}`);
    }
  }

  async estimateGas(params: Partial<TransferParams>): Promise<GasEstimate> {
    try {
      const provider = await this.getProvider();
      const feeData = await provider.getFeeData();

      let gasLimit = '21000'; // Default for native transfer
      
      if (params.fromAddress && params.toAddress && params.amount) {
        try {
          const estimatedGas = await provider.estimateGas({
            from: params.fromAddress,
            to: params.toAddress,
            value: ethers.parseEther(params.amount),
          });
          gasLimit = estimatedGas.toString();
        } catch {
          // Use default if estimation fails
        }
      }

      const gasPrice = feeData.gasPrice?.toString() || ethers.parseUnits('20', 'gwei').toString();
      const maxFeePerGas = feeData.maxFeePerGas?.toString();
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas?.toString();

      return {
        gasLimit,
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
      };
    } catch (error: any) {
      logger.error('EVM estimateGas error:', error);
      throw new Error(`Failed to estimate gas: ${error.message}`);
    }
  }

  async getGasPrice(): Promise<string> {
    try {
      const provider = await this.getProvider();
      const feeData = await provider.getFeeData();
      return feeData.gasPrice?.toString() || ethers.parseUnits('20', 'gwei').toString();
    } catch (error: any) {
      logger.error('EVM getGasPrice error:', error);
      throw new Error(`Failed to get gas price: ${error.message}`);
    }
  }

  async getTransactionCount(address: string): Promise<number> {
    try {
      const provider = await this.getProvider();
      return await provider.getTransactionCount(address, 'pending');
    } catch (error: any) {
      logger.error('EVM getTransactionCount error:', error);
      throw new Error(`Failed to get transaction count: ${error.message}`);
    }
  }

  validateAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  async isTransactionConfirmed(txHash: string, minConfirmations: number = 1): Promise<boolean> {
    try {
      const tx = await this.getTransaction(txHash);
      if (!tx) return false;
      return tx.confirmations >= minConfirmations;
    } catch {
      return false;
    }
  }

  async waitForConfirmation(txHash: string, minConfirmations: number = 1, timeout: number = 300000): Promise<TransactionDetails> {
    try {
      const provider = await this.getProvider();
      const receipt = await provider.waitForTransaction(txHash, minConfirmations, timeout);
      
      if (!receipt) {
        throw new Error('Transaction not found');
      }

      const tx = await provider.getTransaction(txHash);
      if (!tx) {
        throw new Error('Transaction details not found');
      }

      const currentBlock = await provider.getBlockNumber();
      const confirmations = receipt.blockNumber ? currentBlock - receipt.blockNumber + 1 : 0;

      return {
        txHash: receipt.hash,
        from: receipt.from,
        to: receipt.to || '',
        value: tx.value ? ethers.formatEther(tx.value) : '0',
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        confirmations,
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice?.toString(),
        nonce: tx.nonce,
      };
    } catch (error: any) {
      logger.error('EVM waitForConfirmation error:', error);
      throw new Error(`Failed to wait for confirmation: ${error.message}`);
    }
  }
}



