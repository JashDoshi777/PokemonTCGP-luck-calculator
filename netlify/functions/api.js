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

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    
    // Update last_active timestamp in the background
    pool.query('UPDATE user_data SET last_active = CURRENT_TIMESTAMP WHERE user_id = $1', [user.id]).catch(console.error);

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
        in_game_id VARCHAR(255),
        successful_trades INTEGER DEFAULT 0,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Add columns to existing user_data if missing
    try { await pool.query(`ALTER TABLE user_data ADD COLUMN in_game_id VARCHAR(255);`); } catch (e) {}
    try { await pool.query(`ALTER TABLE user_data ADD COLUMN successful_trades INTEGER DEFAULT 0;`); } catch (e) {}
    try { await pool.query(`ALTER TABLE user_data ADD COLUMN last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`); } catch (e) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        offering_cards JSONB DEFAULT '[]'::jsonb,
        requesting_cards JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id),
        receiver_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    try { await pool.query(`ALTER TABLE messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE;`); } catch (e) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS endorsements (
        id SERIAL PRIMARY KEY,
        endorser_id INTEGER REFERENCES users(id),
        endorsed_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(endorser_id, endorsed_id)
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
    const { collection, wishlist, customDecks, inGameId } = req.body;
    
    // First check if user_data exists
    const checkResult = await pool.query('SELECT user_id FROM user_data WHERE user_id = $1', [req.user.id]);
    
    if (checkResult.rows.length === 0) {
      await pool.query('INSERT INTO user_data (user_id) VALUES ($1)', [req.user.id]);
    }

    // Build the query dynamically based on what's provided, to allow partial updates
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (collection !== undefined) {
      updates.push(`collection = $${paramIndex++}`);
      values.push(collection);
    }
    if (wishlist !== undefined) {
      updates.push(`wishlist = $${paramIndex++}`);
      values.push(wishlist);
    }
    if (customDecks !== undefined) {
      updates.push(`custom_decks = $${paramIndex++}`);
      values.push(customDecks);
    }
    if (inGameId !== undefined) {
      updates.push(`in_game_id = $${paramIndex++}`);
      values.push(inGameId);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(req.user.id);
      
      const updateQuery = `UPDATE user_data SET ${updates.join(', ')} WHERE user_id = $${paramIndex}`;
      await pool.query(updateQuery, values);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get User Data (specifically for inGameId)
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT in_game_id, successful_trades FROM user_data WHERE user_id = $1', [req.user.id]);
    const inGameId = result.rows.length > 0 ? result.rows[0].in_game_id : null;
    const successfulTrades = result.rows.length > 0 ? (result.rows[0].successful_trades || 0) : 0;
    res.json({ inGameId, successfulTrades });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trading Routes

// 1. Get current user's trade listing
app.get('/api/trade', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT offering_cards, requesting_cards FROM trades WHERE user_id = $1', [req.user.id]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json({ offering_cards: [], requesting_cards: [] });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Update current user's trade listing
app.post('/api/trade', authenticateToken, async (req, res) => {
  try {
    const { offering_cards, requesting_cards } = req.body;
    const check = await pool.query('SELECT id FROM trades WHERE user_id = $1', [req.user.id]);
    if (check.rows.length > 0) {
      await pool.query(
        'UPDATE trades SET offering_cards = $1, requesting_cards = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3',
        [JSON.stringify(offering_cards), JSON.stringify(requesting_cards), req.user.id]
      );
    } else {
      await pool.query(
        'INSERT INTO trades (user_id, offering_cards, requesting_cards) VALUES ($1, $2, $3)',
        [req.user.id, JSON.stringify(offering_cards), JSON.stringify(requesting_cards)]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Find Matches
app.get('/api/trade/matches', authenticateToken, async (req, res) => {
  try {
    // Get my trade
    const myTrade = await pool.query('SELECT offering_cards, requesting_cards FROM trades WHERE user_id = $1', [req.user.id]);
    if (myTrade.rows.length === 0) {
      return res.json([]);
    }
    const myOffering = myTrade.rows[0].offering_cards || [];
    const myRequesting = myTrade.rows[0].requesting_cards || [];

    if (myOffering.length === 0 || myRequesting.length === 0) {
      return res.json([]); // Need both to match
    }

    // Find others where they offer what I request, and they request what I offer
    // Using Postgres JSONB ?| operator to check if ANY element matches
    const matchesQuery = `
      SELECT t.user_id as match_user_id, u.username as match_username, ud.in_game_id, ud.successful_trades, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ud.last_active)) as seconds_since_active, t.offering_cards as match_offering, t.requesting_cards as match_requesting,
             (SELECT COUNT(*) FROM messages m WHERE m.sender_id = t.user_id AND m.receiver_id = $1 AND m.is_read = FALSE) as unread_messages
      FROM trades t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN user_data ud ON t.user_id = ud.user_id
      WHERE t.user_id != $1
        AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(t.offering_cards) AS o WHERE o = ANY($2::text[]))
        AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(t.requesting_cards) AS r WHERE r = ANY($3::text[]))
    `;
    
    // We pass arrays of strings for ?|
    const matches = await pool.query(matchesQuery, [
      req.user.id,
      myRequesting, // Their offering contains any of my requesting
      myOffering    // Their requesting contains any of my offering
    ]);

    // Format the response to show exactly which cards match
    const formattedMatches = matches.rows.map(m => {
      // Find intersection
      const theyGiveIWant = m.match_offering.filter(c => myRequesting.includes(c));
      const iGiveTheyWant = myOffering.filter(c => m.match_requesting.includes(c));
      
      return {
        userId: m.match_user_id,
        username: m.match_username,
        inGameId: m.in_game_id,
        successfulTrades: m.successful_trades || 0,
        lastActive: m.seconds_since_active !== null ? parseInt(m.seconds_since_active, 10) : null,
        unreadMessages: parseInt(m.unread_messages, 10) || 0,
        theyGiveIWant,
        iGiveTheyWant
      };
    });

    res.json(formattedMatches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat Routes
app.get('/api/chat/:userId', authenticateToken, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    // Mark messages as read in the background
    pool.query(`UPDATE messages SET is_read = TRUE WHERE receiver_id = $1 AND sender_id = $2 AND is_read = FALSE`, [req.user.id, otherUserId]).catch(console.error);

    const result = await pool.query(`
      SELECT m.*, u.username as sender_username 
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2)
         OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
    `, [req.user.id, otherUserId]);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/:userId', authenticateToken, async (req, res) => {
  try {
    const receiverId = req.params.userId;
    const { content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Message content cannot be empty" });
    }

    const result = await pool.query(`
      INSERT INTO messages (sender_id, receiver_id, content) 
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.user.id, receiverId, content]);
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Notifications
app.get('/api/trade/notifications', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(DISTINCT sender_id) as unread FROM messages WHERE receiver_id = $1 AND is_read = FALSE', [req.user.id]);
    res.json({ unreadCount: parseInt(result.rows[0].unread, 10) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endorse Trader
app.post('/api/trade/endorse/:userId', authenticateToken, async (req, res) => {
  try {
    const endorsedId = req.params.userId;
    if (endorsedId == req.user.id) return res.status(400).json({ error: "Cannot endorse yourself" });

    // Try to insert endorsement
    const insertResult = await pool.query(`
      INSERT INTO endorsements (endorser_id, endorsed_id) 
      VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id
    `, [req.user.id, endorsedId]);

    if (insertResult.rowCount > 0) {
      // Successfully inserted, increment successful_trades
      await pool.query('UPDATE user_data SET successful_trades = successful_trades + 1 WHERE user_id = $1', [endorsedId]);
      res.json({ success: true, message: "Endorsement added" });
    } else {
      res.status(400).json({ error: "Already endorsed this user" });
    }
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
