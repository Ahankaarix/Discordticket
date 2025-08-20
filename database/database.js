const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'tickets.db');
let db = null;

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
                reject(err);
                return;
            }
            
            console.log('Connected to SQLite database');
            
            // Create tables if they don't exist
            db.serialize(() => {
                // Tickets table
                db.run(`
                    CREATE TABLE IF NOT EXISTS tickets (
                        id TEXT PRIMARY KEY,
                        channel_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        category TEXT NOT NULL,
                        claimed_by TEXT DEFAULT NULL,
                        status TEXT DEFAULT 'open',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        closed_at DATETIME DEFAULT NULL
                    )
                `);
                
                // Ticket panels table
                db.run(`
                    CREATE TABLE IF NOT EXISTS ticket_panels (
                        guild_id TEXT PRIMARY KEY,
                        channel_id TEXT NOT NULL,
                        message_id TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                
                // Transcripts table
                db.run(`
                    CREATE TABLE IF NOT EXISTS transcripts (
                        ticket_id TEXT PRIMARY KEY,
                        content TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
            });
            
            resolve();
        });
    });
}

function getDatabase() {
    return db;
}

// Ticket operations
function createTicket(ticketId, channelId, userId, category) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO tickets (id, channel_id, user_id, category)
            VALUES (?, ?, ?, ?)
        `);
        
        stmt.run([ticketId, channelId, userId, category], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
        
        stmt.finalize();
    });
}

function getTicket(channelId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'
        `, [channelId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

function getAllOpenTickets() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM tickets WHERE status = 'open'
        `, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function claimTicket(channelId, adminId) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            UPDATE tickets SET claimed_by = ? WHERE channel_id = ? AND status = 'open'
        `);
        
        stmt.run([adminId, channelId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
        
        stmt.finalize();
    });
}

function closeTicket(channelId) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP 
            WHERE channel_id = ? AND status = 'open'
        `);
        
        stmt.run([channelId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
        
        stmt.finalize();
    });
}

// Panel operations
function saveTicketPanel(guildId, channelId, messageId) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO ticket_panels (guild_id, channel_id, message_id)
            VALUES (?, ?, ?)
        `);
        
        stmt.run([guildId, channelId, messageId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
        
        stmt.finalize();
    });
}

function getTicketPanel(guildId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT * FROM ticket_panels WHERE guild_id = ?
        `, [guildId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Transcript operations
function saveTranscript(ticketId, content) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO transcripts (ticket_id, content)
            VALUES (?, ?)
        `);
        
        stmt.run([ticketId, content], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
        
        stmt.finalize();
    });
}

module.exports = {
    initializeDatabase,
    getDatabase,
    createTicket,
    getTicket,
    getAllOpenTickets,
    claimTicket,
    closeTicket,
    saveTicketPanel,
    getTicketPanel,
    saveTranscript
};
