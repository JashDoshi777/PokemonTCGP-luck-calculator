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

// Basic in-memory brute-force guard for auth routes. Not durable across cold
// starts/instances in a real serverless deployment, but still meaningfully
// slows down naive automated credential-stuffing against a single instance.
const authAttempts = new Map();
const rateLimitAuth = (req, res, next) => {
  // Behind Netlify's proxy req.ip/req.socket typically reflect an internal
  // address rather than the real client, so prefer the forwarded header
  // (its first entry is the original client) and only fall back to req.ip
  // for local/direct-connection dev.
  const forwardedFor = req.headers['x-forwarded-for'];
  const key = (forwardedFor ? forwardedFor.split(',')[0].trim() : null) || req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxAttempts = 10;

  const attempts = (authAttempts.get(key) || []).filter(t => now - t < windowMs);
  if (attempts.length >= maxAttempts) {
    return res.status(429).json({ error: "Too many attempts, please try again shortly" });
  }
  attempts.push(now);
  authAttempts.set(key, attempts);
  next();
};

// A non-numeric :userId would otherwise hit a raw integer-column comparison
// deep in a query and bubble up as an opaque 500 - reject it cleanly upfront.
const validateUserIdParam = (req, res, next) => {
  if (!/^\d+$/.test(req.params.userId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  next();
};

// Two users may message/endorse each other if they've already exchanged a
// message, or if their trade listings are a mutual match (each offers what
// the other requests) - without this, any logged-in user could message or
// endorse any other user id directly, bypassing the match flow entirely.
const hasRelationship = async (userIdA, userIdB) => {
  const existingMessages = await pool.query(
    `SELECT 1 FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) LIMIT 1`,
    [userIdA, userIdB]
  );
  if (existingMessages.rows.length > 0) return true;

  const trades = await pool.query(
    `SELECT t1.offering_cards AS a_offer, t1.requesting_cards AS a_request,
            t2.offering_cards AS b_offer, t2.requesting_cards AS b_request
     FROM trades t1, trades t2
     WHERE t1.user_id = $1 AND t2.user_id = $2`,
    [userIdA, userIdB]
  );
  if (trades.rows.length === 0) return false;

  const { a_offer, a_request, b_offer, b_request } = trades.rows[0];
  const bGivesAWants = (b_offer || []).some(c => (a_request || []).includes(c));
  const aGivesBWants = (a_offer || []).some(c => (b_request || []).includes(c));
  return bGivesAWants && aGivesBWants;
};

// Initialize Tables - gated by a shared secret since this runs before any user
// account exists (so it can't require a login token like every other route).
app.get('/api/init', async (req, res) => {
  const providedSecret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SECRET || providedSecret !== process.env.ADMIN_SECRET) {
    return res.sendStatus(403);
  }
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
    // A user should have at most one trade listing - the check-then-insert-or-update
    // in POST /api/trade used to race under a double-submit and could leave
    // duplicate rows, which the chat/endorsement relationship check silently
    // assumed couldn't happen. Dedupe any existing duplicates (keep the most
    // recently updated row) before enforcing the constraint going forward.
    await pool.query(`
      DELETE FROM trades t USING trades newer
      WHERE t.user_id = newer.user_id AND t.updated_at < newer.updated_at;
    `);
    await pool.query(`
      DELETE FROM trades t USING trades other
      WHERE t.user_id = other.user_id AND t.id < other.id AND t.updated_at = other.updated_at;
    `);
    try { await pool.query(`ALTER TABLE trades ADD CONSTRAINT trades_user_id_unique UNIQUE (user_id);`); } catch (e) {}

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
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Auth Routes
app.post('/api/register', rateLimitAuth, async (req, res) => {
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

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: user.username });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: "Username already exists" });
    }
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post('/api/login', rateLimitAuth, async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: user.username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
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
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
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
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
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
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
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
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 2. Update current user's trade listing
app.post('/api/trade', authenticateToken, async (req, res) => {
  try {
    const { offering_cards, requesting_cards } = req.body;
    // Atomic upsert (relies on the unique constraint on trades.user_id from
    // /api/init) instead of a check-then-insert-or-update, which could race
    // under a double-submit and leave a user with two listing rows.
    await pool.query(
      `INSERT INTO trades (user_id, offering_cards, requesting_cards)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET offering_cards = $2, requesting_cards = $3, updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, JSON.stringify(offering_cards), JSON.stringify(requesting_cards)]
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
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
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Chat Routes
app.get('/api/chat/:userId', authenticateToken, validateUserIdParam, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    if (!(await hasRelationship(req.user.id, otherUserId))) return res.sendStatus(403);
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
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post('/api/chat/:userId', authenticateToken, validateUserIdParam, async (req, res) => {
  try {
    const receiverId = req.params.userId;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Message content cannot be empty" });
    }

    if (!(await hasRelationship(req.user.id, receiverId))) return res.sendStatus(403);

    const result = await pool.query(`
      INSERT INTO messages (sender_id, receiver_id, content) 
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.user.id, receiverId, content]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Notifications
app.get('/api/trade/notifications', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(DISTINCT sender_id) as unread FROM messages WHERE receiver_id = $1 AND is_read = FALSE', [req.user.id]);
    res.json({ unreadCount: parseInt(result.rows[0].unread, 10) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endorse Trader
app.post('/api/trade/endorse/:userId', authenticateToken, validateUserIdParam, async (req, res) => {
  try {
    const endorsedId = req.params.userId;
    if (endorsedId == req.user.id) return res.status(400).json({ error: "Cannot endorse yourself" });
    if (!(await hasRelationship(req.user.id, endorsedId))) {
      return res.status(403).json({ error: "You can only endorse a trader you've matched or chatted with" });
    }

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
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
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
