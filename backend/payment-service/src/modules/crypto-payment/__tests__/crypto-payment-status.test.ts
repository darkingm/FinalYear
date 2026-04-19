import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { CryptoPaymentService } from '../crypto-payment.service';
import { mainQuery, query } from '../../../config/database';

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
  mainQuery: jest.fn(),
}));

jest.mock('../../../config/rabbitmq', () => ({
  publishEvent: jest.fn(),
}));

jest.mock('../../pricing/binance.service', () => ({
  BinanceService: jest.fn().mockImplementation(() => ({
    getPrice: jest.fn(),
  })),
}));

const mockedMainQuery = mainQuery as jest.MockedFunction<typeof mainQuery>;
const mockedQuery = query as jest.MockedFunction<typeof query>;

describe('CryptoPaymentService.getPaymentStatus', () => {
  beforeEach(() => {
    mockedMainQuery.mockReset();
    mockedQuery.mockReset();
  });

  it('re-verifies on-chain payments before returning a pending order snapshot', async () => {
    const service = new CryptoPaymentService();
    const verifySpy = jest.spyOn(service, 'verifyTransaction').mockResolvedValue({
      verified: true,
      status: 'confirmed',
      confirmations: 3,
      required_confirmations: 0,
    } as any);

    mockedMainQuery
      .mockResolvedValueOnce({
        rows: [{ order_id: 41, status: 'TX_SUBMITTED', tx_hash: '0xabc', chain_id: 31337 }],
      } as any)
      .mockResolvedValueOnce({
        rows: [{ order_id: 41, status: 'PAID', tx_hash: '0xabc', chain_id: 31337 }],
      } as any);

    mockedQuery
      .mockResolvedValueOnce({
        rows: [{ tx_hash: '0xabc', payment_status: 'pending', confirmations: 0, block_number: null }],
      } as any)
      .mockResolvedValueOnce({
        rows: [{ tx_hash: '0xabc', payment_status: 'confirmed', confirmations: 3, block_number: 123 }],
      } as any);

    const result = await service.getPaymentStatus(41);

    expect(verifySpy).toHaveBeenCalledWith('0xabc');
    expect(result.status).toBe('PAID');
    expect(result.payment_status).toBe('confirmed');
    expect(result.verification_state).toBe('confirmed');
    expect(result.verification_message).toContain('đã được xác nhận');
  });

  it('returns a readable retrying state when verification cannot refresh the chain status', async () => {
    const service = new CryptoPaymentService();
    jest.spyOn(service, 'verifyTransaction').mockRejectedValue(new Error('RPC timeout'));

    mockedMainQuery.mockResolvedValue({
      rows: [{ order_id: 52, status: 'TX_SUBMITTED', tx_hash: '0xdef', chain_id: 97 }],
    } as any);

    mockedQuery.mockResolvedValue({
      rows: [{ tx_hash: '0xdef', payment_status: 'pending', confirmations: 0, block_number: null }],
    } as any);

    const result = await service.getPaymentStatus(52);

    expect(result.status).toBe('TX_SUBMITTED');
    expect(result.verification_state).toBe('retrying');
    expect(result.verification_message).toContain('RPC timeout');
    expect(result.required_confirmations).toBeGreaterThan(0);
  });
});
