require('dotenv').config();
const setupAuth = require('./auth');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Database Connection
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Auth Setup
const { authenticateToken } = setupAuth(app, pool);

// Init DB
async function initDB() {
    try {
        const connection = await pool.getConnection();
        console.log('Connected to MySQL. Initializing tables...');

        // 1. Entries (Main Table)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS entries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                headword VARCHAR(255) NOT NULL,
                pos VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_entry (headword, pos)
            )
        `);

        // 2. Phonetics
        await connection.query(`
            CREATE TABLE IF NOT EXISTS phonetics (
                id INT AUTO_INCREMENT PRIMARY KEY,
                entry_id INT,
                type VARCHAR(50), 
                ipa VARCHAR(255),
                audio_url TEXT,
                FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
            )
        `);

        // 3. Senses
        await connection.query(`
            CREATE TABLE IF NOT EXISTS senses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                entry_id INT,
                definition TEXT,
                cefr VARCHAR(20),
                grammar VARCHAR(255),
                labels VARCHAR(255),
                order_index INT,
                FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
            )
        `);

        // 4. Examples
        await connection.query(`
            CREATE TABLE IF NOT EXISTS examples (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sense_id INT,
                text MEDIUMTEXT,
                pattern VARCHAR(255),
                label VARCHAR(255),
                FOREIGN KEY (sense_id) REFERENCES senses(id) ON DELETE CASCADE
            )
        `);

        // 5. Synonyms
        await connection.query(`
            CREATE TABLE IF NOT EXISTS synonyms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sense_id INT,
                word VARCHAR(255),
                FOREIGN KEY (sense_id) REFERENCES senses(id) ON DELETE CASCADE
            )
        `);

        // 6. Idioms
        await connection.query(`
            CREATE TABLE IF NOT EXISTS idioms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                entry_id INT,
                phrase VARCHAR(255),
                definition TEXT,
                FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
            )
        `);

        // 7. Verb Forms
        await connection.query(`
            CREATE TABLE IF NOT EXISTS verb_forms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                entry_id INT,
                form_name VARCHAR(100),
                value VARCHAR(255),
                FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
            )
        `);

        // 8. Phrasal Verbs
        await connection.query(`
            CREATE TABLE IF NOT EXISTS phrasal_verbs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                entry_id INT,
                headword VARCHAR(255),
                FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
            )
        `);

        // 9. Topics
        await connection.query(`
            CREATE TABLE IF NOT EXISTS topics (
                id INT AUTO_INCREMENT PRIMARY KEY,
                entry_id INT,
                topic_name VARCHAR(255),
                FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
            )
        `);

        console.log('All tables ready.');
        connection.release();
    } catch (error) {
        console.error('Database initialization failed:', error);
    }
}

// Init User DB
async function initUserDB() {
    try {
        const connection = await pool.getConnection();
        console.log('Initializing User tables...');

        // 1. Users
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                username VARCHAR(100),
                streak_days INT DEFAULT 0,
                last_practice_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration: Add columns if they don't exist (for existing tables)
        try {
            await connection.query('ALTER TABLE users ADD COLUMN streak_days INT DEFAULT 0');
        } catch (e) { /* ignore if exists */ }
        try {
            await connection.query('ALTER TABLE users ADD COLUMN last_practice_date DATE');
        } catch (e) { /* ignore if exists */ }

        // 2. User Words (Link user to dictionary entries)
        // Store user-specific data like SRS level, next review, notes
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_words (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                headword VARCHAR(255) NOT NULL,
                srs_level INT DEFAULT 0,
                next_review TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_word (user_id, headword),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        // 3. Practice Logs (For Leaderboard)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS practice_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                points INT DEFAULT 0,
                words_practiced INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('User tables ready.');
        connection.release();
    } catch (error) {
        console.error('User DB initialization failed:', error);
    }
}

initDB();
initUserDB();

// Helper: Clear child data for an entry (to rewrite fresh data)
async function clearEntryChildren(connection, entryId) {
    // Senses (cascades to examples, synonyms), Phonetics, Idioms, etc.
    // Because we used ON DELETE CASCADE in Foreign Keys, we just need to delete from immediate child tables
    // But wait, if we delete the Entry, everything goes. 
    // BUT we want to keep the Entry ID if possible? Or just upsert Entry and delete children?
    // User strategy: "Xoá sạch data con cũ ... và insert lại"
    
    await connection.query('DELETE FROM phonetics WHERE entry_id = ?', [entryId]);
    await connection.query('DELETE FROM senses WHERE entry_id = ?', [entryId]); // Cascades examples, synonyms
    await connection.query('DELETE FROM idioms WHERE entry_id = ?', [entryId]);
    await connection.query('DELETE FROM verb_forms WHERE entry_id = ?', [entryId]);
    await connection.query('DELETE FROM phrasal_verbs WHERE entry_id = ?', [entryId]);
    await connection.query('DELETE FROM topics WHERE entry_id = ?', [entryId]);
}

// Sync Endpoint
app.post('/api/sync', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const data = req.body;
        if (!data || !data.headword) {
            throw new Error('Invalid data');
        }
        
        const headword = data.headword;
        const pos = data.pos || '';

        console.log(`Syncing: ${headword} (${pos})`);

        // 1. Find or Create Entry
        // We use headword + pos as unique key
        let [rows] = await connection.query('SELECT id FROM entries WHERE headword = ? AND pos = ?', [headword, pos]);
        let entryId;

        if (rows.length > 0) {
            entryId = rows[0].id;
            // Clear old children to replace with new data
            await clearEntryChildren(connection, entryId);
            // Touch updated_at
            await connection.query('UPDATE entries SET updated_at = NOW() WHERE id = ?', [entryId]);
        } else {
            const [result] = await connection.query('INSERT INTO entries (headword, pos) VALUES (?, ?)', [headword, pos]);
            entryId = result.insertId;
        }

        // 2. Insert Phonetics
        if (data.phonetics && data.phonetics.length > 0) {
            const phoneticValues = data.phonetics.map(p => [entryId, p.type, p.ipa, p.audioUrl]);
            await connection.query('INSERT INTO phonetics (entry_id, type, ipa, audio_url) VALUES ?', [phoneticValues]);
        }

        // 3. Insert Senses (and children)
        if (data.senses && data.senses.length > 0) {
            // Can't do bulk insert easily because we need insertId for examples/synonyms
            for (let i = 0; i < data.senses.length; i++) {
                const s = data.senses[i];
                const [res] = await connection.query(
                    'INSERT INTO senses (entry_id, definition, cefr, grammar, labels, order_index) VALUES (?, ?, ?, ?, ?, ?)',
                    [entryId, s.definition, s.cefr, s.grammar, s.labels, i]
                );
                const senseId = res.insertId;

                // Examples
                if (s.examples && s.examples.length > 0) {
                    const exValues = s.examples.map(ex => {
                        // Extension might send string or object
                        if (typeof ex === 'string') return [senseId, ex, null, null];
                        return [senseId, ex.text, ex.pattern, ex.label];
                    });
                    await connection.query('INSERT INTO examples (sense_id, text, pattern, label) VALUES ?', [exValues]);
                }

                // Synonyms
                if (s.synonyms && s.synonyms.length > 0) {
                    const synValues = s.synonyms.map(syn => [senseId, syn]);
                    await connection.query('INSERT INTO synonyms (sense_id, word) VALUES ?', [synValues]);
                }
            }
        }

        // 4. Idioms
        if (data.idioms && data.idioms.length > 0) {
            const idiomValues = data.idioms.map(idm => [entryId, idm.phrase, idm.definition]);
            await connection.query('INSERT INTO idioms (entry_id, phrase, definition) VALUES ?', [idiomValues]);
        }

        // 5. Verb Forms
        if (data.verbForms && data.verbForms.length > 0) {
            const vfValues = data.verbForms.map(vf => [entryId, vf.form, vf.value]);
            await connection.query('INSERT INTO verb_forms (entry_id, form_name, value) VALUES ?', [vfValues]);
        }

        // 6. Phrasal Verbs
        if (data.phrasalVerbs && data.phrasalVerbs.length > 0) {
            const pvValues = data.phrasalVerbs.map(pv => [entryId, pv]);
            await connection.query('INSERT INTO phrasal_verbs (entry_id, headword) VALUES ?', [pvValues]);
        }

        // 7. Topics
        if (data.topics && data.topics.length > 0) {
            const tValues = data.topics.map(t => [entryId, t]);
            await connection.query('INSERT INTO topics (entry_id, topic_name) VALUES ?', [tValues]);
        }

        await connection.commit();
        console.log('Sync completed successfully.');
        res.json({ success: true, message: 'Data synced to normalized DB' });

    } catch (error) {
        await connection.rollback();
        console.error('Error syncing data:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

// --- User Sync and Leaderboard ---

// Sync User Vocabulary
app.post('/api/user/sync', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { vocabulary } = req.body; // Array of { headword, srsLevel, nextReview, ... }

    if (!Array.isArray(vocabulary)) {
        return res.status(400).json({ error: 'Invalid data format' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Strategy: Upsert.
        // If we want true "sync" with conflict resolution (e.g. valid timestamps), it's complex.
        // For now: Client sends their full valid list (or changes). 
        // We will simple "Upsert" provided words.
        
        for (const word of vocabulary) {
            await connection.query(`
                INSERT INTO user_words (user_id, headword, srs_level, next_review, updated_at)
                VALUES (?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                    srs_level = VALUES(srs_level),
                    next_review = VALUES(next_review),
                    updated_at = NOW()
            `, [userId, word.headword, word.srsLevel || 0, word.nextReview ? new Date(word.nextReview) : new Date()]);
        }

        await connection.commit();
        
        // Return latest data from server
        const [rows] = await connection.query('SELECT headword, srs_level, next_review FROM user_words WHERE user_id = ?', [userId]);
        
        res.json({ success: true, vocabulary: rows });

    } catch (error) {
        await connection.rollback();
        console.error('User sync error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

// Get User Vocabulary (Download)
app.get('/api/user/vocabulary', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query('SELECT headword, srs_level, next_review FROM user_words WHERE user_id = ?', [userId]);
        res.json({ success: true, vocabulary: rows });
    } catch (error) {
        console.error('Get user vocab error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

// Record Practice (Update Leaderboard & Streak)
app.post('/api/user/practice', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { points, wordsCount } = req.body;

    if (!points) return res.status(400).json({ error: 'Points required' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Log Practice
        await connection.query('INSERT INTO practice_logs (user_id, points, words_practiced) VALUES (?, ?, ?)', 
            [userId, points, wordsCount || 0]);
        
        // 2. Update Streak
        // Fetch current streak info
        const [rows] = await connection.query('SELECT streak_days, last_practice_date FROM users WHERE id = ? FOR UPDATE', [userId]);
        if (rows.length > 0) {
            let { streak_days, last_practice_date } = rows[0];
            const today = new Date().toISOString().split('T')[0];
            
            // Javascript Date handling can be tricky with timezones, assuming server time is consistent
            // Ideally should use DB time for comparison or consistent UTC
            
            if (last_practice_date) {
                const lastDate = new Date(last_practice_date).toISOString().split('T')[0];
                const diffTime = new Date(today) - new Date(lastDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    // Consecutive day
                    streak_days = (streak_days || 0) + 1;
                } else if (diffDays > 1) {
                    // Missed a day (or more)
                    streak_days = 1;
                }
                // If diffDays === 0 (same day), do nothing
            } else {
                // First time
                streak_days = 1;
            }

            // Update user
            await connection.query('UPDATE users SET streak_days = ?, last_practice_date = ? WHERE id = ?', 
                [streak_days, today, userId]);
        }

        await connection.commit();
        res.json({ success: true, streak: rows[0]?.streak_days });
    } catch (error) {
        await connection.rollback();
        console.error('Practice log error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});
// Get Entry by Headword (For Extension - Local First)
app.get('/api/entry/:headword', async (req, res) => {
    const headword = req.params.headword;
    const connection = await pool.getConnection();
    try {
        // 1. Fetch Entry
        const [entries] = await connection.query('SELECT * FROM entries WHERE headword = ?', [headword]);
        if (entries.length === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        const entry = entries[0];

        // 2. Fetch Children
        const [phonetics] = await connection.query('SELECT * FROM phonetics WHERE entry_id = ?', [entry.id]);
        const [senses] = await connection.query('SELECT * FROM senses WHERE entry_id = ? ORDER BY order_index', [entry.id]);
        
        // Enrich Senses with Examples and Synonyms
        for (const sense of senses) {
            const [examples] = await connection.query('SELECT * FROM examples WHERE sense_id = ?', [sense.id]);
            sense.examples = examples;
            const [synonyms] = await connection.query('SELECT word FROM synonyms WHERE sense_id = ?', [sense.id]);
            sense.synonyms = synonyms.map(s => s.word);
        }

        const [idioms] = await connection.query('SELECT * FROM idioms WHERE entry_id = ?', [entry.id]);
        const [verbForms] = await connection.query('SELECT * FROM verb_forms WHERE entry_id = ?', [entry.id]);
        const [phrasalVerbs] = await connection.query('SELECT headword FROM phrasal_verbs WHERE entry_id = ?', [entry.id]);
        const [topics] = await connection.query('SELECT topic_name FROM topics WHERE entry_id = ?', [entry.id]);

        // Construct response matching what extension expects from parseOxfordHTML
        const responseData = {
            headword: entry.headword,
            pos: entry.pos,
            phonetics: phonetics.map(p => ({
                type: p.type,
                ipa: p.ipa,
                audioUrl: p.audio_url
            })),
            senses: senses.map(s => ({
                definition: s.definition,
                cefr: s.cefr,
                grammar: s.grammar,
                labels: s.labels,
                examples: s.examples.map(ex => ({ text: ex.text, pattern: ex.pattern })),
                synonyms: s.synonyms
            })),
            idioms: idioms.map(idm => ({ phrase: idm.phrase, definition: idm.definition })),
            verbForms: verbForms.map(vf => ({ form: vf.form_name, value: vf.value })),
            phrasalVerbs: phrasalVerbs.map(pv => pv.headword),
            topics: topics.map(t => t.topic_name)
        };

        res.json(responseData);

    } catch (error) {
        console.error('Get entry error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

// Get Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    const { period } = req.query; // 'all', 'week', 'month' - Default 'all'
    
    // Simple all-time leaderboard for now
    const query = `
        SELECT 
            u.username, 
            u.streak_days,
            SUM(p.points) as total_points, 
            COUNT(DISTINCT p.id) as sessions,
            (SELECT COUNT(*) FROM user_words uw WHERE uw.user_id = u.id AND uw.srs_level >= 4) as mastered_words
        FROM users u
        LEFT JOIN practice_logs p ON u.id = p.user_id
        GROUP BY u.id
        ORDER BY mastered_words DESC, total_points DESC
        LIMIT 10
    `;

    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query(query);
        res.json({ success: true, leaderboard: rows });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

app.listen(PORT, () => {
    console.log(`Dictionary Sync Server running at http://localhost:${PORT}`);
});
