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
})();