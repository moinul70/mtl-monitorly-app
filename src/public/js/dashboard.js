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
    const modal = document.getElementById('projectModal');
const addProjectBtn = document.getElementById('addProjectBtn');
const closeProjectModal = document.getElementById('closeProjectModal');

addProjectBtn.addEventListener('click', () => {
    modal.classList.add('active');

    document.getElementById('project_name').focus();
});

closeProjectModal.addEventListener('click', () => {
    modal.classList.remove('active');
});

modal.addEventListener('click', (event) => {
    if (event.target === modal) {
        modal.classList.remove('active');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
});


async function loadProjects() {

    const projectsContainer = document.getElementById('projects');

    try {

        const response = await fetch('/api/projects');

        if (!response.ok) {
            throw new Error('Failed to load projects');
        }

        const projects = await response.json();

        const addCard = document.getElementById('addProjectBtn');

        projects.forEach(project => {

            const card = createProjectCard(project);

            projectsContainer.insertBefore(card, addCard);

        });

    } catch (error) {

        console.error('Error loading projects:', error);

    }
}


function createProjectCard(project) {

    const card = document.createElement('a');

    card.className = 'card';
    card.dataset.status = 'online';

    card.href = `/dashboard/${project.project_name}`;

    card.innerHTML = `
        <div class="card-top">

            <span class="pulse-dot" aria-hidden="true"></span>

            <h2 class="card-title">
                ${escapeHtml(project.project_name)}
            </h2>

            <span class="status-pill">
                Online
            </span>

        </div>

        <p class="card-copy">
            Check the status of your server
        </p>

        <svg
            class="pulse-line"
            viewBox="0 0 200 40"
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <polyline points="0,20 200,20" />
        </svg>

        <div class="card-stats">

            <div class="stat">
                <span class="stat-value">
                    99.98%
                </span>
                <span class="stat-label">
                    Uptime
                </span>
            </div>

            <div class="stat">
                <span class="stat-value">
                    —
                </span>
                <span class="stat-label">
                    Response
                </span>
            </div>

            <div class="stat">
                <span class="stat-value">
                    just now
                </span>
                <span class="stat-label">
                    Last checked
                </span>
            </div>

        </div>
    `;

    return card;
}


function escapeHtml(value) {

    const div = document.createElement('div');

    div.textContent = value;

    return div.innerHTML;
}
})();