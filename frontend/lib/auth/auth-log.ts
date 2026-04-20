type SafeAuthDetail = {
  eventSource?: string;
  reasonCode?: string;
  statusCode?: number | null;
  path?: string;
};

function sanitizeDetail(detail?: SafeAuthDetail) {
  if (!detail) return undefined;

  const next: Record<string, string | number> = {};

  if (detail.eventSource) next.eventSource = detail.eventSource;
  if (detail.reasonCode) next.reasonCode = detail.reasonCode;
  if (typeof detail.statusCode === 'number') next.statusCode = detail.statusCode;
  if (detail.path) next.path = detail.path;

  return Object.keys(next).length > 0 ? next : undefined;
}

export function logAuthEvent(event: string, detail?: SafeAuthDetail) {
  const payload = sanitizeDetail(detail);
  const prefix = `[auth] ${event}`;

  if (process.env.NODE_ENV !== 'production') {
    if (payload) {
      console.warn(prefix, payload);
      return;
    }

    console.warn(prefix);
    return;
  }

  if (payload?.reasonCode || payload?.statusCode) {
    console.warn(prefix, payload);
  } else {
    console.warn(prefix);
  }
}
