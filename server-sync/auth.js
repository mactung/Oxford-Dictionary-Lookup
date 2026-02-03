const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;
const SECRET_KEY = process.env.JWT_SECRET || 'oxford-lookup-secret-key-change-me';

module.exports = function(app, pool) {
    
    // Register
    app.post('/api/auth/register', async (req, res) => {
        const { email, password, username } = req.body;
        if (!email || !password || !username) {
            return res.status(400).json({ error: 'Missing fields' });
        }

        const connection = await pool.getConnection();
        try {
            // Check if user exists
            const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
            if (existing.length > 0) {
                return res.status(409).json({ error: 'Email already registered' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

            // Insert user
            const [result] = await connection.query(
                'INSERT INTO users (email, password_hash, username) VALUES (?, ?, ?)',
                [email, hashedPassword, username]
            );

            const userId = result.insertId;
            const token = jwt.sign({ id: userId, email, username }, SECRET_KEY, { expiresIn: '30d' });

            res.json({ success: true, token, user: { id: userId, email, username } });

        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({ error: 'Internal server error' });
        } finally {
            connection.release();
        }
    });

    // Login
    app.post('/api/auth/login', async (req, res) => {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Missing fields' });
        }

        const connection = await pool.getConnection();
        try {
            const [users] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
            if (users.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const user = users[0];
            const match = await bcrypt.compare(password, user.password_hash);

            if (!match) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, SECRET_KEY, { expiresIn: '30d' });

            res.json({ success: true, token, user: { id: user.id, email: user.email, username: user.username } });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        } finally {
            connection.release();
        }
    });

    // Verify Token Middleware
    const authenticateToken = (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) return res.sendStatus(401);

        jwt.verify(token, SECRET_KEY, (err, user) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    };

    return { authenticateToken };
};
