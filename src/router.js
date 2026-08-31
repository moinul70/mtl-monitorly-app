const express = require("express");
const path = require("path");

const { getMetrics } = require("./system-metrics");
const { getApiMetrics } = require("./api-metrics");
const db = require("./db");
const app = express();

app.use(express.json());
app.set("view engine", "ejs");
app.set("views", "./src/views");
const PUBLIC_DIR = path.join(__dirname, "public");

app.use(express.static(PUBLIC_DIR));

app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("index");
});

app.post("/projects", (req, res) => {
  const { project_name, project_base_url } = req.body;

  if (!project_name || !project_name.trim()) {
    return res.status(400).send("Project name is required");
  }

  if (!project_base_url || !project_base_url.trim()) {
    return res.status(400).send("Project base URL is required");
  }

  const name = project_name.trim();
  const baseUrl = decodeURIComponent(project_base_url);

  try {
    const result = db
      .prepare(
        `
            INSERT INTO projects (project_name, project_base_url)
            VALUES (?, ?)
        `,
      )
      .run(name, baseUrl);

    // Redirect to the newly created project
    res.redirect(
      `/dashboard/${result.lastInsertRowid}/${encodeURIComponent(baseUrl)}`,
    );
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res
        .status(409)
        .json({ errormessage: "Project name already exists" });
    }

    console.error(error);

    res.status(500).send("Database error");
  }
});

app.get("/dashboard", (req, res) => {
  res.status(400).send("A project id is required, e.g. /dashboard/project-1");
});

app.get("/dashboard/:projectId/:projectBaseUrl", (req, res) => {
  res.render("project-dashboard");
});

app.get("/api/projects", (req, res) => {
  try {
    const projects = db
      .prepare(
        `
            SELECT id, project_name, project_base_url
            FROM projects
            ORDER BY id DESC
        `,
      )
      .all();

    res.json({
      projects: projects,
      fetch_time_out: process.env.FETCH_TIMEOUT_MS,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to load projects",
    });
  }
});
app.delete("/api/projects/:projectId", async (req, res) => {
  const { projectId } = req.params;
  try {
    const deleteProject = db
      .prepare(
        `
            DELETE FROM projects
            WHERE id = ?
        `,
      )
      .run(projectId);

    if (!deleteProject) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to delete project",
    });
  }
});

app.get("/system-metrics", (req, res) => {
  try {
    const metrics = getMetrics();
    res.json(metrics,{'memoryThreshold':process.env.MEMORY_THRESHOLD,'cpuThreshold':process.env.CPU_THRESHOLD});
  } catch (err) {
    res.status(500).json({ error: "Failed to read system metrics" });
  }
});

app.get("/api/endpoints/:projectId/:projectBaseUrl", async (req, res) => {
  const { projectId, projectBaseUrl } = req.params;
  const baseUrl = decodeURIComponent(projectBaseUrl);

  try {
    const data = await getApiMetrics(projectId, baseUrl);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "External metrics source unavailable" });
  }
});

app.use((req, res) => {
  res.status(404).send("404 Page Not Found");
});

module.exports = app;
