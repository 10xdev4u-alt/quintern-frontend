const client = require('prom-client');

client.collectDefaultMetrics();

const httpRequestDurationMs = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

const activeRequests = new client.Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
});

// Fastify hook. Tracks in-flight requests and the latency of every completed
// request. Cards from /metrics now reflect real data instead of an empty
// histogram.
async function trackHttpMetrics(request, reply) {
  activeRequests.inc();
  const start = process.hrtime.bigint();
  reply.raw.on('finish', () => {
    activeRequests.dec();
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const route = request.routerPath || request.routeOptions?.url || request.url;
    httpRequestDurationMs
      .labels(request.method, route, reply.statusCode)
      .observe(elapsedMs);
  });
}

module.exports = {
  register: client.register,
  trackHttpMetrics,
  metricsEndpoint: async (req, reply) => {
    reply.type('text/plain; version=0.0.4');
    return client.register.metrics();
  },
};
