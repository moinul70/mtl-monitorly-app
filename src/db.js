const Database = require('better-sqlite3');

const db = new Database('database.sqlite');

db.prepare(`
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_name TEXT NOT NULL UNIQUE
    )
`).run();

module.exports = db;