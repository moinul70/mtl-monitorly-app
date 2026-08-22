const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/projects
router.get('/', (req, res) => {
    try {
        const projects = db.prepare('SELECT id, project_name FROM projects ORDER BY id DESC').all();
        res.json({ projects });
    } catch (err) {
        console.error('Failed to fetch projects:', err);
        res.status(500).json({ message: 'Failed to load projects' });
    }
});

// POST /api/projects
router.post('/', (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(422).json({ message: 'Project name is required' });
    }

    const trimmedName = name.trim();

    try {
        const insert = db.prepare('INSERT INTO projects (project_name) VALUES (?)');
        const result = insert.run(trimmedName);

        const project = db.prepare('SELECT id, project_name FROM projects WHERE id = ?')
            .get(result.lastInsertRowid);

        res.status(201).json({ project });
    } catch (err) {
        // better-sqlite3 throws this specific error code on UNIQUE violations
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ message: `A project named "${trimmedName}" already exists.` });
        }

        console.error('Failed to create project:', err);
        res.status(500).json({ message: 'Failed to create project' });
    }
});

module.exports = router;