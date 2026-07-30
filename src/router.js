const express = require("express");
const path = require("path");

const app = express();
const PUBLIC_DIR = path.join(__dirname, "public");

// Serves everything under /public automatically —
// public/css/style.css -> /css/style.css
// public/js/dashboard.js -> /js/dashboard.js
app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// /dashboard/:projectId  ->  req.params.projectId
app.get("/dashboard/:projectId", (req, res) => {
    const { projectId } = req.params;
console.log(`Dashboard request for projectId: ${projectId}`);
    // Not validated against real data yet — front-end JS reads
    // projectId from the URL and fetches that project's stats.
    // Once you have a real project list/DB, check it here and
    // call res.status(404).send("Project not found") if unknown.

    res.sendFile(path.join(PUBLIC_DIR, "dashboard.html"));
});

// Catch-all 404 — must be last
app.use((req, res) => {
    res.status(404).send("404 Page Not Found");
});

module.exports = app;