import axios from 'axios';
import { PaymentReconciliationAdminService } from '../payment-reconciliation.service';

jest.mock('axios');
jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const { query } = jest.requireMock('../../../config/database') as { query: jest.Mock };

describe('PaymentReconciliationAdminService', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    query.mockReset();
    process.env.INTERNAL_SERVICE_KEY = 'internal-test-key';
    process.env.PAYMENT_SERVICE_URL = 'http://payment-service:3002';
  });

  it('calls payment-service reconciliation endpoint with internal key header', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        success: true,
        cases: [{ order_id: 42, has_issue: true }],
      },
    } as any);

    const service = new PaymentReconciliationAdminService();
    const cases = await service.listCases({ limit: 25, problemsOnly: true });

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://payment-service:3002/api/payments/crypto/admin/reconciliation',
      expect.objectContaining({
        headers: { 'X-Internal-Service-Key': 'internal-test-key' },
        params: { limit: 25, problems_only: 'true' },
      })
    );
    expect(cases).toEqual([{ order_id: 42, has_issue: true }]);
  });

  it('repairs stale order status from confirmed payment snapshot', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        success: true,
        cases: [{
          order_id: 42,
          order_status: 'TX_SUBMITTED',
          payment_status: 'confirmed',
          payment_tx_hash: '0xabc',
          has_issue: true,
        }],
      },
    } as any);
    query.mockResolvedValue({
      rows: [{
        order_id: 42,
        status: 'PAID',
        tx_hash: '0xabc',
        payment_projection_version: 2,
        payment_projection_updated_at: new Date('2026-04-19T12:00:00.000Z'),
      }],
    });

    const service = new PaymentReconciliationAdminService({
      now: () => new Date('2026-04-19T12:00:00.000Z'),
    });
    const result = await service.repairOrderState(42);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE orders'),
      expect.arrayContaining([42, 'PAID', '0xabc', expect.any(Date)])
    );
    expect(result.next_status).toBe('PAID');
    expect(result.source_payment_status).toBe('confirmed');
  });

  it('aggregates payment ops health with internal key header', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          success: true,
          health: {
            rabbitmq: { status: 'connected' },
            outbox: {
              pending_count: 4,
              retrying_count: 1,
              oldest_pending_at: '2026-04-20T04:00:00.000Z',
              last_published_at: '2026-04-20T04:05:00.000Z',
            },
          },
        },
      } as any);
    query.mockResolvedValueOnce({
      rows: [{
        processed_24h: '12',
        last_processed_at: new Date('2026-04-20T04:10:00.000Z'),
      }],
    });
    query.mockResolvedValueOnce({
      rows: [{
        stale_projection_count: '2',
      }],
    });

    const service = new PaymentReconciliationAdminService();
    const health = await service.getOpsHealth();

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://payment-service:3002/api/payments/crypto/admin/ops-health',
      expect.objectContaining({
        headers: { 'X-Internal-Service-Key': 'internal-test-key' },
        timeout: 15000,
      })
    );
    expect(health.payment_service.outbox.pending_count).toBe(4);
    expect(health.main_service.projection.processed_24h).toBe(12);
    expect(health.main_service.projection.stale_projection_count).toBe(2);
  });
});
