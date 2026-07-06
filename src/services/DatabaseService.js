'use strict';

/*
Database Service Responsibilities: SQLite, Initialize DB, Create Schema, CRUD, Txns.
*/

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const configuration = require('../config/config');

const CREATE_PAGES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    domain TEXT NOT NULL,
    title TEXT,
    description TEXT,
    summary TEXT,
    content TEXT,
    keywords TEXT,
    content_hash TEXT,
    status_code INTEGER,
    last_crawled TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, 
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

const CREATE_SEARCH_HISTORY_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    searched_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

const CREATE_SETTINGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

const CREATE_CRAWL_QUEUE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS crawl_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

const CREATE_CRAWL_ERRORS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS crawl_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

const CREATE_INDEXES_SQL = [
    ` CREATE INDEX IF NOT EXISTS idx_pages_domain
      ON pages(domain); `,

    ` CREATE INDEX IF NOT EXISTS idx_pages_title
      ON pages(title); `,

    ` CREATE INDEX IF NOT EXISTS idx_pages_url
      ON pages(url); `,

    ` CREATE INDEX IF NOT EXISTS idx_history_query
      ON search_history(query); `
];

class DatabaseService {
    constructor() {
        this.database = null;
        this.databaseDirectory = configuration.database.directory;
        this.databaseFilePath = path.join(this.databaseDirectory, configuration.database.filename);
        this.connected = false;
    }

    initialize() {
    return this.ensureDatabaseDirectoryExists()
        .then(() => this.connect())
        .then(() => this.createTables())
        .then(() => this.createIndexes());
    }

    ensureDatabaseDirectoryExists() {
    return new Promise((resolve, reject) => {
        try {
            if (!fs.existsSync(this.databaseDirectory)) {
                fs.mkdirSync(this.databaseDirectory, {
                    recursive: true
                });
            }
            resolve();
        } catch (err) {
            reject(err);
        }
    });
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this.database = new sqlite3.Database(
                this.databaseFilePath,
                (error) => {
                    if (error) {
                        reject (error);
                        return;
                    }

                    this.connected = true;
                    resolve();
                }
            );
        });
    }

   run(sql, parameters = []) {
    return new Promise((resolve, reject) => {
        this.database.run(sql, parameters, function (error) {
            if (error) {
                return reject(error);
            }

            resolve({
                id: this.lastID,
                changes: this.changes
            });
        });
    });
    }

    get(sql, parameters = []) {
    return new Promise((resolve, reject) => {
        this.database.get(sql, parameters, (error, row) => {
            if (error) {
                return reject(error);
            }

            resolve(row ?? null);
        });
    });
    }

    all(sql, parameters = []) {
    return new Promise((resolve, reject) => {
        this.database.all(sql, parameters, (error, rows) => {
            if (error) {
                return reject(error);
            }

            resolve(rows);
        });
    });
    }

    beginTransaction() {
    return this.run('BEGIN TRANSACTION');
    }

    commitTransaction() {
    return this.run('COMMIT');
    }

    rollbackTransaction() {
    return this.run('ROLLBACK');
    }

    createTables() {
    return Promise.all([
        this.run(CREATE_PAGES_TABLE_SQL),
        this.run(CREATE_SEARCH_HISTORY_TABLE_SQL),
        this.run(CREATE_SETTINGS_TABLE_SQL),
        this.run(CREATE_CRAWL_QUEUE_TABLE_SQL),
        this.run(CREATE_CRAWL_ERRORS_TABLE_SQL)
    ]);
    }

    createIndexes() {
    return CREATE_INDEXES_SQL.reduce(
        (promise, sql) => promise.then(() => this.run(sql)),
        Promise.resolve()
    );
    }

    insertPage(pageData) {
    const sql = `
        INSERT INTO pages (
            url,
            domain,
            title,
            description,
            summary,
            content,
            keywords,
            content_hash,
            status_code,
            last_crawled
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return this.run(sql, [
        pageData.url,
        pageData.domain,
        pageData.title,
        pageData.description,
        pageData.summary,
        pageData.content,
        pageData.keywords,
        pageData.contentHash,
        pageData.statusCode,
        pageData.lastCrawled
    ]);
    }

    updatePage(pageData) {
    const sql = `
        UPDATE pages
        SET
            domain = ?,
            title = ?,
            description = ?,
            summary = ?,
            content = ?,
            keywords = ?,
            content_hash = ?,
            status_code = ?,
            last_crawled = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE url = ?
    `;

    return this.run(sql, [
        pageData.domain,
        pageData.title,
        pageData.description,
        pageData.summary,
        pageData.content,
        pageData.keywords,
        pageData.contentHash,
        pageData.statusCode,
        pageData.lastCrawled,
        pageData.url
    ]);
    }

    deletePage(url) {
    return this.run("DELETE FROM pages WHERE url = ?", [url]);
    }

    getPageByUrl(url) {
    return this.get("SELECT * FROM pages WHERE url = ?", [url]);
    }

    getPagesByDomain(domain) {
    return this.all("SELECT * FROM pages WHERE domain = ?", [domain]);
    }

    pageExists(url) {
    return this.get("SELECT id FROM pages WHERE url = ?", [url])
        .then(result => result !== undefined);
    }

    saveSearchHistory(query) {
    return this.run(
        "INSERT INTO search_history (query) VALUES (?)",
        [query]
    );
    }

    getSearchHistory(limit) {
    limit = limit || 25;

    return this.all(
        `
        SELECT *
        FROM search_history
        ORDER BY searched_at DESC
        LIMIT ?
        `,
        [limit]
    );
    }

    clearSearchHistory() {
    return this.run("DELETE FROM search_history");
    }

    saveSetting(key, value) {
    return this.run(
        `
        INSERT OR REPLACE INTO settings (
            key,
            value,
            updated_at
        )
        VALUES (?, ?, CURRENT_TIMESTAMP)
        `,
        [key, value]
    );
    }

    getSetting(key) {
    return this.get(
        "SELECT value FROM settings WHERE key = ?",
        [key]
    );
    }

    getAllSettings() {
    return this.all("SELECT * FROM settings");
    }

    addToCrawlQueue(url, priority) {
    priority = priority || 0;

    return this.run(
        `
        INSERT OR IGNORE INTO crawl_queue (
            url,
            priority
        )
        VALUES (?, ?)
        `,
        [url, priority]
    );
    }

    getPendingQueue(limit) {
    limit = limit || 50;

    return this.all(
        `
        SELECT *
        FROM crawl_queue
        WHERE status = 'pending'
        ORDER BY priority DESC
        LIMIT ?
        `,
        [limit]
    );
    }

    updateQueueStatus(id, status) {
    return this.run(
        `
        UPDATE crawl_queue
        SET status = ?
        WHERE id = ?
        `,
        [status, id]
    );
    }

    logCrawlerError(url, message) {
    return this.run(
        `
        INSERT INTO crawl_errors (
            url,
            error_message
        )
        VALUES (?, ?)
        `,
        [url, message]
    );
    }

    vacuum() {
    return this.run("VACUUM");
    }

    optimize() {
    return this.run("ANALYZE");
    }

    close() {
    return new Promise((resolve, reject) => {
        this.database.close(error => {
            if (error) {
                reject(error);
                return;
            }

            this.connected = false;
            resolve();
        });
    });
    }
}