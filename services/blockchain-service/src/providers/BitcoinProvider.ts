import * as bitcoin from 'bitcoinjs-lib';
import axios from 'axios';
import { BaseProvider, BalanceResult, TransactionResult, TransactionDetails, TransferParams, GasEstimate } from './BaseProvider';
import { NetworkConfig } from '../config/networks';
import logger from '../utils/logger';

export class BitcoinProvider extends BaseProvider {
  private networkType: bitcoin.Network;

  constructor(network: NetworkConfig) {
    super(network);
    this.networkType = network.isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
  }

  async getBalance(address: string): Promise<BalanceResult> {
    try {
      const response = await axios.get(`${this.network.rpcUrl}/address/${address}`);
      const balance = response.data.chain_stats?.funded_txo_sum || 0;
      const spent = response.data.chain_stats?.spent_txo_sum || 0;
      const satoshiBalance = balance - spent;
      const btcBalance = (satoshiBalance / 100000000).toFixed(8);

      return {
        balance: btcBalance,
        decimals: 8,
        symbol: 'BTC',
      };
    } catch (error: any) {
      logger.error('Bitcoin getBalance error:', error);
      throw new Error(`Failed to get Bitcoin balance: ${error.message}`);
    }
  }

  async getTokenBalance(address: string, tokenAddress: string): Promise<BalanceResult> {
    throw new Error('Bitcoin does not support tokens');
  }

  async transfer(params: TransferParams): Promise<TransactionResult> {
    try {
      // Decrypt private key if needed
      const privateKeyBuffer = Buffer.from(params.privateKey, 'hex');
      const keyPair = bitcoin.ECPair.fromPrivateKey(privateKeyBuffer, { network: this.networkType });

      // Get UTXOs for the address
      const address = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: this.networkType }).address || '';
      const utxos = await this.getUTXOs(address);

      if (utxos.length === 0) {
        throw new Error('No UTXOs available for this address');
      }

      // Build transaction
      const psbt = new bitcoin.Psbt({ network: this.networkType });

      // Add inputs
      let totalInput = 0;
      for (const utxo of utxos) {
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          nonWitnessUtxo: Buffer.from(utxo.txHex, 'hex'),
        });
        totalInput += utxo.value;
      }

      // Calculate amount in satoshis
      const amountSatoshi = Math.floor(parseFloat(params.amount) * 100000000);
      const feeSatoshi = 1000; // Estimated fee
      const change = totalInput - amountSatoshi - feeSatoshi;

      if (change < 0) {
        throw new Error('Insufficient balance');
      }

      // Add outputs
      psbt.addOutput({
        address: params.toAddress,
        value: amountSatoshi,
      });

      if (change > 0) {
        psbt.addOutput({
          address: address,
          value: change,
        });
      }

      // Sign all inputs
      for (let i = 0; i < utxos.length; i++) {
        psbt.signInput(i, keyPair);
      }

      psbt.finalizeAllInputs();

      // Extract and broadcast transaction
      const tx = psbt.extractTransaction();
      const txHex = tx.toHex();
      const txHash = tx.getId();

      // Broadcast transaction
      await this.broadcastTransaction(txHex);

      return {
        txHash,
        confirmations: 0,
        status: 'pending',
      };
    } catch (error: any) {
      logger.error('Bitcoin transfer error:', error);
      throw new Error(`Failed to transfer Bitcoin: ${error.message}`);
    }
  }

  async transferToken(params: any): Promise<TransactionResult> {
    throw new Error('Bitcoin does not support tokens');
  }

  async getTransaction(txHash: string): Promise<TransactionDetails | null> {
    try {
      const response = await axios.get(`${this.network.rpcUrl}/tx/${txHash}`);
      const tx = response.data;

      // Get current block height for confirmations
      const currentBlockResponse = await axios.get(`${this.network.rpcUrl}/blocks/tip/height`);
      const currentBlockHeight = currentBlockResponse.data;
      const confirmations = tx.status.block_height ? currentBlockHeight - tx.status.block_height + 1 : 0;

      // Calculate total output value
      let totalValue = 0;
      for (const vout of tx.vout || []) {
        totalValue += vout.value || 0;
      }

      return {
        txHash: tx.txid,
        from: tx.vin?.[0]?.prevout?.scriptpubkey_address || '',
        to: tx.vout?.[0]?.scriptpubkey_address || '',
        value: (totalValue / 100000000).toFixed(8),
        blockNumber: tx.status.block_height,
        blockHash: tx.status.block_hash,
        confirmations,
        status: confirmations > 0 ? 'confirmed' : 'pending',
        timestamp: tx.status.block_time ? new Date(tx.status.block_time * 1000) : undefined,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Bitcoin getTransaction error:', error);
      throw new Error(`Failed to get Bitcoin transaction: ${error.message}`);
    }
  }

  async getTransactionReceipt(txHash: string): Promise<any> {
    return this.getTransaction(txHash);
  }

  async estimateGas(params: Partial<TransferParams>): Promise<GasEstimate> {
    // Bitcoin uses fee rate (sat/vB) instead of gas
    const feeRate = await this.getFeeRate();
    return {
      gasLimit: '0',
      gasPrice: feeRate.toString(),
    };
  }

  async getGasPrice(): Promise<string> {
    const feeRate = await this.getFeeRate();
    return feeRate.toString();
  }

  async getTransactionCount(address: string): Promise<number> {
    try {
      const response = await axios.get(`${this.network.rpcUrl}/address/${address}/txs`);
      return response.data.length || 0;
    } catch (error: any) {
      logger.error('Bitcoin getTransactionCount error:', error);
      return 0;
    }
  }

  validateAddress(address: string): boolean {
    try {
      bitcoin.address.toOutputScript(address, this.networkType);
      return true;
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

  async waitForConfirmation(txHash: string, minConfirmations: number = 1, timeout: number = 600000): Promise<TransactionDetails> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const tx = await this.getTransaction(txHash);
      if (tx && tx.confirmations >= minConfirmations) {
        return tx;
      }
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
    }
    throw new Error('Transaction confirmation timeout');
  }

  private async getUTXOs(address: string): Promise<Array<{ txid: string; vout: number; value: number; txHex: string }>> {
    try {
      const response = await axios.get(`${this.network.rpcUrl}/address/${address}/utxo`);
      const utxos = [];

      for (const utxo of response.data || []) {
        const txResponse = await axios.get(`${this.network.rpcUrl}/tx/${utxo.txid}/hex`);
        utxos.push({
          txid: utxo.txid,
          vout: utxo.vout,
          value: utxo.value,
          txHex: txResponse.data,
        });
      }

      return utxos;
    } catch (error: any) {
      logger.error('Bitcoin getUTXOs error:', error);
      throw new Error(`Failed to get UTXOs: ${error.message}`);
    }
  }

  private async broadcastTransaction(txHex: string): Promise<string> {
    try {
      const response = await axios.post(`${this.network.rpcUrl}/tx`, txHex, {
        headers: { 'Content-Type': 'text/plain' },
      });
      return response.data;
    } catch (error: any) {
      logger.error('Bitcoin broadcastTransaction error:', error);
      throw new Error(`Failed to broadcast transaction: ${error.message}`);
    }
  }

  private async getFeeRate(): Promise<number> {
    try {
      const response = await axios.get(`${this.network.rpcUrl}/fee-estimates`);
      // Return medium priority fee rate (6 blocks)
      return Math.ceil(response.data['6'] || 1);
    } catch (error: any) {
      logger.error('Bitcoin getFeeRate error:', error);
      return 1; // Default fee rate
    }
  }
}



