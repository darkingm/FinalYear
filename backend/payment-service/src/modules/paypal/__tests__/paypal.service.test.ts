import { PayPalService, getPayPalDiagnostic, resolvePayPalAmountUsd } from '../paypal.service';

jest.mock('../../../config/database', () => ({
  mainQuery: jest.fn(),
  query: jest.fn(),
}));

jest.mock('../../../config/rabbitmq', () => ({
  publishEvent: jest.fn(),
}));

describe('PayPalService diagnostics', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...OLD_ENV,
      PAYPAL_CLIENT_ID: 'sandbox-client-id',
      PAYPAL_SECRET: 'sandbox-secret-value',
      PAYPAL_MODE: 'sandbox',
    };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('extracts PayPal auth failure details without leaking credentials', () => {
    const diagnostic = getPayPalDiagnostic({
      statusCode: 401,
      headers: { 'paypal-debug-id': 'debug-123' },
      message: '{"error":"invalid_client","error_description":"Client Authentication failed"}',
      _originalError: {
        text: '{"error":"invalid_client","error_description":"Client Authentication failed"}',
      },
    });

    expect(diagnostic).toMatchObject({
      statusCode: 401,
      paypalDebugId: 'debug-123',
      paypalError: 'invalid_client',
      paypalErrorDescription: 'Client Authentication failed',
      configuredMode: 'sandbox',
      clientIdLength: 'sandbox-client-id'.length,
      secretLength: 'sandbox-secret-value'.length,
    });
    expect(JSON.stringify(diagnostic)).not.toContain('sandbox-client-id');
    expect(JSON.stringify(diagnostic)).not.toContain('sandbox-secret-value');
  });

  it('returns an operational 502 when PayPal rejects client credentials', () => {
    const service = new PayPalService();
    const paypalError = {
      statusCode: 401,
      message: '{"error":"invalid_client","error_description":"Client Authentication failed"}',
      _originalError: {
        text: '{"error":"invalid_client","error_description":"Client Authentication failed"}',
      },
    };

    const appError = service.toOperationalError(paypalError, 'create_order');

    expect(appError).toMatchObject({
      statusCode: 502,
      isOperational: true,
      message: 'PayPal credentials were rejected. Check PAYPAL_CLIENT_ID, PAYPAL_SECRET, and PAYPAL_MODE.',
    });
  });

  it('prefers final order total and rejects invalid amounts before calling PayPal', () => {
    expect(resolvePayPalAmountUsd({ total_amount: '82.50', price_usd: '75.00' })).toBe('82.50');

    expect(() => resolvePayPalAmountUsd({ total_amount: null, price_usd: null })).toThrow(
      'Order total is invalid for PayPal'
    );
    expect(() => resolvePayPalAmountUsd({ total_amount: '0', price_usd: '0' })).toThrow(
      'Order total is invalid for PayPal'
    );
  });
});
