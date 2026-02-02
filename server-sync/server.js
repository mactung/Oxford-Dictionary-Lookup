require('dotenv').config();
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

initDB();

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

app.listen(PORT, () => {
    console.log(`Dictionary Sync Server running at http://localhost:${PORT}`);
});
