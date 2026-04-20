import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CryptoPaymentService } from '../crypto-payment.service';
import { mainQuery, query } from '../../../config/database';
import type { PaymentSessionRecord } from '../payment-session.service';

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

describe('CryptoPaymentService.submitTransactionWithSession', () => {
  beforeEach(() => {
    mockedMainQuery.mockReset();
    mockedQuery.mockReset();
  });

  it('does not query missing orders.buyer_wallet and prefers the wallet bound into the session quote', async () => {
    const service = new CryptoPaymentService();
    const recordSubmitted = jest.fn(async () => ({
      payment: { payment_id: 1 },
      outboxEvent: { event_type: 'payment.submitted' },
    }));
    (service as any).paymentEventService = {
      recordSubmitted,
    };

    mockedMainQuery.mockImplementation(async (text: string) => {
      if (text.includes('FROM orders')) {
        expect(text).toContain('u.wallet_address AS buyer_wallet_address');
        expect(text).not.toContain('buyer_wallet,');

        return {
          rows: [
            {
              order_id: 41,
              buyer_id: 7,
              buyer_wallet_address: '0x1111111111111111111111111111111111111111',
              status: 'UNPAID',
              chain_id: 31337,
              token_id: 12,
              amount_token: '75',
              escrow_contract: '0x2222222222222222222222222222222222222222',
              tx_hash: null,
            },
          ],
        } as any;
      }

      if (text.includes('UPDATE orders')) {
        return { rows: [] } as any;
      }

      throw new Error(`Unexpected mainQuery: ${text}`);
    });

    const session: PaymentSessionRecord = {
      session_id: 'session-1',
      nonce: 'nonce-1',
      user_id: 7,
      order_id: 41,
      token_symbol: 'USDT',
      chain_id: 31337,
      amount_token: '75',
      quote_snapshot: {
        buyer_wallet: '0x3333333333333333333333333333333333333333',
      },
      status: 'quoted',
      tx_hash: null,
      expires_at: new Date('2026-04-20T02:00:00.000Z'),
      used_at: null,
      created_at: new Date('2026-04-20T01:00:00.000Z'),
      updated_at: new Date('2026-04-20T01:00:00.000Z'),
    };

    await service.submitTransactionWithSession(
      session,
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );

    expect(recordSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 41,
        sessionId: 'session-1',
        userId: 7,
        fromAddress: '0x3333333333333333333333333333333333333333',
        toAddress: '0x2222222222222222222222222222222222222222',
      })
    );
  });

  it('treats a same-hash submit as idempotent when the order already advanced to PAID', async () => {
    const service = new CryptoPaymentService();
    const txHash = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const recordSubmitted = jest.fn(async () => ({
      payment: { payment_id: 2, status: 'confirmed', tx_hash: txHash },
      outboxEvent: { event_type: 'payment.submitted' },
    }));
    (service as any).paymentEventService = {
      recordSubmitted,
    };

    let updateCalled = false;
    mockedMainQuery.mockImplementation(async (text: string) => {
      if (text.includes('FROM orders')) {
        return {
          rows: [
            {
              order_id: 43,
              buyer_id: 7,
              buyer_wallet_address: '0x1111111111111111111111111111111111111111',
              status: 'PAID',
              chain_id: 31337,
              token_id: 12,
              amount_token: '75',
              escrow_contract: '0x2222222222222222222222222222222222222222',
              tx_hash: txHash,
            },
          ],
        } as any;
      }

      if (text.includes('UPDATE orders')) {
        updateCalled = true;
        return { rows: [] } as any;
      }

      throw new Error(`Unexpected mainQuery: ${text}`);
    });

    const session: PaymentSessionRecord = {
      session_id: 'session-2',
      nonce: 'nonce-2',
      user_id: 7,
      order_id: 43,
      token_symbol: 'USDT',
      chain_id: 31337,
      amount_token: '75',
      quote_snapshot: {},
      status: 'quoted',
      tx_hash: null,
      expires_at: new Date('2026-04-20T02:00:00.000Z'),
      used_at: null,
      created_at: new Date('2026-04-20T01:00:00.000Z'),
      updated_at: new Date('2026-04-20T01:00:00.000Z'),
    };

    await expect(service.submitTransactionWithSession(session, txHash)).resolves.toBeUndefined();
    expect(recordSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 43,
        txHash,
      })
    );
    expect(updateCalled).toBe(false);
  });
});
