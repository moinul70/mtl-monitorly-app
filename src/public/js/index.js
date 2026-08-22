(function () {
    "use strict";

    const modal = document.getElementById("add-project-modal");
    const openBtn = document.getElementById("add-project-btn");
    const closeBtn = document.getElementById("modal-close-btn");
    const cancelBtn = document.getElementById("modal-cancel-btn");
    const form = document.getElementById("add-project-form");
    const nameInput = document.getElementById("project-name");
    const errorEl = document.getElementById("modal-error");
    const submitBtn = document.getElementById("modal-submit-btn");
    const projectsList = document.getElementById("projects-list");
    const emptyAddCard = document.getElementById("empty-add-card");

    const API_BASE = "/api/projects";

    // ---------- Modal open/close ----------

    function openModal() {
        modal.hidden = false;
        nameInput.value = "";
        hideError();
        // Give the browser a tick to unhide before focusing, avoids a
        // focus-on-hidden-element warning in some browsers.
        requestAnimationFrame(() => nameInput.focus());
        document.addEventListener("keydown", onKeydown);
    }

    function closeModal() {
        modal.hidden = true;
        document.removeEventListener("keydown", onKeydown);
    }

    function onKeydown(e) {
        if (e.key === "Escape") closeModal();
    }

    function showError(message) {
        errorEl.textContent = message;
        errorEl.hidden = false;
    }

    function hideError() {
        errorEl.hidden = true;
        errorEl.textContent = "";
    }

    openBtn?.addEventListener("click", openModal);
    closeBtn?.addEventListener("click", closeModal);
    cancelBtn?.addEventListener("click", closeModal);
    emptyAddCard?.addEventListener("click", (e) => {
        e.preventDefault();
        openModal();
    });
    modal?.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });

    // ---------- Helpers ----------

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str ?? "";
        return div.innerHTML;
    }

    function capitalize(str) {
        if (!str) return "Online";
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * API responses might come back as { projects: [...] }, { data: [...] },
     * or a bare array — normalize whatever we get into a plain array so the
     * rest of the code doesn't need to know or care which shape the backend
     * actually uses.
     */
    function extractList(payload) {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.projects)) return payload.projects;
        if (Array.isArray(payload?.data)) return payload.data;
        return [];
    }

    /**
     * Same idea for a single created project: { project: {...} },
     * { data: {...} }, or the object itself directly.
     */
    function extractItem(payload) {
        if (payload?.project) return payload.project;
        if (payload?.data) return payload.data;
        return payload;
    }

    /**
     * Matches the actual schema: { id: INTEGER, project_name: TEXT }.
     * There's no status or uptime_percent column yet — those are shown
     * as placeholders until a metrics table/source is wired in separately.
     */
    function normalizeProject(raw) {
        return {
            id: raw.id,
            name: raw.project_name ?? "Untitled project",
            status: "online", // placeholder — no status column exists yet
            uptime: null,      // placeholder — no uptime_percent column exists yet
        };
    }

    function buildCard(rawProject) {
        const project = normalizeProject(rawProject);

        const a = document.createElement("a");
        a.className = "card";
        a.dataset.status = project.status;
        a.href = `/dashboard/${encodeURIComponent(project.id)}`;

        const uptimeDisplay = project.uptime !== null && project.uptime !== undefined
            ? `${project.uptime}%`
            : "—";

        a.innerHTML = `
            <div class="card-top">
                <span class="pulse-dot" aria-hidden="true"></span>
                <h2 class="card-title">${escapeHtml(project.name)}</h2>
                <span class="status-pill">${capitalize(project.status)}</span>
            </div>
            <p class="card-copy">Check the status of your server</p>
            <svg class="pulse-line" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
                <polyline points="0,20 200,20" />
            </svg>
            <div class="card-stats">
                <div class="stat">
                    <span class="stat-value">${escapeHtml(uptimeDisplay)}</span>
                    <span class="stat-label">Uptime</span>
                </div>
                <div class="stat">
                    <span class="stat-value">—</span>
                    <span class="stat-label">Response</span>
                </div>
                <div class="stat">
                    <span class="stat-value">just now</span>
                    <span class="stat-label">Last checked</span>
                </div>
            </div>
        `;
        return a;
    }

    function renderEmptyState() {
        const msg = document.createElement("p");
        msg.className = "projects-empty";
        msg.id = "projects-empty-msg";
        msg.textContent = "No projects yet — add one to start monitoring.";
        projectsList.insertBefore(msg, emptyAddCard);
    }

    function clearEmptyState() {
        document.getElementById("projects-empty-msg")?.remove();
    }

    function clearExistingCards() {
        projectsList.querySelectorAll(".card:not(.card-add)").forEach((el) => el.remove());
        clearEmptyState();
    }

    // ---------- Load projects ----------

    async function loadProjects() {
        try {
            const res = await fetch(API_BASE, {
                headers: { Accept: "application/json" },
            });

            if (!res.ok) {
                throw new Error(`Request failed with status ${res.status}`);
            }

            const payload = await res.json();
            const projects = extractList(payload);

            clearExistingCards();

            if (projects.length === 0) {
                renderEmptyState();
                return;
            }

            projects.forEach((raw) => {
                projectsList.insertBefore(buildCard(raw), emptyAddCard);
            });
        } catch (err) {
            console.error("Failed to load projects:", err);
            clearExistingCards();
            const msg = document.createElement("p");
            msg.className = "projects-empty";
            msg.id = "projects-empty-msg";
            msg.textContent = "Couldn't load projects. Refresh to try again.";
            projectsList.insertBefore(msg, emptyAddCard);
        }
    }

    // ---------- Submit new project ----------

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideError();

        const name = nameInput.value.trim();
        if (!name) {
            showError("Project name can't be empty.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Adding…";

        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({ name }),
            });

            let payload = {};
            try {
                payload = await res.json();
            } catch {
                // Non-JSON error response — fall through to generic message below.
            }

            if (!res.ok) {
                throw new Error(payload.message || payload.error || `Failed with status ${res.status}`);
            }

            clearEmptyState();
            const project = extractItem(payload);
            projectsList.insertBefore(buildCard(project), emptyAddCard);
            closeModal();
        } catch (err) {
            showError(err.message || "Something went wrong. Please try again.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Add project";
        }
    });

    loadProjects();
})();