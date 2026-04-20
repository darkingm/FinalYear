import { ensureMainPaymentProjectionInfrastructure } from '../ensure-main-schema';

describe('ensureMainPaymentProjectionInfrastructure', () => {
  it('creates processed_events and order projection columns idempotently', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });

    await ensureMainPaymentProjectionInfrastructure({ query } as any);

    const executedSql = query.mock.calls.map(([sql]) => String(sql)).join('\n');

    expect(executedSql).toContain('ADD COLUMN IF NOT EXISTS tracking_number');
    expect(executedSql).toContain('ADD COLUMN IF NOT EXISTS release_tx_hash');
    expect(executedSql).toContain('ADD COLUMN IF NOT EXISTS evidence_urls');
    expect(executedSql).toContain('ADD CONSTRAINT disputes_order_id_unique UNIQUE (order_id)');
    expect(executedSql).toContain('CREATE TABLE IF NOT EXISTS processed_events');
    expect(executedSql).toContain('ALTER TABLE orders');
    expect(executedSql).toContain('ADD COLUMN IF NOT EXISTS payment_projection_updated_at');
    expect(executedSql).toContain('ADD COLUMN IF NOT EXISTS payment_projection_version');
    expect(executedSql).toContain('CREATE INDEX IF NOT EXISTS idx_processed_events_type_aggregate');
    expect(executedSql).toContain('CREATE INDEX IF NOT EXISTS idx_orders_release_tx');
  });
});
