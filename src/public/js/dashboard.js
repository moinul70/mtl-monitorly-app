/**
 * Monitorly dashboard
 * --------------------
 * Drives the "live" feel of each project card: a simulated ping history
 * rendered as an EKG-style line, a rotating response-time figure, an
 * occasional status change, and a "last checked" clock.
 *
 * This is front-end simulation only — swap `pingProject()` for a real
 * fetch to your Node.js monitoring API when it's ready.
 */


(function () {
    "use strict";

    const HISTORY_LENGTH = 24;
    const CHECK_INTERVAL_MS = 3200;
    const STATUS_ORDER = ["online", "online", "online", "online", "degraded", "offline"];
    let FETCH_TIMEOUT_MS = 5000;
     

    /**
     * Turns an array of ping values (ms) into an SVG polyline `points` string
     * inside a 200x40 viewBox, so the line only needs redrawing, not resizing.
     */
    function buildPolyline(history) {
        const max = Math.max(...history, 1);
        const min = Math.min(...history, 0);
        const range = Math.max(max - min, 1);
        const stepX = 200 / (HISTORY_LENGTH - 1);

        return history
            .map((value, index) => {
                const x = (index * stepX).toFixed(1);
                const normalized = (value - min) / range; // 0..1
                const y = (36 - normalized * 30 - 2).toFixed(1); // keep within padding
                return `${x},${y}`;
            })
            .join(" ");
    }

    function randomPing(baseline) {
        const jitter = Math.random() * 40 - 20;
        return Math.max(12, Math.round(baseline + jitter));
    }

    function formatRelativeTime(seconds) {
        if (seconds < 5) return "just now";
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ago`;
    }

    function initCard(card) {
        const baseline = 60 + Math.random() * 60;
        const history = Array.from({ length: HISTORY_LENGTH }, () => randomPing(baseline));

        const polyline = card.querySelector(".pulse-line polyline");
        const pingEl = card.querySelector("[data-ping]");
        const checkedEl = card.querySelector("[data-checked]");

        let lastCheckedAt = Date.now();
        let currentStatus = card.dataset.status || "online";

        function render() {
            if (polyline) {
                polyline.setAttribute("points", buildPolyline(history));
            }
            if (pingEl) {
                const latest = history[history.length - 1];
                pingEl.textContent = `${latest}ms`;
            }
        }

        function tick() {
            // Roll the ping history forward by one sample.
            history.shift();
            history.push(randomPing(baseline));

            // Occasionally simulate a status change so the dashboard feels alive.
            if (Math.random() < 0.08) {
                currentStatus = STATUS_ORDER[Math.floor(Math.random() * STATUS_ORDER.length)];
                card.dataset.status = currentStatus;
                const pill = card.querySelector(".status-pill");
                if (pill) {
                    pill.textContent =
                        currentStatus === "online" ? "Online" :
                        currentStatus === "degraded" ? "Degraded" : "Offline";
                }
            }

            lastCheckedAt = Date.now();
            render();
        }

        // Keep "last checked" honest every second, independent of the ping cadence.
        setInterval(() => {
            if (checkedEl) {
                const elapsed = Math.floor((Date.now() - lastCheckedAt) / 1000);
                checkedEl.textContent = formatRelativeTime(elapsed);
            }
        }, 1000);

        setInterval(tick, CHECK_INTERVAL_MS + Math.random() * 800);

        render();
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll(".card[data-status]").forEach(initCard);
    });

    // ---------------------------------------------------------------
    // Add-project modal + project list loading
    // ---------------------------------------------------------------

    const modal = document.getElementById("projectModal");
    const addProjectBtn = document.querySelector(".addProjectBtn");
    const closeProjectModal = document.getElementById("closeProjectModal");
    const addProjectForm = document.getElementById("addProjectForm");
    const projectNameInput = document.getElementById("project_name");
    const projectBaseUrlInput = document.getElementById("project_base_url");
    const modalError = document.getElementById("modalError");
    const submitProjectBtn = document.getElementById("submitProjectBtn");
    const projectsContainer = document.getElementById("projects_list");
    const addCard = document.getElementById("projects_list_card");
 

    function openModal() {
        modal.classList.add("active");
        hideModalError();
        projectNameInput.value = "";
        projectBaseUrlInput.value = "";
        requestAnimationFrame(() => projectNameInput.focus());
    }

    function closeModal() {
        modal.classList.remove("active");
    }

    function showModalError(message) {
        modalError.textContent = message;
        modalError.classList.remove("hidden");
    }

    function hideModalError() {
        modalError.classList.add("hidden");
        modalError.textContent = "";
    }

    addProjectBtn.addEventListener("click", openModal);
    closeProjectModal.addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => {
        //if (event.target === modal) closeModal();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.classList.contains("active")) closeModal();
    });

    document.addEventListener("DOMContentLoaded", () => {
        loadProjects();
    });

    async function loadProjects() {
        try {
            const response = await fetch("/api/projects");

            if (!response.ok) {
                throw new Error("Failed to load projects");
            }

            const payload = await response.json();

            const projects = Array.isArray(payload) ? payload : (payload.projects || []);
            FETCH_TIMEOUT_MS = payload.fetch_time_out;

            projects.forEach((project) => {
                const card = createProjectCard(project);
                projectsContainer.insertBefore(card, addCard);
                initCard(card);
            });
             const refreshEl = document.querySelector(".refresh-time");
      if (refreshEl) refreshEl.textContent = FETCH_TIMEOUT_MS / 1000;
    
        } catch (error) {
            console.error("Error loading projects:", error);
        }
    }

    addProjectForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        hideModalError();

        const project_name = projectNameInput.value.trim();
        if (!project_name) return;
        const project_base_url = projectBaseUrlInput.value.trim();
        if (!project_name) return;

        submitProjectBtn.disabled = true;
        submitProjectBtn.textContent = "Adding…";

        try {
            const response = await fetch("/projects", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify({ project_name, project_base_url }),
            });

            let payload = {};
            try {
                payload = await response.json();
            } catch {
                // non-JSON error body, fall through to generic message
            }

            if (!response.ok) {
        // Extract message from JSON payload, or use text fallback
        const msg =
            payload.message ||
            payload.error ||
            payload.detail ||
            payload.errormessage || // ← handle your server's key
            errorMessage ||
            response.statusText ||
            `Request failed with status ${response.status}`;
        throw new Error(msg);
    }

            window.location.href = '/';
        } catch (error) {
           
           showModalError(error.message || "Something went wrong. Please try again.");
        } finally {
            submitProjectBtn.disabled = false;
            submitProjectBtn.textContent = "Add Project";
        }
    });

    function createProjectCard(project) {
        const card = document.createElement("div");

        card.className = "card";
        card.dataset.status = "online";
       // card.href = `/dashboard/${project.project_name}`;

        card.innerHTML = `
       
            <div class="card-top flex items-center gap-2 w-full">
  <span class="pulse-dot w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
    <a class="hover:underline text-wrap flex-1 min-w-0" href="/dashboard/${encodeURIComponent(project.project_name)}/${encodeURIComponent(project.project_base_url)}">
        <h2 class="card-title text-lg font-semibold text-gray-800 break-words leading-tight max-w-md">
            ${escapeHtml(project.project_name)}
        </h2>
    </a>
    <span class="status-pill text-xs font-medium px-2.5 py-1 bg-green-100 text-green-800 rounded-full shrink-0">
        Online
    </span>
    
    <button data-project-id="${project.id}" id="delete_project" class="delete-project-btn bg-red-600 hover:bg-red-700 text-white font-medium text-xs py-1.5 px-3 rounded-lg cursor-pointer transition-colors duration-200 shrink-0 ml-auto">
        Delete
    </button>
</div>

<p class="card-copy">Check the status of your server</p>

<svg class="pulse-line" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="0,20 200,20" />
</svg>

<a href="/dashboard/${encodeURIComponent(project.project_name)}/${encodeURIComponent(project.project_base_url)}" class="card-stats-link">
    <div class="card-stats">
        <div class="stat">
            <span class="stat-value">99.98%</span>
            <span class="stat-label">Uptime</span>
        </div>
        <div class="stat">
            <span class="stat-value" data-ping>—</span>
            <span class="stat-label">Response</span>
        </div>
        <div class="stat">
            <span class="stat-value" data-checked>just now</span>
            <span class="stat-label">Last checked</span>
        </div>
    </div>
</a>
        `;

        return card;
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value;
        return div.innerHTML;
    }

    
function renderError(message) {
        const title = document.getElementById("project-title");
        if (title) title.textContent = message;
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
async function fetchMetrics() {
        const response = await fetch(`/system-metrics`);
      
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json();
    }
   function init() {

        // document.title = `Monitorly — ${humanizeProjectId(projectId)}`;

         const titleEl = document.getElementById("project-title");
         if (titleEl) titleEl.textContent = 'my-project';

        const cpuHistory = Array(HISTORY_LENGTH).fill(0);
        let lastUpdatedAt = Date.now();

        function applyMetrics(data) {
            setStatus(data.status);

            const hostEl = document.getElementById("system-host");
            const platformEl = document.getElementById("project-platform");
            if (hostEl) hostEl.textContent = data.hostname;
            if (platformEl) platformEl.textContent = data.platform;

            // CPU
            const cpuPercentEl = document.getElementById("cpu-percent");
            const cpuBarEl = document.getElementById("cpu-bar");
            const cpuLineEl = document.getElementById("cpu-line");
            const cpuParentEl = document.getElementById("metric-card-cpu");
            if (cpuParentEl) {
    cpuParentEl.classList.toggle(
        "metric-card-critical",
        data.cpu.loadPercent > data.cpuThreshold
    );
}
            // if(data.cpu.loadPercent > data.cpuThreshold) cpuParentEl.classList.add("metric-card-critical");
            if (cpuPercentEl) cpuPercentEl.textContent = `${data.cpu.loadPercent}%`;
            if (cpuBarEl) cpuBarEl.style.width = `${Math.min(100, data.cpu.loadPercent)}%`;

            cpuHistory.shift();
            cpuHistory.push(data.cpu.loadPercent);
            if (cpuLineEl) cpuLineEl.setAttribute("points", buildPolyline(cpuHistory));

            document.getElementById("load-1m").textContent = data.cpu.loadAverage["1m"];
            document.getElementById("load-5m").textContent = data.cpu.loadAverage["5m"];
            document.getElementById("load-15m").textContent = data.cpu.loadAverage["15m"];
            document.getElementById("cpu-cores").textContent = data.cpu.cores;

            // Memory
            const memPercentEl = document.getElementById("mem-percent");
            const memBarEl = document.getElementById("mem-bar");
            const memParentEl = document.getElementById("metric-card-memory");
            if (memParentEl) {
    memParentEl.classList.toggle(
        "metric-card-critical",
        data.memory.usedPercent > data.memoryThreshold
    );
}
            // if(data.memory.usedPercent > data.memoryThreshold) memParentEl.classList.add("metric-card-critical");
            if (memPercentEl) memPercentEl.textContent = `${data.memory.usedPercent}%`;
            if (memBarEl) memBarEl.style.width = `${Math.min(100, data.memory.usedPercent)}%`;

            document.getElementById("mem-used").textContent = `${data.memory.usedGB} GB`;
            document.getElementById("mem-free").textContent = `${data.memory.freeGB} GB`;
            document.getElementById("mem-total").textContent = `${data.memory.totalGB} GB`;

            // Uptime
            document.getElementById("uptime-value").textContent = data.uptime.formatted;

            lastUpdatedAt = Date.now();
        }

        async function poll() {
            try {
                 const [systemData] = await Promise.all([
                    fetchMetrics(),
                ]);
                applyMetrics(systemData);
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
        setInterval(poll, FETCH_TIMEOUT_MS);
    }
  document.addEventListener('DOMContentLoaded', () => {
   

    projectsContainer.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-project-btn');
        if (deleteBtn) {
            const projectId = deleteBtn.dataset.projectId;
            if (!projectId) return;
            await deleteProject(projectId);
        }
    });
});



    async function deleteProject(projectId) {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
        console.log('Deleting project', projectId);
        const response = await fetch(`/api/projects/${projectId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to delete project');
        }

        // Remove the card
        const card = document.querySelector(`.project-card[data-project-id="${projectId}"]`);
        if (card) card.remove();
        window.location.reload(); // Reload the page to reflect changes

    } catch (error) {
        console.error('Delete error:', error);
        alert(error.message);
    }
}

    document.addEventListener("DOMContentLoaded", init);
})();