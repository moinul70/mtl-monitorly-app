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


// projectId -> { data, fetchedAt, stale, lastError }
const cache = new Map();

// projectId -> interval handle, so we only ever poll each project once
const pollers = new Map();

function buildUrl(projectId, projectBaseUrl) {
    return projectBaseUrl+'/api/metrics/'+encodeURIComponent(projectId);
}

/**
 * Weighs error rate heaviest, then tail latency, then traffic volume.
 */
function criticalityScore({
    errorRatePercent = 0,
    responseMs = 0,
    peakMemoryMb = 0,
    memoryMB = 0
}) {
    return (
        errorRatePercent * 5 +
        responseMs / 50 +
        peakMemoryMb / 10 +
        memoryMB / 10
    );
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
        const avgResponseMs = Number(item.avgResponseMs ?? 0);
        const peakMemoryMb = Number(item.peak_memory_mb ??  0);
        const responseMs = Number(item.response_ms ??  0);
        const errorRatePercent = Number(item.errorRatePercent ?? 0);
        const memoryMB = Number(item.memory_mb ?? 0);

        const endpoint = {
            method: item.method ?? "GET",
            path: item.path ?? item.endpoint ?? "unknown",
            avgResponseMs,
            peakMemoryMb,
            responseMs,
            errorRatePercent,
            userAgent: item.user_agent ?? "unknown",
            statusCode: item.status_code ?? 0,
            memoryMB
        };

        endpoint.criticalScore = Number(criticalityScore(endpoint).toFixed(2));
        return endpoint;
    });

    const mostCritical = endpoints.length
        ? endpoints.reduce((worst, endpoint) =>
            endpoint.criticalScore > worst.criticalScore
                ? endpoint
                : worst
        )
        : null;
        const avgResponseMs = raw.avgResponseMs;
        const errorRatePercent = raw.errorRatePercent;

    return {
        projectId,
        endpoints,
        mostCritical,
        avgResponseMs,
        errorRatePercent,
        timestamp: new Date().toISOString()
    };
}

async function fetchFromExternalApi(projectId,projectBaseUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(buildUrl(projectId,projectBaseUrl), { signal: controller.signal });

        if (!response.ok) {
            throw new Error(`External API responded with ${response.status}`);
        }

        const raw = await response.json();
        // console.log(`Fetched external metrics for project ${projectId}:`, raw);
        return normalizeResponse(raw, projectId);
    } finally {
        clearTimeout(timeout);
    }
}

async function refreshProjectMetrics(projectId,projectBaseUrl) {
    try {
        const data = await fetchFromExternalApi(projectId,projectBaseUrl);
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

function ensurePolling(projectId,projectBaseUrl) {
    if (pollers.has(projectId)) return;

    const interval = setInterval(() => refreshProjectMetrics(projectId,projectBaseUrl), POLL_INTERVAL_MS);
    pollers.set(projectId, interval);
}

/**
 * Returns the latest cached snapshot for a project, triggering the first
 * fetch (and starting its recurring poll) if this project hasn't been
 * requested before.
 */
async function getApiMetrics(projectId, projectBaseUrl) {
    cache.delete(projectId);
    if (!cache.has(projectId)) {
        await refreshProjectMetrics(projectId,projectBaseUrl); // first request waits for real data
    }

    ensurePolling(projectId,projectBaseUrl); // subsequent updates happen in the background every 10s

    const entry = cache.get(projectId);
    return { ...entry.data, stale: entry.stale, lastError: entry.lastError, fetchedAt: entry.fetchedAt, FETCH_TIMEOUT_MS };
}

module.exports = { getApiMetrics };