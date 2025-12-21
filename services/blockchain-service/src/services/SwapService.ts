import axios from 'axios';
import { ethers } from 'ethers';
import multiChainService from './MultiChainService';
import transferService from './TransferService';
import balanceService from './BalanceService';
import Transaction from '../models/Transaction.model';
import Wallet from '../models/Wallet.model';
import { DEX_AGGREGATORS, POPULAR_TOKENS } from '../config/constants';
import { validateAddress, validateAmount } from '../utils/validation';
import { getNetworkConfig, isEVMNetwork } from '../utils/networkUtils';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';

interface SwapParams {
  userId: string;
  networkId: string;
  fromAddress: string;
  fromToken: string; // Token address or 'native' for native coin
  toToken: string; // Token address or 'native' for native coin
  amount: string;
  slippage?: number; // Slippage tolerance in percentage (default: 1%)
}

interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  estimatedGas: string;
  gasPrice: string;
  priceImpact: number;
  route: any;
}

class SwapService {
  /**
   * Get swap quote from 1inch API
   */
  private async get1inchQuote(
    networkId: string,
    fromToken: string,
    toToken: string,
    amount: string,
    decimals: number
  ): Promise<SwapQuote> {
    try {
      const network = getNetworkConfig(networkId);
      if (!network || !network.chainId) {
        throw new Error('Network not found or invalid chain ID');
      }

      const chainId = network.chainId;
      const apiKey = process.env.ONEINCH_API_KEY || '';
      const baseUrl = DEX_AGGREGATORS.ONEINCH.mainnet;

      // Convert to smallest unit
      const amountInSmallestUnit = ethers.parseUnits(amount, decimals).toString();

      // Get quote
      const quoteUrl = `${baseUrl}/${chainId}/quote`;
      const quoteParams = {
        fromTokenAddress: fromToken === 'native' ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeeE' : fromToken,
        toTokenAddress: toToken === 'native' ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeeE' : toToken,
        amount: amountInSmallestUnit,
      };

      const quoteResponse = await axios.get(quoteUrl, {
        params: quoteParams,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });

      const quote = quoteResponse.data;

      return {
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: ethers.formatUnits(quote.toTokenAmount, quote.toToken.decimals),
        estimatedGas: quote.estimatedGas || '0',
        gasPrice: quote.gasPrice || '0',
        priceImpact: parseFloat(quote.estimatedGas || '0') / 100,
        route: quote,
      };
    } catch (error: any) {
      logger.error('1inch quote error:', error);
      throw new Error(`Failed to get swap quote: ${error.message}`);
    }
  }

  /**
   * Get swap transaction data from 1inch API
   */
  private async get1inchSwapTx(
    networkId: string,
    fromAddress: string,
    fromToken: string,
    toToken: string,
    amount: string,
    slippage: number,
    decimals: number
  ): Promise<any> {
    try {
      const network = getNetworkConfig(networkId);
      if (!network || !network.chainId) {
        throw new Error('Network not found or invalid chain ID');
      }

      const chainId = network.chainId;
      const apiKey = process.env.ONEINCH_API_KEY || '';
      const baseUrl = DEX_AGGREGATORS.ONEINCH.mainnet;

      // Convert to smallest unit
      const amountInSmallestUnit = ethers.parseUnits(amount, decimals).toString();

      // Get swap transaction
      const swapUrl = `${baseUrl}/${chainId}/swap`;
      const swapParams = {
        fromTokenAddress: fromToken === 'native' ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeeE' : fromToken,
        toTokenAddress: toToken === 'native' ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeeE' : toToken,
        amount: amountInSmallestUnit,
        fromAddress: fromAddress,
        slippage: slippage,
        disableEstimate: false,
      };

      const swapResponse = await axios.get(swapUrl, {
        params: swapParams,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });

      return swapResponse.data;
    } catch (error: any) {
      logger.error('1inch swap tx error:', error);
      throw new Error(`Failed to get swap transaction: ${error.message}`);
    }
  }

