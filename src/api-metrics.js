/**
 * API metrics — external source
 * -------------------------------
 * Pulls per-endpoint stats (response time, memory, error rate) from an
 * external monitoring API, one call per project:
 *
 *   GET {EXTERNAL_API_BASE_URL with {projectId} substituted}
 *
 * Data is cached in memory and refreshed on a 10-second interval per
 * project, rather than fetched fresh on every dashboard request — so the
 * dashboard reads from cache (instant) while a background timer keeps it
 * current, and a slow/down external API never blocks a page load.
 */

require("dotenv").config();
const POLL_INTERVAL_MS = 10000;
const FETCH_TIMEOUT_MS = process.env.FETCH_TIMEOUT_MS ? Number(process.env.FETCH_TIMEOUT_MS) : 5000;


// TODO: set this to your real external API. Supports a {projectId} token,
// e.g. "https://monitoring.example.com/v1/metrics/{projectId}"
const EXTERNAL_API_BASE_URL =
    process.env.EXTERNAL_METRICS_API_URL || "https://your-monitoring-service.example.com/metrics/{projectId}";

// projectId -> { data, fetchedAt, stale, lastError }
const cache = new Map();

// projectId -> interval handle, so we only ever poll each project once
const pollers = new Map();

function buildUrl(projectId) {
    return EXTERNAL_API_BASE_URL+'/'+encodeURIComponent(projectId);
}

/**
 * Weighs error rate heaviest, then tail latency, then traffic volume.
 */
function criticalityScore({ errorRatePercent, p95ResponseMs, requestsPerMin }) {
    return errorRatePercent * 5 + p95ResponseMs / 50 + requestsPerMin / 100;
}

/**
 * Maps the external API's response into the shape the dashboard expects.
 *
 * TODO: this assumes `raw.endpoints` is an array and tries a few common
 * field-name variants for each stat. Once you share the real response
 * shape, tighten this to match exactly instead of guessing across variants.
 */
function normalizeResponse(raw, projectId) {
    const rawEndpoints = Array.isArray(raw?.endpoints) ? raw.endpoints : Array.isArray(raw) ? raw : [];

    const endpoints = rawEndpoints.map((item) => {
        const avgResponseMs = Number(item.avgResponseMs ?? item.avgResponseTime ?? item.avg_response_ms ?? 0);
        const p95ResponseMs = Number(item.p95ResponseMs ?? item.p95 ?? item.response_ms ?? avgResponseMs);
        const requestsPerMin = Number(item.requestsPerMin ?? item.requestsPerMinute ?? item.requests_per_min ?? 0);
        const errorRatePercent = Number(item.errorRatePercent ?? item.errorRate ?? item.error_rate ?? 0);
        const memoryMB = Number(item.memoryMB ?? item.memoryUsageMb ?? item.memory_mb ?? 0);

        const endpoint = {
            method: item.method ?? "GET",
            path: item.path ?? item.endpoint ?? "unknown",
            avgResponseMs,
            p95ResponseMs,
            requestsPerMin,
            errorRatePercent,
            memoryMB
        };

        endpoint.criticalScore = Number(criticalityScore(endpoint).toFixed(2));
        return endpoint;
    });

    const mostCritical =
        endpoints.length > 0
            ? endpoints.reduce((worst, ep) => (ep.criticalScore > worst.criticalScore ? ep : worst), endpoints[0])
            : null;

    return {
        projectId,
        endpoints,
        mostCritical,
        timestamp: new Date().toISOString()
    };
}

async function fetchFromExternalApi(projectId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
console.log(`Fetching external metrics for project ${projectId} from ${buildUrl(projectId)}`);
    try {
        const response = await fetch(buildUrl(projectId), { signal: controller.signal });

        if (!response.ok) {
            throw new Error(`External API responded with ${response.status}`);
        }

        const raw = await response.json();
        console.log(`Fetched external metrics for project ${projectId}:`, raw);
        return normalizeResponse(raw, projectId);
    } finally {
        clearTimeout(timeout);
    }
}

async function refreshProjectMetrics(projectId) {
    try {
        const data = await fetchFromExternalApi(projectId);
        cache.set(projectId, { data, fetchedAt: Date.now(), stale: false, lastError: null });
    } catch (err) {
        const existing = cache.get(projectId);
        // Keep serving the last known-good snapshot if we have one; a
        // single failed poll shouldn't blank out the dashboard.
        cache.set(projectId, {
            data: existing ? existing.data : { projectId, endpoints: [], mostCritical: null, timestamp: null },
            fetchedAt: existing ? existing.fetchedAt : null,
            stale: true,
            lastError: err.message
        });
    }
}

function ensurePolling(projectId) {
    if (pollers.has(projectId)) return;

    const interval = setInterval(() => refreshProjectMetrics(projectId), POLL_INTERVAL_MS);
    pollers.set(projectId, interval);
}

/**
 * Returns the latest cached snapshot for a project, triggering the first
 * fetch (and starting its recurring poll) if this project hasn't been
 * requested before.
 */
async function getApiMetrics(projectId) {
    cache.delete(projectId);
    if (!cache.has(projectId)) {
        await refreshProjectMetrics(projectId); // first request waits for real data
    }

    ensurePolling(projectId); // subsequent updates happen in the background every 10s

    const entry = cache.get(projectId);
    return { ...entry.data, stale: entry.stale, lastError: entry.lastError, fetchedAt: entry.fetchedAt, FETCH_TIMEOUT_MS };
}

module.exports = { getApiMetrics };