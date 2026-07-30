const express = require("express");
const path = require("path");

const { getMetrics } = require("./system-metrics");
const { getApiMetrics } = require("./api-metrics");

const app = express();
const PUBLIC_DIR = path.join(__dirname, "public");

app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Bare /dashboard with no project id isn't a valid page — a project
// is always required.
app.get("/dashboard", (req, res) => {
    res.status(400).send("A project id is required, e.g. /dashboard/project-1");
});

app.get("/dashboard/:projectId", (req, res) => {
    // Not validated against a real project list yet — the page loads,
    // and front-end JS reads projectId from the URL to fetch its metrics.
    res.sendFile(path.join(PUBLIC_DIR, "dashboard.html"));
});

// Metrics API — returns a JSON snapshot for one project.
app.get("/api/metrics/:projectId", (req, res) => {
    const { projectId } = req.params;

    try {
        const metrics = getMetrics(projectId);
        res.json(metrics);
    } catch (err) {
        res.status(500).json({ error: "Failed to read system metrics" });
    }
});

// API-level metrics — response times, memory, error rates per endpoint.
// Backed by an external monitoring API, polled every 10s and cached
// in api-metrics.js — this just serves whatever's currently cached.
app.get("/api/endpoints/:projectId", async (req, res) => {
    const { projectId } = req.params;

    try {
        const data = await getApiMetrics(projectId);
        res.json(data);
    } catch (err) {
        res.status(502).json({ error: "External metrics source unavailable" });
    }
});

app.use((req, res) => {
    res.status(404).send("404 Page Not Found");
});

module.exports = app;