/**
 * Monitorly dashboard
 * --------------------
 * Drives the "live" feel of each project card: a simulated ping history
 * occasional status change, and a "last checked" clock.
 *
 * This is front-end simulation only — swap `pingProject()` for a real
 * fetch to your Node.js monitoring API when it's ready.
 */

const HISTORY_LENGTH = 24;
const CHECK_INTERVAL = 3200;
let fetchTimeout = 5000;


// --------------------------------------------------
// Helper
// --------------------------------------------------

function $(selector, parent) {
    return (parent || document).querySelector(selector);
}

function setText(selector, value) {
    const element = $(selector);

    if (element) {
        element.textContent = value;
    }
}

function setWidth(selector, value) {
    const element = $(selector);

    if (element) {
        element.style.width = value;
    }
}


// --------------------------------------------------
// Common Functions
// --------------------------------------------------

function buildPolyline(history) {
    const max = Math.max(...history, 1);
    const min = Math.min(...history, 0);
    const range = Math.max(max - min, 1);

    return history.map(function (value, index) {
        const x =
            (index * 200 / (HISTORY_LENGTH - 1))
            .toFixed(1);

        const y =
            (36 - ((value - min) / range) * 30 - 2)
            .toFixed(1);

        return x + "," + y;

    }).join(" ");
}


function randomPing(baseline) {
    return Math.max(
        12,
        Math.round(
            baseline + Math.random() * 40 - 20
        )
    );
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


// --------------------------------------------------
// Project Cards
// --------------------------------------------------

function initCard(card) {

    const baseline =
        60 + Math.random() * 60;

    const history = Array.from(
        { length: HISTORY_LENGTH },
        function () {
            return randomPing(baseline);
        }
    );

    const line =
        $(".pulse-line polyline", card);

    const ping =
        $("[data-ping]", card);

    const checked =
        $("[data-checked]", card);

    let lastChecked = Date.now();


    function updateCard() {

        if (line) {
            line.setAttribute(
                "points",
                buildPolyline(history)
            );
        }

        if (ping) {
            ping.textContent =
                history[history.length - 1] + "ms";
        }
    }


    function tick() {

        history.shift();

        history.push(
            randomPing(baseline)
        );


        // Random status change
        if (Math.random() < 0.08) {

            const statuses = [
                "online",
                "degraded",
                "offline"
            ];

            const status =
                statuses[
                    Math.floor(
                        Math.random() * statuses.length
                    )
                ];

            card.dataset.status = status;

            const pill =
                $(".status-pill", card);

            if (pill) {
                pill.textContent =
                    status.charAt(0).toUpperCase() +
                    status.slice(1);
            }
        }


        lastChecked = Date.now();

        updateCard();
    }


    // Last checked time
    setInterval(function () {

        if (!checked) {
            return;
        }

        const seconds =
            Math.floor(
                (Date.now() - lastChecked) / 1000
            );

        checked.textContent =
            relativeTime(seconds);

    }, 1000);


    // Ping update
    setInterval(
        tick,
        CHECK_INTERVAL + Math.random() * 800
    );


    updateCard();
}


// --------------------------------------------------
// Load Projects
// --------------------------------------------------

async function loadProjects() {

    try {

        const response =
            await fetch("/api/projects");


        if (!response.ok) {
            throw new Error(
                "Failed to load projects"
            );
        }


        const data =
            await response.json();


        const projects =
            Array.isArray(data)
                ? data
                : (data.projects || []);


        if (data.fetch_time_out) {
            fetchTimeout =
                data.fetch_time_out;
        }


        projects.forEach(function (project) {

            const card =
                createProjectCard(project);


            if (projectsContainer) {

                projectsContainer.insertBefore(
                    card,
                    addCard
                );

            }


            initCard(card);
        });


        const refresh =
            $(".refresh-time");


        if (refresh) {

            refresh.textContent =
                fetchTimeout / 1000;

        }


    } catch (error) {

        console.error(
            "Error loading projects:",
            error
        );

    }
}


// --------------------------------------------------
// Create Project Card
// --------------------------------------------------

function createProjectCard(project) {

    const card =
        document.createElement("div");


    const name =
        escapeHtml(project.project_name);


    const url =
        "/dashboard/" +
        encodeURIComponent(
            project.project_name
        ) +
        "/" +
        encodeURIComponent(
            project.project_base_url
        );


    card.className = "card";

    card.dataset.status =
        "online";


    card.innerHTML = `
        <div class="card-top flex items-center gap-2 w-full">

            <span
                class="pulse-dot w-2.5 h-2.5 rounded-full bg-green-500 inline-block">
            </span>

            <a
                class="hover:underline text-wrap flex-1 min-w-0"
                href="${url}"
            >
                <h2
                    class="card-title text-lg font-semibold text-gray-800 break-words leading-tight max-w-md"
                >
                    ${name}
                </h2>
            </a>

            <span
                class="status-pill text-xs font-medium px-2.5 py-1 bg-green-100 text-green-800 rounded-full shrink-0"
            >
                Online
            </span>

            <button
                data-project-id="${project.id}"
                class="delete-project-btn bg-red-600 hover:bg-red-700 text-white font-medium text-xs py-1.5 px-3 rounded-lg cursor-pointer transition-colors duration-200 shrink-0 ml-auto"
            >
                Delete
            </button>

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
            <polyline points="0,20 200,20"></polyline>
        </svg>


        <a
            href="${url}"
            class="card-stats-link"
        >

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

                    <span
                        class="stat-value"
                        data-ping
                    >
                        —
                    </span>

                    <span class="stat-label">
                        Response
                    </span>

                </div>


                <div class="stat">

                    <span
                        class="stat-value"
                        data-checked
                    >
                        just now
                    </span>

                    <span class="stat-label">
                        Last checked
                    </span>

                </div>

            </div>

        </a>
    `;


    return card;
}


function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent = value;

    return div.innerHTML;
}


