(function () {
    "use strict";

    const HISTORY_LENGTH = 24;
    const POLL_INTERVAL_MS = 5000;
    const CHECK_INTERVAL_MS = 3200;
    const STATUS_ORDER = ["online", "online", "online", "online", "degraded", "offline"];

    // ---------- Global Helpers ----------

    const getEl = (id) => document.getElementById(id);

    const setTxt = (id, val) => {
        const el = getEl(id);
        if (el) el.textContent = val ?? "—";
    };

    const escapeHtml = (str) => {
        const div = document.createElement("div");
        div.textContent = str ?? "";
        return div.innerHTML;
    };

    const statusColorVar = (status) =>
        status === "degraded" ? "warn" : status === "offline" ? "bad" : "good";

    const errorRateLevel = (rate) => (rate >= 3 ? "bad" : rate >= 1 ? "warn" : "good");

    const methodClass = (method) =>
        ["GET", "POST", "DELETE"].includes(method) ? `method-${method.toLowerCase()}` : "method-other";

    const humanizeProjectId = (id) =>
        id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

    function formatRelativeTime(seconds) {
        if (seconds < 5) return "just now";
        if (seconds < 60) return `${seconds}s ago`;
        return `${Math.floor(seconds / 60)}m ago`;
    }

    function buildPolyline(history) {
        const max = Math.max(...history, 1);
        const min = Math.min(...history, 0);
        const range = Math.max(max - min, 1);
        const stepX = 200 / (HISTORY_LENGTH - 1);

        return history
            .map((val, idx) => {
                const x = (idx * stepX).toFixed(1);
                const norm = (val - min) / range;
                const y = (36 - norm * 30 - 2).toFixed(1);
                return `${x},${y}`;
            })
            .join(" ");
    }

    async function apiFetch(url, options) {
        const res = await fetch(url, options);
        let data = {};
        try { data = await res.json(); } catch {}
        if (!res.ok) throw new Error(data.message || data.error || `Request failed with status ${res.status}`);
        return data;
    }

    // ---------- Cards Simulation & Project Form ----------

    function initCard(card) {
        const baseline = 60 + Math.random() * 60;
        const randomPing = () => Math.max(12, Math.round(baseline + (Math.random() * 40 - 20)));
        const history = Array.from({ length: HISTORY_LENGTH }, randomPing);

        const polyline = card.querySelector(".pulse-line polyline");
        const pingEl = card.querySelector("[data-ping]");
        const checkedEl = card.querySelector("[data-checked]");
        let lastCheckedAt = Date.now();

        function render() {
            if (polyline) polyline.setAttribute("points", buildPolyline(history));
            if (pingEl) pingEl.textContent = `${history[history.length - 1]}ms`;
        }

        setInterval(() => {
            history.shift();
            history.push(randomPing());
            if (Math.random() < 0.08) {
                const status = STATUS_ORDER[Math.floor(Math.random() * STATUS_ORDER.length)];
                card.dataset.status = status;
                const pill = card.querySelector(".status-pill");
                if (pill) pill.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            }
            lastCheckedAt = Date.now();
            render();
        }, CHECK_INTERVAL_MS + Math.random() * 800);

        setInterval(() => {
            if (checkedEl) checkedEl.textContent = formatRelativeTime(Math.floor((Date.now() - lastCheckedAt) / 1000));
        }, 1000);

        render();
    }

    function createProjectCard(project) {
        const card = document.createElement("a");
        card.className = "card";
        card.dataset.status = "online";
        card.href = `/dashboard/${encodeURIComponent(project.project_name || "")}`;

        card.innerHTML = `
            <div class="card-top">
                <span class="pulse-dot" aria-hidden="true"></span>
                <h2 class="card-title">${escapeHtml(project.project_name)}</h2>
                <span class="status-pill">Online</span>
            </div>
            <p class="card-copy">Check the status of your server</p>
            <svg class="pulse-line" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
                <polyline points="0,20 200,20" />
            </svg>
            <div class="card-stats">
                <div class="stat"><span class="stat-value">99.98%</span><span class="stat-label">Uptime</span></div>
                <div class="stat"><span class="stat-value" data-ping>—</span><span class="stat-label">Response</span></div>
                <div class="stat"><span class="stat-value" data-checked>just now</span><span class="stat-label">Last checked</span></div>
            </div>`;
        return card;
    }

    function initProjectManagement() {
        const modal = getEl("projectModal");
        const form = getEl("addProjectForm");
        const nameInput = getEl("project_name");
        const errorEl = getEl("modalError");
        const container = getEl("projects_list");
        const addCard = getEl("projects_list_card");

        if (!container && !modal) return;

        const toggleModal = (show) => {
            if (!modal) return;
            modal.classList.toggle("active", show);
            if (show && nameInput) {
                if (errorEl) { errorEl.classList.add("hidden"); errorEl.textContent = ""; }
                nameInput.value = "";
                requestAnimationFrame(() => nameInput.focus());
            }
        };

        getEl("addProjectBtn")?.addEventListener("click", () => toggleModal(true));
        getEl("closeProjectModal")?.addEventListener("click", () => toggleModal(false));
        modal?.addEventListener("click", (e) => e.target === modal && toggleModal(false));
        document.addEventListener("keydown", (e) => e.key === "Escape" && modal?.classList.contains("active") && toggleModal(false));

        // Load project cards
        (async () => {
            try {
                const data = await apiFetch("/api/projects");
                const list = Array.isArray(data) ? data : (data.projects || []);
                list.forEach((proj) => {
                    const card = createProjectCard(proj);
                    container?.insertBefore(card, addCard);
                    initCard(card);
                });
            } catch (err) {
                console.error("Error loading projects:", err);
            }
        })();

        // Form Submit Handler
        form?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = getEl("submitProjectBtn");
            const name = nameInput?.value.trim();
            if (!name) return;

            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Adding…"; }

            try {
                const payload = await apiFetch("/api/projects", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify({ name }),
                });

                const card = createProjectCard(payload.project || payload);
                container?.insertBefore(card, addCard);
                initCard(card);
                toggleModal(false);
            } catch (err) {
                if (errorEl) { errorEl.textContent = err.message; errorEl.classList.remove("hidden"); }
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Add Project"; }
            }
        });
    }

    // ---------- Detailed Dashboard Page ----------

    function setStatus(status) {
        const colorVar = statusColorVar(status);
        const card = document.querySelector(".dash-head-top");
        const dot = getEl("project-dot");
        const pill = getEl("project-status");

        if (card) card.dataset.status = status;
        if (dot) dot.style.setProperty("--status", `var(--${colorVar})`);
        if (pill) {
            pill.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            pill.style.color = `var(--${colorVar})`;
            pill.style.background = `var(--${colorVar}-dim)`;
        }
    }

    function renderApiMetrics(data) {
        const { mostCritical, endpoints, stale, lastError, FETCH_TIMEOUT_MS } = data || {};
        const card = getEl("critical-card");
        const tbody = getEl("api-table-body");

        if (!endpoints || !endpoints.length) {
            if (card) card.dataset.level = "warn";
            setTxt("critical-method", "—");
            setTxt("critical-path", stale ? `No data yet (${lastError || "external API unreachable"})` : "No endpoints reported");
            setTxt("critical-error", "—");
            setTxt("critical-p95", "—");
            setTxt("critical-rpm", "—");
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="api-table-loading">${stale ? "Waiting for external metrics source&hellip;" : "No endpoints to show yet."}</td></tr>`;
            return;
        }

        const methodEl = getEl("critical-method");
        if (methodEl) {
            methodEl.textContent = mostCritical.method;
            methodEl.className = `method-badge ${methodClass(mostCritical.method)}`;
        }

        setTxt("critical-path", mostCritical.path);
        setTxt("critical-error", `${mostCritical.errorRatePercent}%`);
        setTxt("critical-p95", `${mostCritical.p95ResponseMs}ms`);
        setTxt("critical-rpm", mostCritical.requestsPerMin);
        setTxt("refresh-interval", FETCH_TIMEOUT_MS ? `${FETCH_TIMEOUT_MS / 1000}s` : "—");
        if (card) card.dataset.level = errorRateLevel(mostCritical.errorRatePercent);

        if (!tbody) return;
        tbody.innerHTML = endpoints
            .slice()
            .sort((a, b) => b.criticalScore - a.criticalScore)
            .map((ep) => `
                <tr>
                    <td><span class="method-badge ${methodClass(ep.method)}">${ep.method}</span><span class="api-path">${escapeHtml(ep.path)}</span></td>
                    <td>${ep.avgResponseMs}ms</td>
                    <td>${ep.p95ResponseMs}ms</td>
                    <td>${ep.requestsPerMin}</td>
                    <td class="error-cell error-${errorRateLevel(ep.errorRatePercent)}">${ep.errorRatePercent}%</td>
                    <td>${ep.memoryMB} MB</td>
                </tr>`)
            .join("");

        if (stale) {
            tbody.insertAdjacentHTML("beforeend", `<tr><td colspan="6" class="api-table-loading">Showing last known data — external source unreachable (${escapeHtml(lastError)})</td></tr>`);
        }
    }

    function initDashboard() {
        // Fix: this is the signal that we're actually on the project-detail
        // page. Without it, this whole function used to run on every page
        // (including the homepage), silently polling /api/metrics forever
        // with no project id and logging errors to the console for nothing.
        const titleEl = getEl("project-title");
        if (!titleEl) return;

        const segments = window.location.pathname.split("/").filter(Boolean);
        const projectId = segments[0] === "dashboard" ? segments[1] : null;

        if (!projectId) {
            titleEl.textContent = "No project selected";
            return;
        }

        // Fix: this used to be commented out, so the title stayed stuck on
        // the static "Loading…" placeholder forever.
        const projectName = humanizeProjectId(projectId);
        document.title = `Monitorly — ${projectName}`;
        titleEl.textContent = projectName;

        const cpuHistory = Array(HISTORY_LENGTH).fill(0);
        let lastUpdatedAt = Date.now();

        function applyMetrics(data) {
            setStatus(data.status);
            setTxt("project-host", data.hostname);
            setTxt("project-platform", data.platform);

            // CPU
            getEl("metric-card-cpu")?.classList.toggle("metric-card-critical", data.cpu.loadPercent > data.cpuThreshold);
            setTxt("cpu-percent", `${data.cpu.loadPercent}%`);
            const cpuBar = getEl("cpu-bar");
            if (cpuBar) cpuBar.style.width = `${Math.min(100, data.cpu.loadPercent)}%`;

            cpuHistory.shift();
            cpuHistory.push(data.cpu.loadPercent);
            getEl("cpu-line")?.setAttribute("points", buildPolyline(cpuHistory));

            setTxt("load-1m", data.cpu.loadAverage["1m"]);
            setTxt("load-5m", data.cpu.loadAverage["5m"]);
            setTxt("load-15m", data.cpu.loadAverage["15m"]);
            setTxt("cpu-cores", data.cpu.cores);

            // Memory
            getEl("metric-card-memory")?.classList.toggle("metric-card-critical", data.memory.usedPercent > data.memoryThreshold);
            setTxt("mem-percent", `${data.memory.usedPercent}%`);
            const memBar = getEl("mem-bar");
            if (memBar) memBar.style.width = `${Math.min(100, data.memory.usedPercent)}%`;

            setTxt("mem-used", `${data.memory.usedGB} GB`);
            setTxt("mem-free", `${data.memory.freeGB} GB`);
            setTxt("mem-total", `${data.memory.totalGB} GB`);

            // Uptime
            setTxt("uptime-value", data.uptime?.formatted);

            lastUpdatedAt = Date.now();
        }

        async function poll() {
            try {
                const encId = encodeURIComponent(projectId);
                const [systemData, apiData] = await Promise.all([
                    apiFetch(`/system-metrics`),
                    apiFetch(`/api/endpoints/${encId}`).catch(() => null),
                ]);

                if (systemData) applyMetrics(systemData);
                if (apiData) renderApiMetrics(apiData);
            } catch (err) {
                // Fix: this used to overwrite #project-title with an error
                // message on every failed poll — a single dropped request
                // would permanently stomp the real project name. Log only.
                console.error("Dashboard error:", err);
            }
        }

        setInterval(() => {
            setTxt("last-updated", formatRelativeTime(Math.floor((Date.now() - lastUpdatedAt) / 1000)));
        }, 1000);

        poll();
        setInterval(poll, POLL_INTERVAL_MS);
    }

    // ---------- Entry Point ----------

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll(".card[data-status]").forEach(initCard);
        initProjectManagement();
        initDashboard();
    });
})();