const os = require("os");

/**
 * Turns a project id into a stable numeric seed, so the same project
 * always drifts the same "direction" instead of jumping around randomly
 * between requests.
 */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0; // force 32-bit int
    }
    return Math.abs(hash);
}

/**
 * A smooth, time-based wobble (not pure random) so consecutive polls
 * of the same project drift naturally instead of jittering wildly.
 */
function wobble(seed, amplitude, periodMs = 4000) {
    const t = Date.now() / periodMs;
    return Math.sin(seed + t) * amplitude;
}

function formatUptime(totalSeconds) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours || days) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(" ");
}

function bytesToGB(bytes) {
    return Number((bytes / 1024 ** 3).toFixed(2));
}

/**
 * Returns a metrics snapshot for a given project.
 *
 * This reads real host-level stats via Node's `os` module. Since Monitorly
 * doesn't yet have per-server agents reporting in, each project's reading is
 * derived from this host with a small, per-project deterministic variance —
 * swap the internals of this function for real per-server data (e.g. from an
 * agent, SSH check, or a metrics DB) once that exists. The shape of the
 * returned object is what the front end depends on, so keep it stable.
 */
function getMetrics() {
    const seed = hashString('dd') % 1000;

    const cpuCount = os.cpus().length;
    const [load1, load5, load15] = os.loadavg();

    const totalMem = os.totalmem();
    const freeMemRaw = os.freemem();

    // Simulate this project's host having slightly different memory pressure.
    const memoryDrift = wobble(seed, totalMem * 0.03);
    const freeMem = Math.min(totalMem, Math.max(0, freeMemRaw - memoryDrift));
    const usedMem = totalMem - freeMem;

    const rawCpuPercent = (load1 / cpuCount) * 100 + wobble(seed + 1, 8);
    const cpuLoadPercent = Math.min(100, Math.max(1, rawCpuPercent));

    const usedPercent = (usedMem / totalMem) * 100;

    let status = "online";
    if (cpuLoadPercent > 90 || usedPercent > 95) {
        status = "offline";
    } else if (cpuLoadPercent > 70 || usedPercent > 85) {
        status = "degraded";
    }

    return {
        status,
        hostname: os.hostname(),
        platform: `${os.platform()} (${os.arch()})`,
        cpu: {
            cores: cpuCount,
            loadPercent: Number(cpuLoadPercent.toFixed(1)),
            loadAverage: {
                "1m": Number(load1.toFixed(2)),
                "5m": Number(load5.toFixed(2)),
                "15m": Number(load15.toFixed(2))
            }
        },
        memory: {
            totalGB: bytesToGB(totalMem),
            usedGB: bytesToGB(usedMem),
            freeGB: bytesToGB(freeMem),
            usedPercent: Number(usedPercent.toFixed(1))
        },
        uptime: {
            seconds: Math.round(os.uptime()),
            formatted: formatUptime(os.uptime())
        },
        timestamp: new Date().toISOString(),
        cpuThreshold: process.env.CPU_THRESHOLD || 70,
        memoryThreshold: process.env.MEMORY_THRESHOLD || 80
    };
}

module.exports = { getMetrics };