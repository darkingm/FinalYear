const channelMock = {
  assertExchange: jest.fn().mockResolvedValue(undefined),
  assertQueue: jest.fn().mockResolvedValue({ queue: 'main-service.payment-projection' }),
  bindQueue: jest.fn().mockResolvedValue(undefined),
  prefetch: jest.fn().mockResolvedValue(undefined),
  consume: jest.fn().mockResolvedValue(undefined),
  ack: jest.fn(),
  nack: jest.fn(),
  publish: jest.fn(),
};

const createChannel = jest.fn().mockResolvedValue(channelMock);
const connect = jest.fn().mockResolvedValue({
  createChannel,
});

jest.mock('amqplib', () => ({
  __esModule: true,
  default: {
    connect,
  },
}));

describe('rabbitmq config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('binds payment projection consumer to a durable named queue', async () => {
    const { connectRabbitMQ, subscribeToEvents } = await import('../rabbitmq');

    await connectRabbitMQ();
    await (subscribeToEvents as any)(
      ['payment.confirmed', 'payment.failed'],
      jest.fn(),
      { queueName: 'main-service.payment-projection', durable: true, prefetch: 5 }
    );

    expect(channelMock.assertQueue).toHaveBeenCalledWith(
      'main-service.payment-projection',
      { durable: true }
    );
    expect(channelMock.prefetch).toHaveBeenCalledWith(5);
    expect(channelMock.bindQueue).toHaveBeenCalledWith(
      'main-service.payment-projection',
      'marketplace',
      'payment.confirmed'
    );
    expect(channelMock.bindQueue).toHaveBeenCalledWith(
      'main-service.payment-projection',
      'marketplace',
      'payment.failed'
    );
  });
});
