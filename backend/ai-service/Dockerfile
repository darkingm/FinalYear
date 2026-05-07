FROM python:3.11-slim AS builder
WORKDIR /app

# Build deps stay in this stage so the final image only ships installed wheels.
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ─── Production stage ──────────────────────────────────────────────────
FROM python:3.11-slim AS runner
WORKDIR /app

# wget for HEALTHCHECK; tini for proper signal forwarding so SIGTERM kills
# uvicorn cleanly during `docker compose down` (otherwise BusyBox PID 1
# ignores TERM and we wait the full stop_grace_period).
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget tini \
    && rm -rf /var/lib/apt/lists/*

# Non-root user — uid 1001 to match the Node services
RUN groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --shell /sbin/nologin app

# Copy installed packages from builder; PATH adjustment so `uvicorn` is found
COPY --from=builder --chown=app:app /root/.local /home/app/.local
ENV PATH="/home/app/.local/bin:${PATH}"

COPY --chown=app:app . .

USER app

EXPOSE 8000

# /health is implemented in main.py — cheap, no external calls.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --spider --tries=1 http://127.0.0.1:8000/health || exit 1

# 1 worker only — VPS has 2 cores, keep resource usage low
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
