import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import serverless from 'serverless-http';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Initialize Tables
app.get('/api/init', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_data (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
        collection JSONB DEFAULT '{}'::jsonb,
        wishlist JSONB DEFAULT '{}'::jsonb,
        custom_decks JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    res.json({ message: "Database initialized successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );
    
    const user = result.rows[0];
    await pool.query('INSERT INTO user_data (user_id) VALUES ($1)', [user.id]);

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
    res.json({ token, username: user.username });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: "Username already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
    res.json({ token, username: user.username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Data Sync Routes
app.get('/api/sync', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT collection, wishlist, custom_decks FROM user_data WHERE user_id = $1', [req.user.id]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      res.json({
        collection: row.collection,
        wishlist: row.wishlist,
        customDecks: row.custom_decks
      });
    } else {
      res.json({ collection: {}, wishlist: {}, customDecks: [] });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sync', authenticateToken, async (req, res) => {
  try {
    const { collection, wishlist, customDecks } = req.body;
    await pool.query(
      'UPDATE user_data SET collection = $1, wishlist = $2, custom_decks = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $4',
      [collection || {}, wishlist || {}, customDecks || [], req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export const handler = serverless(app);
export const expressApp = app;

// For local development
if (process.env.NODE_ENV !== 'production' && process.env.RUN_LOCAL === 'true') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Express API running on http://localhost:${PORT}`);
  });
}
