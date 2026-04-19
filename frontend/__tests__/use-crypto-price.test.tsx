import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useCryptoPrice } from '@/lib/hooks/useCryptoPrice';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  send = jest.fn();
  close = jest.fn();

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }
}

describe('useCryptoPrice', () => {
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    // @ts-expect-error test mock
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    jest.restoreAllMocks();
  });

  it('does not reconnect when rerendered with a new array instance containing the same symbols', () => {
    const { rerender } = renderHook(
      ({ symbols }) => useCryptoPrice(symbols),
      { initialProps: { symbols: ['BTCUSDT', 'ETHUSDT'] } },
    );

    expect(MockWebSocket.instances).toHaveLength(1);

    rerender({ symbols: ['BTCUSDT', 'ETHUSDT'] });

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('captures websocket errors without logging noisy console errors', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useCryptoPrice(['BTCUSDT']));

    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.onerror?.(new Event('error'));
    });

    expect(result.current.error).toBe('WebSocket connection error');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
