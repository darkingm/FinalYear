import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CryptoPaymentService } from '../crypto-payment.service';
import { mainQuery, query } from '../../../config/database';
import { PAYMENT_EVENT_TYPES } from '../payment-event.contract';

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

describe('CryptoPaymentService.expireStalePayments', () => {
  beforeEach(() => {
    mockedMainQuery.mockReset();
    mockedQuery.mockReset();
  });

  it('expires stale pending crypto payments that still have no receipt', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          payment_id: 11,
          order_id: 42,
          tx_hash: '0xabc',
          chain_id: 31337,
          status: 'pending',
          created_at: new Date('2026-04-19T10:00:00.000Z'),
          updated_at: new Date('2026-04-19T10:05:00.000Z'),
          block_number: null,
          block_timestamp: null,
        },
        {
          payment_id: 12,
          order_id: 43,
          tx_hash: '0xabc',
          chain_id: 31337,
          status: 'pending',
          created_at: new Date('2026-04-19T10:00:00.000Z'),
          updated_at: new Date('2026-04-19T10:05:00.000Z'),
          block_number: null,
          block_timestamp: null,
        },
      ],
    } as any);

    mockedMainQuery
      .mockResolvedValueOnce({
        rows: [
          { order_id: 42, status: 'TX_SUBMITTED' },
          { order_id: 43, status: 'TX_SUBMITTED' },
        ],
      } as any)
      .mockResolvedValueOnce({
        rows: [
          { order_id: 42, status: 'TX_FAILED' },
          { order_id: 43, status: 'TX_FAILED' },
        ],
      } as any);

    const service = new CryptoPaymentService();
    const recordTransition = jest.fn(async () => ({}));
    (service as any).paymentEventService = { recordTransition };

    const result = await service.expireStalePayments({
      olderThanMinutes: 60,
      source: 'worker',
    });

    expect(recordTransition).toHaveBeenCalledTimes(2);
    expect(recordTransition).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderId: 42,
        paymentId: 11,
        txHash: '0xabc',
        eventType: PAYMENT_EVENT_TYPES.EXPIRED,
        toState: 'failed',
      })
    );
    expect(mockedMainQuery).toHaveBeenLastCalledWith(
      expect.stringContaining("SET status = 'TX_FAILED'"),
      [[42, 43]]
    );
    // Verify payments table is also marked failed (prevents TxMonitorWorker re-processing)
    expect(mockedQuery).toHaveBeenLastCalledWith(
      expect.stringContaining("SET status = 'failed'"),
      [[11, 12]]
    );
    expect(result).toEqual({
      expired_payment_count: 2,
      expired_order_count: 2,
      expired_order_ids: [42, 43],
      skipped_order_ids: [],
    });
  });

  it('does not expire stale payment rows for orders that already moved past submitted state', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          payment_id: 11,
          order_id: 42,
          tx_hash: '0xabc',
          chain_id: 31337,
          status: 'pending',
          created_at: new Date('2026-04-19T10:00:00.000Z'),
          updated_at: new Date('2026-04-19T10:05:00.000Z'),
          block_number: null,
          block_timestamp: null,
        },
      ],
    } as any);

    mockedMainQuery.mockResolvedValueOnce({
      rows: [{ order_id: 42, status: 'PAID' }],
    } as any);

    const service = new CryptoPaymentService();
    const recordTransition = jest.fn(async () => ({}));
    (service as any).paymentEventService = { recordTransition };

    const result = await service.expireStalePayments({
      olderThanMinutes: 60,
      source: 'manual',
    });

    expect(recordTransition).not.toHaveBeenCalled();
    expect(result).toEqual({
      expired_payment_count: 0,
      expired_order_count: 0,
      expired_order_ids: [],
      skipped_order_ids: [42],
    });
  });
});
