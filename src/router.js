const express = require("express");
const path = require("path");

const { getMetrics } = require("./system-metrics");
const { getApiMetrics } = require("./api-metrics");
const db = require('./db');
const app = express();
const PUBLIC_DIR = path.join(__dirname, "public");

app.use(express.static(PUBLIC_DIR));

app.use(express.urlencoded({ extended: true })); 

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'views',"index.html"));
});

app.post('/projects', (req, res) => {

    const { project_name } = req.body;

    if (!project_name || !project_name.trim()) {
        return res.status(400).send('Project name is required');
    }

    const name = project_name.trim();

    try {

        const result = db.prepare(`
            INSERT INTO projects (project_name)
            VALUES (?)
        `).run(name);

        // Redirect to the newly created project
        res.redirect(`/dashboard/${result.lastInsertRowid}`);

    } catch (error) {

        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).send('Project name already exists');
        }

        console.error(error);

        res.status(500).send('Database error');
    }
});

// Bare /dashboard with no project id isn't a valid page — a project
// is always required.
app.get("/dashboard", (req, res) => {
    res.status(400).send("A project id is required, e.g. /dashboard/project-1");
});

app.get("/dashboard/:projectId", (req, res) => {
    // Not validated against a real project list yet — the page loads,
    // and front-end JS reads projectId from the URL to fetch its metrics.
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/api/projects', (req, res) => {
    try {
        const projects = db.prepare(`
            SELECT id, project_name
            FROM projects
            ORDER BY id DESC
        `).all();

        res.json(projects);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Failed to load projects'
        });
    }
});

app.get('/dashboard/:project_name', (req, res) => {

    const { project_name } = req.params;

    const project = db.prepare(`
        SELECT *
        FROM projects
        WHERE project_name = ?
    `).get(project_name);

    if (!project) {
        return res.status(404).send('Project not found');
    }

    res.json(project);
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