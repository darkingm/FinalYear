export interface EscrowOpsHealthSnapshot {
  payment_service: {
    rabbitmq: {
      status: string;
      projection_queue: {
        status: string;
        name: string;
        message_count: number;
        consumer_count: number;
      };
    };
    outbox: {
      pending_count: number;
      retrying_count: number;
      locked_count: number;
      stale_lock_count: number;
      oldest_pending_at: string | null;
      oldest_pending_age_seconds: number | null;
      last_published_at: string | null;
    };
  };
  main_service: {
    rabbitmq: { status: string };
    projection: {
      processed_24h: number;
      last_processed_at: string | null;
      stale_projection_count: number;
    };
  };
}

export interface EscrowHealthCardModel {
  title: string;
  value: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'slate';
}

function toneFromStatus(status: string) {
  return status === 'connected' ? 'emerald' : 'amber';
}

function formatAgeSeconds(value: number | null) {
  if (value === null || value <= 0) {
    return '0m';
  }

  if (value < 60) {
    return `${value}s`;
  }

  const minutes = Math.round(value / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

export function shapeEscrowOpsHealth(snapshot: EscrowOpsHealthSnapshot): EscrowHealthCardModel[] {
  const paymentMqConnected = snapshot.payment_service.rabbitmq.status === 'connected';
  const mainMqConnected = snapshot.main_service.rabbitmq.status === 'connected';
  const staleProjectionCount = snapshot.main_service.projection.stale_projection_count;
  const projectionQueue = snapshot.payment_service.rabbitmq.projection_queue;
  const outbox = snapshot.payment_service.outbox;

  return [
    {
      title: 'Payment RabbitMQ',
      value: paymentMqConnected ? 'Connected' : 'Disconnected',
      detail: outbox.last_published_at
        ? `Last publish ${new Date(outbox.last_published_at).toLocaleTimeString('vi-VN')}`
        : 'No publish timestamp yet',
      tone: toneFromStatus(snapshot.payment_service.rabbitmq.status),
    },
    {
      title: 'Projection Queue',
      value: String(projectionQueue.message_count),
      detail: `${projectionQueue.consumer_count} consumer${projectionQueue.consumer_count === 1 ? '' : 's'}`,
      tone:
        projectionQueue.status === 'healthy'
          ? projectionQueue.message_count > 0
            ? 'amber'
            : 'emerald'
          : 'amber',
    },
    {
      title: 'Outbox Pending',
      value: String(outbox.pending_count),
      detail: `${outbox.retrying_count} retrying • ${outbox.locked_count} locked`,
      tone: outbox.pending_count > 0 ? 'amber' : 'emerald',
    },
    {
      title: 'Outbox Lag',
      value: formatAgeSeconds(outbox.oldest_pending_age_seconds),
      detail: `${outbox.stale_lock_count} stale lock${outbox.stale_lock_count === 1 ? '' : 's'}`,
      tone: (outbox.oldest_pending_age_seconds || 0) > 60 || outbox.stale_lock_count > 0 ? 'amber' : 'emerald',
    },
    {
      title: 'Main RabbitMQ',
      value: mainMqConnected ? 'Connected' : 'Disconnected',
      detail: snapshot.main_service.projection.last_processed_at
        ? `Last event ${new Date(snapshot.main_service.projection.last_processed_at).toLocaleTimeString('vi-VN')}`
        : 'No processed events yet',
      tone: toneFromStatus(snapshot.main_service.rabbitmq.status),
    },
    {
      title: 'Stale Projections',
      value: String(staleProjectionCount),
      detail: `${snapshot.main_service.projection.processed_24h} processed / 24h`,
      tone: staleProjectionCount > 0 ? 'amber' : 'emerald',
    },
  ];
}
