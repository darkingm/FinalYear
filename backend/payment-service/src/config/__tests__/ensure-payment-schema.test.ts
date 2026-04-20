import { ensurePaymentEventInfrastructure } from '../ensure-payment-schema';

describe('ensurePaymentEventInfrastructure', () => {
  it('creates the event-driven payment tables and helpers idempotently', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });

    await ensurePaymentEventInfrastructure({ query } as any);

    const executedSql = query.mock.calls.map(([sql]) => String(sql)).join('\n');

    expect(executedSql).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    expect(executedSql).toContain('ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type');
    expect(executedSql).toContain('ALTER TABLE payments ADD COLUMN IF NOT EXISTS from_address');
    expect(executedSql).toContain('ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmations');
    expect(executedSql).toContain('CREATE TABLE IF NOT EXISTS payment_sessions');
    expect(executedSql).toContain('CREATE TABLE IF NOT EXISTS payment_outbox');
    expect(executedSql).toContain('ALTER TABLE payment_outbox ADD COLUMN IF NOT EXISTS locked_at');
    expect(executedSql).toContain('ALTER TABLE payment_outbox ADD COLUMN IF NOT EXISTS locked_by');
    expect(executedSql).toContain('CREATE TABLE IF NOT EXISTS payment_batch_sessions');
    expect(executedSql).toContain('CREATE OR REPLACE FUNCTION update_updated_at_column()');
    expect(executedSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_tx_hash_unique');
  });
});
