// Load environment variables from .env
require('dotenv').config();

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { performance } = require('perf_hooks');

// --- Configuration ---
const LISTEN_PORT = process.env.PORT || 3000;
const LISTEN_IP = process.env.HOST || 'localhost';  // default localhost
const TARGET_URL = process.env.TARGET_URL;
if (!TARGET_URL) {
  console.error('ERROR: TARGET_URL not set in .env');
  process.exit(1);
}
const target = new URL(TARGET_URL);
console.log(`Configured to forward requests to: ${target.hostname}:${target.pathname}`);
const targetProtocol = target.protocol === 'https:' ? https : http;

// --- Metrics store (in-memory) ---
const metrics = {
  totalRequests: 0,
  endpoints: {},            // path -> { count, statusCodes: {code: count} }
  responseTimes: [],        // store last 1000 response times (ms)
  minTime: Infinity,
  maxTime: 0,
  avgTime: 0,
  inboundIPs: [],           // last 100 client IPs
  outboundHost: target.hostname,
  pathName: target.pathname,
  outboundPort: target.port || (targetProtocol === https ? 443 : 80),
  startTime: Date.now(),
};

// Helper to update metrics
function recordMetrics(req, statusCode, responseTime) {
  const path = req.url.split('?')[0] || '/';
  metrics.totalRequests++;

  // Endpoint stats
  if (!metrics.endpoints[path]) {
    metrics.endpoints[path] = { count: 0, statusCodes: {} };
  }
  metrics.endpoints[path].count++;
  if (!metrics.endpoints[path].statusCodes[statusCode]) {
    metrics.endpoints[path].statusCodes[statusCode] = 0;
  }
  metrics.endpoints[path].statusCodes[statusCode]++;

  // Response times (keep last 1000)
  metrics.responseTimes.push(responseTime);
  if (metrics.responseTimes.length > 1000) metrics.responseTimes.shift();
  if (responseTime < metrics.minTime) metrics.minTime = responseTime;
  if (responseTime > metrics.maxTime) metrics.maxTime = responseTime;
  metrics.avgTime = metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;

  // Inbound IPs (keep last 100)
  const clientIP = req.socket.remoteAddress;
  metrics.inboundIPs.push(clientIP);
  if (metrics.inboundIPs.length > 100) metrics.inboundIPs.shift();
}

// --- Metrics endpoint handler ---
function handleMetrics(req, res) {
  const now = Date.now();
  const uptime = ((now - metrics.startTime) / 1000).toFixed(1);

  // Build a human-readable response (JSON or HTML – here we do JSON)
  const data = {
    uptime_seconds: uptime,
    total_requests: metrics.totalRequests,
    outbound_target: `${metrics.outboundHost}:${metrics.outboundPort}`,
    path_name: metrics.pathName,
    response_times: {
      min_ms: metrics.minTime === Infinity ? 0 : metrics.minTime,
      max_ms: metrics.maxTime,
      avg_ms: Math.round(metrics.avgTime * 100) / 100,
    },
    endpoints: metrics.endpoints,
    recent_inbound_ips: metrics.inboundIPs.slice(-10), // last 10
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

// --- Proxy request handler ---
function forwardRequest(clientReq, clientRes) {
  const startTime = performance.now();

  const targetPath = clientReq.url;
  const targetOptions = {
    hostname: target.hostname,
    port: target.port || (targetProtocol === https ? 443 : 80),
    path: targetPath,
    method: clientReq.method,
    headers: { ...clientReq.headers },
  };
  delete targetOptions.headers['connection'];
  delete targetOptions.headers['transfer-encoding'];
  targetOptions.headers['host'] = target.host;

  // Log outbound details
  console.log(`[PROXY] ${clientReq.method} ${targetPath} -> ${target.hostname}:${targetOptions.port}`);

  const proxyReq = targetProtocol.request(targetOptions, (proxyRes) => {
    const responseTime = performance.now() - startTime;
    const status = proxyRes.statusCode;

    // Record metrics
    recordMetrics(clientReq, status, responseTime);

    // Send response back to client
    clientRes.writeHead(status, proxyRes.headers);
    proxyRes.pipe(clientRes, { end: true });

    console.log(`[PROXY] Response ${status} (${responseTime.toFixed(2)}ms)`);
  });

  proxyReq.on('error', (err) => {
  console.error(`[PROXY ERROR] ${target.hostname}:${targetOptions.port} - ${err.code} (${err.message})`);
  if (!clientRes.headersSent) {
    clientRes.writeHead(502, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({
      error: 'Bad Gateway',
      details: err.code,
      target: `${target.hostname}:${targetOptions.port}`
    }));
  } else {
    clientRes.destroy();
  }
});

  clientReq.pipe(proxyReq, { end: true });
}

// --- Create the server ---
const server = http.createServer((req, res) => {
  // Route metrics endpoint
  if (req.url === '/metrics' && req.method === 'GET') {
    handleMetrics(req, res);
    return;
  }

  // Otherwise, proxy the request
  forwardRequest(req, res);
});

server.listen(LISTEN_PORT, LISTEN_IP, () => {
  console.log(`Middleware server running on ${LISTEN_IP}:${LISTEN_PORT}`);
  console.log(`Forwarding to ${TARGET_URL}`);
  console.log(`Metrics available at http://${LISTEN_IP}:${LISTEN_PORT}/metrics`);
});