  /**
   * Execute swap using 1inch
   */
  async swap(params: SwapParams): Promise<{
    txHash: string;
    networkId: string;
    status: string;
    fromAmount: string;
    toAmount: string;
  }> {
    try {
      // Validate network is EVM
      if (!isEVMNetwork(params.networkId)) {
        throw new Error('Swap is only supported on EVM networks');
      }

      // Validate inputs
      if (!validateAddress(params.fromAddress, params.networkId)) {
        throw new Error('Invalid from address');
      }
      if (!validateAmount(params.amount)) {
        throw new Error('Invalid amount');
      }

      const slippage = params.slippage || 1; // Default 1% slippage

      // Get network config
      const network = getNetworkConfig(params.networkId);
      if (!network) {
        throw new Error('Network not found');
      }

      // Determine token decimals
      let fromDecimals = network.nativeCurrency.decimals;
      if (params.fromToken !== 'native') {
        // Get token decimals from provider
        const provider = multiChainService.getProvider(params.networkId);
        try {
          const tokenInfo = await provider.getTokenBalance(params.fromAddress, params.fromToken);
          fromDecimals = tokenInfo.decimals;
        } catch {
          fromDecimals = 18; // Default
        }
      }

      // Check balance
      if (params.fromToken === 'native') {
        const balance = await balanceService.getNativeBalance(
          params.fromAddress,
          params.networkId,
          false
        );
        if (parseFloat(balance.balance) < parseFloat(params.amount)) {
          throw new Error('Insufficient balance');
        }
      } else {
        const balance = await balanceService.getTokenBalance(
          params.fromAddress,
          params.networkId,
          params.fromToken,
          false
        );
        if (parseFloat(balance.balance) < parseFloat(params.amount)) {
          throw new Error('Insufficient token balance');
        }
      }

      // Get swap quote
      const quote = await this.get1inchQuote(
        params.networkId,
        params.fromToken,
        params.toToken,
        params.amount,
        fromDecimals
      );

      // Get swap transaction data
      const swapTx = await this.get1inchSwapTx(
        params.networkId,
        params.fromAddress,
        params.fromToken,
        params.toToken,
        params.amount,
        slippage,
        fromDecimals
      );

      // Get wallet and decrypt private key
      const wallet = await Wallet.findOne({ userId: params.userId });
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const walletAddress = wallet.addresses?.find(
        (addr) => addr.address === params.fromAddress && addr.networkId === params.networkId
      );
      if (!walletAddress) {
        throw new Error('Address not found in wallet');
      }

      const password = process.env.WALLET_ENCRYPTION_KEY || 'default_password_change_in_prod';
      const walletInstance = await ethers.Wallet.fromEncryptedJson(
        walletAddress.encryptedPrivateKey,
        password
      );

      // Get provider
      const provider = multiChainService.getProvider(params.networkId);
      const networkProvider = (provider as any).provider || (provider as any).getProvider();
      const signer = walletInstance.connect(await networkProvider);

      // Execute swap transaction
      const txResponse = await signer.sendTransaction({
        to: swapTx.to,
        data: swapTx.data,
        value: swapTx.value || '0',
        gasLimit: swapTx.gas || 300000,
        gasPrice: swapTx.gasPrice,
      });

      // Wait for transaction
      const receipt = await txResponse.wait();

      // Save transaction to database
      const transaction = await Transaction.create({
        txHash: txResponse.hash,
        networkId: params.networkId,
        blockNumber: receipt?.blockNumber,
        blockHash: receipt?.blockHash,
        blockTimestamp: new Date(),
        from: params.fromAddress,
        to: swapTx.to,
        value: '0',
        gasUsed: receipt?.gasUsed ? parseInt(receipt.gasUsed.toString()) : undefined,
        gasPrice: swapTx.gasPrice,
        confirmations: receipt?.confirmations || 0,
        type: 'SWAP',
        status: receipt?.status === 1 ? 'CONFIRMED' : 'FAILED',
        swapFromToken: params.fromToken,
        swapToToken: params.toToken,
        swapFromAmount: params.amount,
        swapToAmount: quote.toAmount,
        swapDex: '1inch',
      });

      // Publish event
      await publishEvent('transaction.created', {
        txHash: txResponse.hash,
        networkId: params.networkId,
        type: 'SWAP',
        userId: params.userId,
      });

      // Update wallet balance cache
      await balanceService.updateWalletBalance(
        params.userId,
        params.networkId,
        params.fromAddress
      );

      logger.info('Swap completed:', {
        txHash: txResponse.hash,
        networkId: params.networkId,
        fromToken: params.fromToken,
        toToken: params.toToken,
      });

      return {
        txHash: txResponse.hash,
        networkId: params.networkId,
        status: receipt?.status === 1 ? 'confirmed' : 'failed',
        fromAmount: params.amount,
        toAmount: quote.toAmount,
      };
    } catch (error: any) {
      logger.error('Swap error:', error);
      throw new Error(`Failed to execute swap: ${error.message}`);
    }
  }

  /**
   * Get swap quote without executing
   */
  async getQuote(params: {
    networkId: string;
    fromToken: string;
    toToken: string;
    amount: string;
  }): Promise<SwapQuote> {
    try {
      if (!isEVMNetwork(params.networkId)) {
        throw new Error('Swap is only supported on EVM networks');
      }

      const network = getNetworkConfig(params.networkId);
      if (!network) {
        throw new Error('Network not found');
      }

      let fromDecimals = network.nativeCurrency.decimals;
      if (params.fromToken !== 'native') {
        // Try to get decimals from popular tokens
        const popularToken = POPULAR_TOKENS[params.networkId]?.[params.fromToken];
        if (popularToken) {
          fromDecimals = popularToken.decimals;
        } else {
          fromDecimals = 18; // Default
        }
      }

      return await this.get1inchQuote(
        params.networkId,
        params.fromToken,
        params.toToken,
        params.amount,
        fromDecimals
      );
    } catch (error: any) {
      logger.error('Get quote error:', error);
      throw new Error(`Failed to get swap quote: ${error.message}`);
    }
  }
}

export default new SwapService();



