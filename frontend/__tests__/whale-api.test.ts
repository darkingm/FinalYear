import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { __resetWhaleApiCaches, fetchTokenTransfers, fetchWalletTxs } from '@/lib/whale-api';

function createJsonResponse(payload: unknown) {
  return {
    json: async () => payload,
  } as Response;
}

describe('whale-api caching and fallback', () => {
  beforeEach(() => {
    __resetWhaleApiCaches();
    jest.restoreAllMocks();
    Object.defineProperty(globalThis, 'fetch', {
      writable: true,
      configurable: true,
      value: jest.fn(),
    });
  });

  it('deduplicates concurrent explorer requests for the same token transfer query', async () => {
    const fetchMock = jest.fn(async () =>
      createJsonResponse({
        status: '1',
        result: [
          {
            hash: '0xhash',
            from: '0xfrom',
            to: '0xto',
            value: '1000000000000000000',
            tokenDecimal: '18',
            tokenSymbol: 'USDT',
            contractAddress: '0xtoken',
            timeStamp: '1710000000',
            blockNumber: '123',
          },
        ],
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const [first, second] = await Promise.all([
      fetchTokenTransfers('0xabc', 'ETH', 20),
      fetchTokenTransfers('0xabc', 'ETH', 20),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });

  it('reuses cached explorer results within ttl for identical ETH queries', async () => {
    const fetchMock = jest.fn(async () =>
      createJsonResponse({
        status: '1',
        result: [],
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    await fetchTokenTransfers('0xabc', 'ETH', 20);
    await fetchTokenTransfers('0xabc', 'ETH', 20);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips unsupported explorer proxy calls for BSC native wallet requests', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.binance.com')) {
        return createJsonResponse({ price: '600.0' });
      }
      return createJsonResponse({ status: '1', result: [] });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await fetchWalletTxs('0xabc', 'BSC', 20);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.binance.com');
  });
});