// --------------------------------------------------
// Modal
// --------------------------------------------------

function openModal() {

    if (!modal) {
        return;
    }


    modal.classList.add("active");

    hideModalError();


    if (projectNameInput) {
        projectNameInput.value = "";
    }


    if (projectBaseUrlInput) {
        projectBaseUrlInput.value = "";
    }


    if (projectNameInput) {
        projectNameInput.focus();
    }
}


function closeModal() {

    if (modal) {
        modal.classList.remove("active");
    }
}


function showModalError(message) {

    if (!modalError) {
        return;
    }

    modalError.textContent =
        message;

    modalError.classList.remove(
        "hidden"
    );
}


function hideModalError() {

    if (!modalError) {
        return;
    }

    modalError.textContent = "";

    modalError.classList.add(
        "hidden"
    );
}


// --------------------------------------------------
// URL Validation
// --------------------------------------------------

function isValidUrl(value) {

    try {

        const url =
            new URL(value);


        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );

    } catch (error) {

        return false;

    }
}


// --------------------------------------------------
// Add Project
// --------------------------------------------------

async function addProject(event) {

    event.preventDefault();

    hideModalError();


    const projectName =
        projectNameInput
            ? projectNameInput.value.trim()
            : "";


    const projectUrl =
        projectBaseUrlInput
            ? projectBaseUrlInput.value.trim()
            : "";


    if (!projectName || !projectUrl) {
        return;
    }


    if (!isValidUrl(projectUrl)) {

        showModalError(
            "Enter a valid URL starting with http:// or https://"
        );

        return;
    }


    if (submitProjectBtn) {

        submitProjectBtn.disabled =
            true;

        submitProjectBtn.textContent =
            "Adding…";
    }


    try {

        const response =
            await fetch("/projects", {

                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"
                },

                body: JSON.stringify({
                    project_name:
                        projectName,

                    project_base_url:
                        projectUrl
                })
            });


        const data =
            await response
                .json()
                .catch(function () {
                    return {};
                });


        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                data.detail ||
                data.errormessage ||
                response.statusText ||
                "Request failed"
            );
        }


        window.location.href = "/";


    } catch (error) {

        showModalError(
            error.message ||
            "Something went wrong. Please try again."
        );


    } finally {

        if (submitProjectBtn) {

            submitProjectBtn.disabled =
                false;

            submitProjectBtn.textContent =
                "Add Project";
        }
    }
}


// --------------------------------------------------
// Delete Project
// --------------------------------------------------

async function deleteProject(id) {

    if (
        !confirm(
            "Are you sure you want to delete this project?"
        )
    ) {
        return;
    }


    try {

        const response =
            await fetch(
                "/api/projects/" + id,
                {
                    method: "DELETE"
                }
            );


        const data =
            await response
                .json()
                .catch(function () {
                    return {};
                });


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Failed to delete project"
            );
        }


        window.location.reload();


    } catch (error) {

        console.error(
            "Delete error:",
            error
        );

        alert(error.message);
    }
}


// --------------------------------------------------
// Dashboard Status
// --------------------------------------------------

function setStatus(status) {

    const dot =
        $("#project-dot");

    const pill =
        $("#project-status");

    const card =
        $(".dash-head-top");


    let color = "good";


    if (status === "degraded") {
        color = "warn";
    }


    if (status === "offline") {
        color = "bad";
    }


    if (card) {

        card.dataset.status =
            status;
    }


    if (dot) {

        dot.style.setProperty(
            "--status",
            "var(--" + color + ")"
        );
    }


    if (pill) {

        pill.textContent =
            status.charAt(0).toUpperCase() +
            status.slice(1);


        pill.style.color =
            "var(--" + color + ")";


        pill.style.background =
            "var(--" + color + "-dim)";
    }
}


// --------------------------------------------------
// Metrics API
// --------------------------------------------------

async function fetchMetrics() {

    const response =
        await fetch("/system-metrics");


    if (!response.ok) {

        throw new Error(
            "Request failed with status " +
            response.status
        );
    }


    return response.json();
}


