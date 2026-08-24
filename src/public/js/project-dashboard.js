/**
 * Project dashboard
 * ------------------
 * Reads the project id from the URL (/dashboard/:projectId), polls
 * /api/metrics/:projectId, and renders CPU, memory, and uptime stats.
 */

(function () {
    "use strict";

    const POLL_INTERVAL_MS = 5000;
    const HISTORY_LENGTH = 24;
    const PAGE_SIZE = 1;                         //  items per "load more" step

    //  Pagination state
    let currentVisibleCount = PAGE_SIZE;
    let lastData = null;                         // cache last fetched data for re‑render

    function getProjectIdFromUrl() {
        const segments = window.location.pathname.split("/").filter(Boolean);
        return segments[1] || null;
    }

    function humanizeProjectId(projectId) {
        return projectId
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    function buildPolyline(history) {
        const max = Math.max(...history, 1);
        const min = Math.min(...history, 0);
        const range = Math.max(max - min, 1);
        const stepX = 200 / (HISTORY_LENGTH - 1);

        return history
            .map((value, index) => {
                const x = (index * stepX).toFixed(1);
                const normalized = (value - min) / range;
                const y = (36 - normalized * 30 - 2).toFixed(1);
                return `${x},${y}`;
            })
            .join(" ");
    }

    function formatRelativeTime(seconds) {
        if (seconds < 5) return "just now";
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ago`;
    }

    function setStatus(status) {
        const dot = document.getElementById("project-dot");
        const pill = document.getElementById("project-status");
        const card = document.querySelector(".dash-head-top");

        if (card) card.dataset.status = status;
        if (dot) dot.style.setProperty("--status", `var(--${statusColorVar(status)})`);
        if (pill) {
            pill.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            pill.style.color = `var(--${statusColorVar(status)})`;
            pill.style.background = `var(--${statusColorVar(status)}-dim)`;
        }
    }

    function statusColorVar(status) {
        if (status === "degraded") return "warn";
        if (status === "offline") return "bad";
        return "good";
    }

    function renderError(message) {
        const title = document.getElementById("project-title");
        if (title) title.textContent = message;
    }

    async function fetchApiMetrics(projectId) {
        const response = await fetch(`/api/endpoints/${encodeURIComponent(projectId)}`);
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json();
    }

    function errorRateLevel(errorRatePercent) {
        if (errorRatePercent >= 3) return "bad";
        if (errorRatePercent >= 1) return "warn";
        return "good";
    }

    function methodClass(method) {
        if (method === "GET") return "method-get";
        if (method === "POST") return "method-post";
        if (method === "DELETE") return "method-delete";
        return "method-other";
    }

    // Render the "Load more" button
    function renderLoadMoreButton(endpointsLength) {
        const container = document.getElementById("load-more-container");
        if (!container) return;

        const total = endpointsLength;
        const shown = Math.min(currentVisibleCount, total);
        const remaining = total - shown;

        if (remaining <= 0) {
            container.innerHTML = `<span class="load-more-info">Showing all ${total} endpoints</span>`;
            return;
        }

        container.innerHTML = `
            <button id="load-more-btn" class="load-more-btn">
                Load more (${remaining} remaining)
            </button>
        `;

        document.getElementById("load-more-btn").addEventListener("click", function () {
            alert('dd');
            currentVisibleCount += PAGE_SIZE;
            // Re‑render with the same cached data
            if (lastData) {
                renderApiMetrics(lastData, false);
            }
        });
    }

   function renderApiMetrics(data, resetPagination = true) {
    // Store data for later re‑renders
    lastData = data;

        const { mostCritical, endpoints, stale, lastError, FETCH_TIMEOUT_MS } = data;

        const card = document.getElementById("critical-card");
        const tbody = document.getElementById("api-table-body");

        if (!endpoints || endpoints.length === 0) {
            if (card) {
                card.dataset.level = "warn";
                document.getElementById("critical-method").textContent = "—";
                document.getElementById("critical-path").textContent = stale
                    ? `No data yet (${lastError || "external API unreachable"})`
                    : "No endpoints reported";
                document.getElementById("critical-error").textContent = "—";
                document.getElementById("critical-p95").textContent = "—";
                document.getElementById("critical-rpm").textContent = "—";
            }
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" class="api-table-loading">${
                    stale ? "Waiting for external metrics source&hellip;" : "No endpoints to show yet."
                }</td></tr>`;
            }
            // Hide load more
            renderLoadMoreButton(0);
            return;
        }

        const methodEl = document.getElementById("critical-method");
        const pathEl = document.getElementById("critical-path");
        const errorEl = document.getElementById("critical-error");
        const p95El = document.getElementById("critical-p95");
        const rpmEl = document.getElementById("critical-rpm");
        const refreshEl = document.getElementById("refresh-interval");

        if (methodEl) {
            methodEl.textContent = mostCritical.method;
            methodEl.className = `method-badge ${methodClass(mostCritical.method)}`;
        }
        if (pathEl) pathEl.textContent = mostCritical.path;
        if (errorEl) errorEl.textContent = `${mostCritical.errorRatePercent}%`;
        if (p95El) p95El.textContent = `${mostCritical.p95ResponseMs}ms`;
        if (rpmEl) rpmEl.textContent = mostCritical.requestsPerMin;
        if (card) card.dataset.level = errorRateLevel(mostCritical.errorRatePercent);

        if (refreshEl) refreshEl.textContent = FETCH_TIMEOUT_MS / 1000 + "s";

        if (!tbody) return;

        // Sort endpoints once (by criticalScore descending)
        const sortedEndpoints = endpoints.slice().sort((a, b) => b.criticalScore - a.criticalScore);

        // Slice based on currentVisibleCount
        const visibleEndpoints = sortedEndpoints.slice(0, currentVisibleCount);

        tbody.innerHTML = "";
        visibleEndpoints.forEach((endpoint) => {
            const row = document.createElement("tr");
            const level = errorRateLevel(endpoint.errorRatePercent);

            row.innerHTML = `
                <td>
                    <span class="method-badge ${methodClass(endpoint.method)}">${endpoint.method}</span>
                    <span class="api-path">${endpoint.path}</span>
                </td>
                <td>${endpoint.avgResponseMs}ms</td>
                <td>${endpoint.p95ResponseMs}ms</td>
                <td>${endpoint.requestsPerMin}</td>
                <td class="error-cell error-${level}">${endpoint.errorRatePercent}%</td>
                <td>${endpoint.memoryMB} MB</td>
            `;
            tbody.appendChild(row);
        });

        if (stale) {
            const note = document.createElement("tr");
            note.innerHTML = `<td colspan="6" class="api-table-loading">Showing last known data — external source unreachable (${lastError})</td>`;
            tbody.appendChild(note);
        }

        // Render the load‑more button (or "all shown" message)
        renderLoadMoreButton(sortedEndpoints.length);
    }

    function init() {
        const projectId = getProjectIdFromUrl();

        if (!projectId) {
            renderError("No project selected");
            return;
        }

        document.title = `Monitorly — ${humanizeProjectId(projectId)}`;

        const titleEl = document.getElementById("project-title");
        if (titleEl) titleEl.textContent = humanizeProjectId(projectId);

        let lastUpdatedAt = Date.now();

        async function poll() {
            try {
                const [apiData] = await Promise.all([
                    fetchApiMetrics(projectId)
                ]);
                renderApiMetrics(apiData, true);
            } catch (err) {
                renderError("Unable to load project metrics");
                console.error(err);
            }
        }

        setInterval(() => {
            const elapsed = Math.floor((Date.now() - lastUpdatedAt) / 1000);
            const lastUpdatedEl = document.getElementById("last-updated");
            if (lastUpdatedEl) lastUpdatedEl.textContent = formatRelativeTime(elapsed);
        }, 1000);

        poll();
        setInterval(poll, POLL_INTERVAL_MS);
    }

    document.addEventListener("DOMContentLoaded", init);
})();