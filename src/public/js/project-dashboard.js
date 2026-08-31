/**
 * Project dashboard
 * ------------------
 * Reads the project id from the URL (/dashboard/:projectId/:baseUrl), polls
 * /api/metrics/:projectId/:baseUrl, and renders CPU, memory, and uptime stats.
 */

(function () {
    "use strict";

    const PAGE_SIZE = 1;

    let fetchTimeout = 5000;
    let visibleCount = PAGE_SIZE;
    let lastData = null;


    // -----------------------------
    // Helpers
    // -----------------------------

    function $(id) {
        return document.getElementById(id);
    }


    function setText(id, value) {
        const element = $(id);

        if (element) {
            element.textContent = value;
        }
    }


    function getProjectId() {
        const parts = window.location.pathname
            .split("/")
            .filter(Boolean);

        return parts[1] || null;
    }


    function getBaseUrl() {
        const parts = window.location.pathname
            .split("/")
            .filter(Boolean);

        return parts[2] || null;
    }


    function projectTitle(id) {
        return id
            .split("-")
            .map(function (word) {
                return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(" ");
    }


    function relativeTime(seconds) {

        if (seconds < 5) {
            return "just now";
        }

        if (seconds < 60) {
            return seconds + "s ago";
        }

        return Math.floor(seconds / 60) + "m ago";
    }


    function errorLevel(rate) {

        if (rate >= 3) {
            return "bad";
        }

        if (rate >= 1) {
            return "warn";
        }

        return "good";
    }


    function methodClass(method) {

        if (method === "GET") {
            return "method-get";
        }

        if (method === "POST") {
            return "method-post";
        }

        if (method === "DELETE") {
            return "method-delete";
        }

        return "method-other";
    }


    // -----------------------------
    // API
    // -----------------------------

    async function getMetrics(projectId, baseUrl) {

        const url =
            "/api/endpoints/" +
            encodeURIComponent(projectId) +
            "/" +
            encodeURIComponent(baseUrl);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                "Request failed with status " +
                response.status
            );
        }

        return response.json();
    }


    // -----------------------------
    // Load More
    // -----------------------------

    function renderLoadMore(total) {

        const container =
            $("load-more-container");

        if (!container) {
            return;
        }


        const shown =
            Math.min(visibleCount, total);

        const remaining =
            total - shown;


        if (remaining <= 0) {

            container.innerHTML =
                `<span class="load-more-info">
                    Showing all ${total} endpoints
                </span>`;

            return;
        }


        container.innerHTML = `
            <button
                id="load-more-btn"
                class="load-more-btn"
            >
                Load more (${remaining} remaining)
            </button>
        `;


        const button =
            $("load-more-btn");


        if (button) {

            button.addEventListener(
                "click",
                function () {

                    visibleCount += PAGE_SIZE;

                    if (lastData) {
                        renderApiMetrics(lastData);
                    }
                }
            );
        }
    }


    // -----------------------------
    // Render API Metrics
    // -----------------------------

    function renderApiMetrics(data) {

        lastData = data;


        const endpoints =
            data.endpoints || [];

        const critical =
            data.mostCritical;


        fetchTimeout =
            data.FETCH_TIMEOUT_MS || 5000;


        // No endpoints
        if (endpoints.length === 0) {

            const card =
                $("critical-card");

            if (card) {
                card.dataset.level = "warn";
            }


            setText(
                "critical-method",
                "—"
            );


            setText(
                "critical-path",
                data.stale
                    ? "No data yet (" +
                      (data.lastError ||
                       "external API unreachable") +
                      ")"
                    : "No endpoints reported"
            );


            setText(
                "critical-error",
                "—"
            );


            setText(
                "critical-p95",
                "—"
            );


            setText(
                "critical-rpm",
                "—"
            );


            const tbody =
                $("api-table-body");


            if (tbody) {

                tbody.innerHTML = `
                    <tr>
                        <td
                            colspan="6"
                            class="api-table-loading"
                        >
                            ${
                                data.stale
                                    ? "Waiting for external metrics source&hellip;"
                                    : "No endpoints to show yet."
                            }
                        </td>
                    </tr>
                `;
            }


            renderLoadMore(0);

            return;
        }


        // -----------------------------
        // Critical endpoint
        // -----------------------------

        if (critical) {

            setText(
                "critical-method",
                critical.method
            );


            const method =
                $("critical-method");

            if (method) {

                method.className =
                    "method-badge " +
                    methodClass(
                        critical.method
                    );
            }


            setText(
                "critical-path",
                critical.path
            );


            setText(
                "critical-p95",
                critical.responseMs + "ms"
            );


            setText(
                "critical-rpm",
                critical.memoryMB
            );


            setText(
                "status-code",
                critical.statusCode
            );


            const card =
                $("critical-card");

            if (card) {

                card.dataset.level =
                    errorLevel(
                        critical.errorRatePercent
                    );
            }
        }


        // -----------------------------
        // Summary
        // -----------------------------

        setText(
            "refresh-interval",
            (fetchTimeout / 1000) + "s"
        );


        setText(
            "api-avg-response",
            data.avgResponseMs + "ms"
        );


        setText(
            "api-error-rate",
            data.errorRatePercent + "%"
        );


        // -----------------------------
        // Table
        // -----------------------------

        const tbody =
            $("api-table-body");


        if (!tbody) {
            return;
        }


        const sorted =
            endpoints
                .slice()
                .sort(function (a, b) {
                    return b.criticalScore -
                           a.criticalScore;
                });


        const visible =
            sorted.slice(
                0,
                visibleCount
            );


        tbody.innerHTML = "";


        visible.forEach(function (endpoint) {

            const row =
                document.createElement("tr");
                if (endpoint.statusCode !== 200) {
                    row.classList.add("bg-red-500/10","border-l-4","border-red-500");
                }


            row.innerHTML = `
                <td class="whitespace-nowrap px-4 py-4">
                    <div class="flex items-center gap-2">

                        <span
                            class="method-badge ${methodClass(endpoint.method)}"
                        >
                            ${endpoint.method}
                        </span>

                        <span
                            class="api-path max-w-[280px] truncate"
                        >
                            ${endpoint.path}
                        </span>

                    </div>
                </td>


                <td class="whitespace-nowrap px-4 py-4 font-mono text-sm text-zinc-500">
                    ${endpoint.peakMemoryMb || "—"} MB
                </td>


                <td class="whitespace-nowrap px-4 py-4 font-mono text-sm text-zinc-500">
                    ${endpoint.responseMs || "—"}ms
                </td>


                <td class="max-w-[300px] px-4 py-4 text-sm text-zinc-400">

                    <span
                        class="block max-w-[300px] truncate"
                        title="${endpoint.userAgent || "—"}"
                    >
                        ${endpoint.userAgent || "—"}
                    </span>

                </td>


                <td class="whitespace-nowrap px-4 py-4">

                    <span
                        class="rounded-full bg-white/5 px-2.5 py-1 font-mono text-xs text-zinc-500"
                    >
                        ${endpoint.statusCode || "—"}
                    </span>

                </td>


                <td class="whitespace-nowrap px-4 py-4 font-mono text-sm text-zinc-500">
                    ${endpoint.memoryMB || "—"} MB
                </td>
            `;


            tbody.appendChild(row);
        });


        // Stale data message
        if (data.stale) {

            const row =
                document.createElement("tr");


            row.innerHTML = `
                <td
                    colspan="6"
                    class="api-table-loading"
                >
                    Showing last known data —
                    external source unreachable
                    (${data.lastError || "unknown error"})
                </td>
            `;


            tbody.appendChild(row);
        }


        renderLoadMore(
            sorted.length
        );
    }


    // -----------------------------
    // Main
    // -----------------------------

    function init() {

        const projectId =
            getProjectId();

        const baseUrl =
            getBaseUrl();


        if (!projectId) {

            setText(
                "project-title",
                "No project selected"
            );

            return;
        }


        if (!baseUrl) {

            setText(
                "project-title",
                "No base url selected"
            );

            return;
        }


        const title =
            projectTitle(projectId);


        document.title =
            "Monitorly — " + title;


        setText(
            "project-title",
            title
        );


        let lastUpdated =
            Date.now();


        async function poll() {

            try {

                const data =
                    await getMetrics(
                        projectId,
                        baseUrl
                    );


                renderApiMetrics(data);

                lastUpdated =
                    Date.now();


            } catch (error) {

                setText(
                    "project-title",
                    "Unable to load project metrics"
                );


                console.error(error);
            }
        }


        // Last updated
        setInterval(
            function () {

                const element =
                    $("last-updated");


                if (!element) {
                    return;
                }


                const seconds =
                    Math.floor(
                        (Date.now() - lastUpdated) /
                        1000
                    );


                element.textContent =
                    relativeTime(seconds);

            },
            1000
        );


        // First request
        poll();


        // Repeat
        setInterval(
            poll,
            fetchTimeout
        );
    }


    document.addEventListener(
        "DOMContentLoaded",
        init
    );

})();