// --------------------------------------------------
// Update Metrics
// --------------------------------------------------

function updateMetrics(data, cpuHistory) {

    setStatus(data.status);


    // Project information
    setText(
        "#project-title",
        "my-project"
    );

    setText(
        "#system-host",
        data.hostname
    );

    setText(
        "#project-platform",
        data.platform
    );


    // ------------------------------
    // CPU
    // ------------------------------

    const cpu =
        data.cpu;


    setText(
        "#cpu-percent",
        cpu.loadPercent + "%"
    );


    setWidth(
        "#cpu-bar",
        Math.min(
            100,
            cpu.loadPercent
        ) + "%"
    );


    const cpuCard =
        $("#metric-card-cpu");


    if (cpuCard) {

        cpuCard.classList.toggle(
            "metric-card-critical",
            cpu.loadPercent >
                data.cpuThreshold
        );
    }


    cpuHistory.shift();

    cpuHistory.push(
        cpu.loadPercent
    );


    const cpuLine =
        $("#cpu-line");


    if (cpuLine) {

        cpuLine.setAttribute(
            "points",
            buildPolyline(cpuHistory)
        );
    }


    setText(
        "#load-1m",
        cpu.loadAverage["1m"]
    );

    setText(
        "#load-5m",
        cpu.loadAverage["5m"]
    );

    setText(
        "#load-15m",
        cpu.loadAverage["15m"]
    );

    setText(
        "#cpu-cores",
        cpu.cores
    );


    // ------------------------------
    // Memory
    // ------------------------------

    const memory =
        data.memory;
    const memoryThreshold = data.memoryThreshold;


    setText(
        "#mem-percent",
        memory.usedPercent + "%"
    );


    setWidth(
        "#mem-bar",
        Math.min(
            100,
            memory.usedPercent
        ) + "%"
    );


    const memoryCard =
        $("#metric-card-memory");


    if (memoryCard) {

        memoryCard.classList.toggle(
            "blink-red",
            memory.usedPercent >
                data.memoryThreshold
        );
    }


    setText(
        "#mem-used",
        memory.usedGB + " GB"
    );

    setText(
        "#mem-free",
        memory.freeGB + " GB"
    );

    setText(
        "#mem-total",
        memory.totalGB + " GB"
    );


    // ------------------------------
    // Uptime
    // ------------------------------

    setText(
        "#uptime-value",
        data.uptime.formatted
    );
}


// --------------------------------------------------
// Metrics Polling
// --------------------------------------------------

function initMetrics() {

    const cpuHistory =
        Array(HISTORY_LENGTH).fill(0);

    let lastUpdated =
        Date.now();


    async function poll() {

        try {

            const data =
                await fetchMetrics();


            updateMetrics(
                data,
                cpuHistory
            );


            lastUpdated =
                Date.now();


        } catch (error) {

            console.error(
                "Metrics error:",
                error
            );


            setText(
                "#project-title",
                "Unable to load project metrics"
            );
        }
    }


    // Last updated
    setInterval(
        function () {

            const element =
                $("#last-updated");


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


    // Repeat request
    setInterval(
        poll,
        fetchTimeout
    );
}


// --------------------------------------------------
// Elements
// --------------------------------------------------

const modal =
    $("#projectModal");

const addProjectBtn =
    $(".addProjectBtn");

const closeProjectModal =
    $("#closeProjectModal");

const addProjectForm =
    $("#addProjectForm");

const projectNameInput =
    $("#project_name");

const projectBaseUrlInput =
    $("#project_base_url");

const modalError =
    $("#modalError");

const submitProjectBtn =
    $("#submitProjectBtn");

const projectsContainer =
    $("#projects_list");

const addCard =
    $("#projects_list_card");


// --------------------------------------------------
// Start
// --------------------------------------------------

document.addEventListener(
    "DOMContentLoaded",
    function () {


        // Existing project cards
        document
            .querySelectorAll(
                ".card[data-status]"
            )
            .forEach(function (card) {

                initCard(card);

            });


        // Load projects
        loadProjects();


        // Open modal
        if (addProjectBtn) {

            addProjectBtn.addEventListener(
                "click",
                openModal
            );

        }


        // Close modal
        if (closeProjectModal) {

            closeProjectModal.addEventListener(
                "click",
                closeModal
            );

        }


        // Escape key
        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape" &&
                    modal &&
                    modal.classList.contains(
                        "active"
                    )
                ) {

                    closeModal();

                }

            }
        );


        // Add project
        if (addProjectForm) {

            addProjectForm.addEventListener(
                "submit",
                addProject
            );

        }


        // Delete project
        if (projectsContainer) {

            projectsContainer.addEventListener(
                "click",
                function (event) {

                    const button =
                        event.target.closest(
                            ".delete-project-btn"
                        );


                    if (button) {

                        deleteProject(
                            button.dataset.projectId
                        );

                    }

                }
            );

        }


        // Dashboard
        if (
            $("#system-host") ||
            $("#cpu-percent")
        ) {

            initMetrics();

        }

    }
);