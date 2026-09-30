import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import serverless from 'serverless-http';
import crypto from 'node:crypto';

const { Pool } = pkg;

dotenv.config();

const isProd = process.env.NODE_ENV === 'production' || !!process.env.NETLIFY;

// ---------------------------------------------------------------------------
// App + database setup
// ---------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');
app.set('etag', false);

// The site and the API share an origin on Netlify, so cross-origin access is
// closed by default. Extra origins (e.g. a staging site) go in ALLOWED_ORIGINS.
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
);
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const isLocalDev = !isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    callback(null, allowedOrigins.has(origin) || isLocalDev);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret'],
  maxAge: 600
}));

// API responses are per-user and must never be cached by browsers or proxies.
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin'
  });
  next();
});

app.use(express.json({ limit: '1mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Certificate verification stays on; DATABASE_SSL_INSECURE=true is an explicit local escape hatch.
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== 'true' },
  max: 8,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 8_000
});
// An idle connection being dropped by the server must not crash the process.
pool.on('error', (err) => console.error('Idle database client error:', err.message));

const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
    throw error;
  } finally {
    client.release();
  }
};

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
const JWT_OPTIONS = { algorithm: 'HS256', expiresIn: '30d' };

const signToken = (user) => jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, JWT_OPTIONS);

const readToken = (req) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!Number.isInteger(payload.id) || typeof payload.username !== 'string') return null;
    return { id: payload.id, username: payload.username };
  } catch {
    return null;
  }
};

const PRESENCE_INTERVAL_MS = 60 * 1000;
const lastSeenCache = new Map(); // userId -> time of the last presence write from this instance

const authenticateToken = async (req, res, next) => {
  const user = readToken(req);
  if (!user) return res.status(401).json({ error: 'Please sign in again' });
  req.user = user;

  // Presence is used for the "online" dot in trading; once a minute is plenty.
  // This instance remembers who it already recorded, so most requests skip the
  // database entirely. When a write is needed it is awaited, because serverless
  // runtimes can freeze after the response is sent.
  const now = Date.now();
  if (now - (lastSeenCache.get(user.id) || 0) >= PRESENCE_INTERVAL_MS) {
    if (lastSeenCache.size > 5000) lastSeenCache.clear();
    lastSeenCache.set(user.id, now);
    try {
      await pool.query(
        `UPDATE user_data SET last_active = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND (last_active IS NULL OR last_active < CURRENT_TIMESTAMP - INTERVAL '60 seconds')`,
        [user.id]
      );
    } catch (error) {
      lastSeenCache.delete(user.id); // try again on the next request
      console.error('last_active update failed:', error.message);
    }
  }
  next();
};

// Like authenticateToken, but anonymous visitors are allowed through: a valid
// token sets req.user, a missing/invalid one just leaves it undefined.
const optionalAuth = (req, res, next) => {
  const user = readToken(req);
  if (user) req.user = user;
  next();
};

// Admins are identified server-side by username (from the signed JWT) against
// the ADMIN_USERNAMES env var - never by anything the client sends. Fails
// closed if the env var isn't set. Usernames are unique case-insensitively
// (see users_username_lower_unique), so a different-capitalisation copy of an
// admin's name can never be registered as a second account.
const adminNames = () => (process.env.ADMIN_USERNAMES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const isAdminUser = (user) => !!user?.username && adminNames().includes(user.username.toLowerCase());

const safeEqual = (a, b) => {
  const hash = (v) => crypto.createHash('sha256').update(String(v)).digest();
  return crypto.timingSafeEqual(hash(a), hash(b));
};

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
// Netlify sets x-nf-client-connection-ip at its edge (clients can't forge it).
// X-Forwarded-For is deliberately NOT trusted: it is client-controlled.
const clientIp = (req) => String(req.headers['x-nf-client-connection-ip'] || req.socket?.remoteAddress || 'unknown');

// Fast in-memory limiter: slows bursts on one warm instance. The durable,
// cross-instance protection for login/register lives in the database (below).
const createRateLimiter = ({ maxAttempts, windowMs, keyFn = clientIp }) => {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 5000) {
      for (const [key, times] of hits) {
        if (!times.length || now - times[times.length - 1] > windowMs) hits.delete(key);
      }
    }
    const key = keyFn(req);
    const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (recent.length >= maxAttempts) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'Too many attempts, please try again shortly' });
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
};

const rateLimitAuth = createRateLimiter({ maxAttempts: 20, windowMs: 60 * 1000 });
const rateLimitWaitlist = createRateLimiter({ maxAttempts: 20, windowMs: 60 * 1000 });
const rateLimitProfile = createRateLimiter({ maxAttempts: 60, windowMs: 60 * 1000 });
const rateLimitTrack = createRateLimiter({ maxAttempts: 120, windowMs: 60 * 1000 });
const rateLimitChat = createRateLimiter({ maxAttempts: 30, windowMs: 60 * 1000, keyFn: (req) => `u${req.user?.id ?? clientIp(req)}` });
const rateLimitWrite = createRateLimiter({ maxAttempts: 60, windowMs: 60 * 1000, keyFn: (req) => `u${req.user?.id ?? clientIp(req)}` });

// Durable throttle for credential endpoints, shared by every serverless instance.
const attemptsInWindow = async (key, minutes) => {
  const result = await pool.query(
    `SELECT COUNT(*) AS n FROM auth_attempts WHERE key = $1 AND at > CURRENT_TIMESTAMP - ($2 * INTERVAL '1 minute')`,
    [key, minutes]
  );
  return parseInt(result.rows[0].n, 10);
};
const recordAttempt = (key) => pool.query('INSERT INTO auth_attempts (key) VALUES ($1)', [key]);
const clearAttempts = (key) => pool.query('DELETE FROM auth_attempts WHERE key = $1', [key]);

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,24}$/;
const RESERVED_USERNAMES = new Set(['admin', 'administrator', 'root', 'support', 'moderator', 'mod', 'system', 'staff', 'official', 'pocketdex']);
const CARD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;
const VISITOR_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isPassword = (v) => typeof v === 'string' && v.length >= 8 && Buffer.byteLength(v) <= 72; // bcrypt ignores bytes past 72

const MAX_COLLECTION_KEYS = 6000;
const MAX_DECKS = 100;
const MAX_DECK_CARDS = 40;
const MAX_TRADE_CARDS = 200;

// Each sanitiser returns a cleaned value, or null when the input is not acceptable.
const sanitizeCollection = (value) => {
  if (!isPlainObject(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > MAX_COLLECTION_KEYS) return null;
  const clean = {};
  for (const [id, count] of entries) {
    if (!CARD_ID_PATTERN.test(id) || !Number.isInteger(count) || count < 0 || count > 999) return null;
    if (count > 0) clean[id] = count;
  }
  return clean;
};

const sanitizeWishlist = (value) => {
  if (!isPlainObject(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > MAX_COLLECTION_KEYS) return null;
  const clean = {};
  for (const [id, flag] of entries) {
    if (!CARD_ID_PATTERN.test(id)) return null;
    if (flag) clean[id] = true;
  }
  return clean;
};

const CARD_SET_PATTERN = /^[A-Za-z0-9-]{1,20}$/;
const CARD_NUMBER_PATTERN = /^[A-Za-z0-9-]{1,10}$/;

// Decks are stored as compact references ({ set, number }); the client looks up
// the full card data when it renders them. The server rebuilds each deck from
// validated fields only, so nothing unexpected is ever persisted.
const sanitizeDecks = (value) => {
  if (!Array.isArray(value) || value.length > MAX_DECKS) return null;
  const clean = [];
  for (const deck of value) {
    if (!isPlainObject(deck)) return null;
    if (!(typeof deck.id === 'string' || typeof deck.id === 'number') || String(deck.id).length > 40) return null;
    const name = typeof deck.name === 'string' ? deck.name.trim().slice(0, 120) : '';
    if (!Array.isArray(deck.cards) || deck.cards.length > MAX_DECK_CARDS) return null;

    const cards = [];
    for (const card of deck.cards) {
      if (!isPlainObject(card) || typeof card.set !== 'string' || !CARD_SET_PATTERN.test(card.set)) return null;
      const number = String(card.number ?? '');
      if (!CARD_NUMBER_PATTERN.test(number)) return null;
      cards.push({ set: card.set, number: typeof card.number === 'number' ? card.number : number });
    }
    clean.push({
      id: String(deck.id),
      name,
      type: typeof deck.type === 'string' ? deck.type.slice(0, 20) : 'Custom',
      cards
    });
  }
  return clean;
};

const sanitizeCardList = (value) => {
  if (!Array.isArray(value) || value.length > MAX_TRADE_CARDS) return null;
  if (!value.every(id => typeof id === 'string' && CARD_ID_PATTERN.test(id))) return null;
  return [...new Set(value)];
};

// A non-numeric or oversized :userId would otherwise hit an integer-column
// comparison deep in a query and bubble up as an opaque 500.
const validateUserIdParam = (req, res, next) => {
  if (!/^\d{1,9}$/.test(req.params.userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  next();
};

// Two users may message each other if they've already exchanged a message, or
// if their trade listings are a mutual match (each offers what the other
// requests) - without this, any logged-in user could message any other user id.
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
  const arr = (v) => (Array.isArray(v) ? v : []);
  const bGivesAWants = arr(b_offer).some(c => arr(a_request).includes(c));
  const aGivesBWants = arr(a_offer).some(c => arr(b_request).includes(c));
  return bGivesAWants && aGivesBWants;
};

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------
// Profile avatars are a Pokédex number plus a background tint. The palette and
// id range mirror src/data/avatars.js on the client.
const AVATAR_BACKGROUNDS = ['#FFD9D9', '#FFE8CC', '#FFF3BF', '#DDF3D6', '#D3F0F5', '#D9E4FF', '#E6DCFF', '#FFD9EC'];
const MAX_POKEMON_ID = 1025;
const STARTER_POOL_MAX = 386; // new accounts start with a recognisable Gen 1-3 Pokémon

const randomDefaultAvatar = () => ({
  pokemon: 1 + crypto.randomInt(STARTER_POOL_MAX),
  bg: AVATAR_BACKGROUNDS[crypto.randomInt(AVATAR_BACKGROUNDS.length)]
});

const isValidAvatar = (avatar) =>
  !!avatar &&
  Number.isInteger(avatar.pokemon) && avatar.pokemon >= 1 && avatar.pokemon <= MAX_POKEMON_ID &&
  typeof avatar.bg === 'string' && /^#[0-9a-fA-F]{6}$/.test(avatar.bg);

// Every account gets an avatar automatically. Existing accounts created before
// avatars existed are backfilled the first time they log in or load a profile.
// COALESCE keeps whichever avatar was written first if two requests race.
const ensureAvatar = async (userId, db = pool) => {
  const result = await db.query(
    `INSERT INTO user_data (user_id, avatar) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET avatar = COALESCE(user_data.avatar, EXCLUDED.avatar)
     RETURNING avatar`,
    [userId, JSON.stringify(randomDefaultAvatar())]
  );
  return result.rows[0].avatar;
};

// ---------------------------------------------------------------------------
// Schema / maintenance (idempotent). Gated by a shared secret since it runs
// before any user account exists, so it can't require a login token.
// ---------------------------------------------------------------------------
const initHandler = async (req, res) => {
  const providedSecret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SECRET || typeof providedSecret !== 'string' || !safeEqual(providedSecret, process.env.ADMIN_SECRET)) {
    return res.sendStatus(403);
  }

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
  await pool.query(`ALTER TABLE user_data ADD COLUMN IF NOT EXISTS in_game_id VARCHAR(255);`);
  await pool.query(`ALTER TABLE user_data ADD COLUMN IF NOT EXISTS successful_trades INTEGER DEFAULT 0;`);
  await pool.query(`ALTER TABLE user_data ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
  await pool.query(`ALTER TABLE user_data ADD COLUMN IF NOT EXISTS avatar JSONB;`);
  await pool.query(`ALTER TABLE user_data ADD COLUMN IF NOT EXISTS luck_last JSONB;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254);`);

  // Usernames are unique regardless of capitalisation (prevents look-alike / admin-spoof accounts).
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique ON users (lower(username));`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS trades (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      offering_cards JSONB DEFAULT '[]'::jsonb,
      requesting_cards JSONB DEFAULT '[]'::jsonb,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // One listing per user: drop older duplicates, then enforce it.
  await pool.query(`DELETE FROM trades t USING trades newer WHERE t.user_id = newer.user_id AND t.updated_at < newer.updated_at;`);
  await pool.query(`DELETE FROM trades t USING trades other WHERE t.user_id = other.user_id AND t.id < other.id AND t.updated_at = other.updated_at;`);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_user_id_unique') THEN
        ALTER TABLE trades ADD CONSTRAINT trades_user_id_unique UNIQUE (user_id);
      END IF;
    END $$;
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
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS messages_pair_idx ON messages (sender_id, receiver_id, created_at);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS endorsements (
      id SERIAL PRIMARY KEY,
      endorser_id INTEGER REFERENCES users(id),
      endorsed_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(endorser_id, endorsed_id)
    );
  `);

  // "Notify me when Pro launches" signups. A row is either a logged-in user
  // (user_id + email) or an anonymous visitor (visitor_id only); the partial
  // unique indexes keep each person to a single row.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pro_waitlist (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      visitor_id VARCHAR(64),
      email VARCHAR(254),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS pro_waitlist_user_unique ON pro_waitlist (user_id) WHERE user_id IS NOT NULL;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS pro_waitlist_visitor_unique ON pro_waitlist (visitor_id) WHERE visitor_id IS NOT NULL;`);

  // First-party, cookie-less usage analytics for the admin dashboard: one row per
  // app open ("session") or section visit ("view"). Only a random browser id is
  // stored - no IP address, user agent or other fingerprinting data.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_events (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      visitor_id VARCHAR(64) NOT NULL,
      user_id INTEGER,
      kind VARCHAR(16) NOT NULL,
      view VARCHAR(24)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS site_events_created_idx ON site_events (created_at);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS site_events_visitor_idx ON site_events (visitor_id, created_at);`);

  // Login / registration throttling that survives serverless cold starts.
  await pool.query(`CREATE TABLE IF NOT EXISTS auth_attempts (key VARCHAR(160) NOT NULL, at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS auth_attempts_key_idx ON auth_attempts (key, at);`);

  // Repair rows written before input validation existed, then lock the shapes in.
  await pool.query(`UPDATE user_data SET collection = '{}'::jsonb WHERE collection IS NOT NULL AND jsonb_typeof(collection) <> 'object';`);
  await pool.query(`UPDATE user_data SET wishlist = '{}'::jsonb WHERE wishlist IS NOT NULL AND jsonb_typeof(wishlist) <> 'object';`);
  await pool.query(`UPDATE user_data SET custom_decks = '[]'::jsonb WHERE custom_decks IS NOT NULL AND jsonb_typeof(custom_decks) <> 'array';`);
  await pool.query(`UPDATE trades SET offering_cards = '[]'::jsonb WHERE offering_cards IS NOT NULL AND jsonb_typeof(offering_cards) <> 'array';`);
  await pool.query(`UPDATE trades SET requesting_cards = '[]'::jsonb WHERE requesting_cards IS NOT NULL AND jsonb_typeof(requesting_cards) <> 'array';`);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_data_json_shapes') THEN
        ALTER TABLE user_data ADD CONSTRAINT user_data_json_shapes CHECK (
          jsonb_typeof(collection) = 'object' AND jsonb_typeof(wishlist) = 'object' AND jsonb_typeof(custom_decks) = 'array');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_json_shapes') THEN
        ALTER TABLE trades ADD CONSTRAINT trades_json_shapes CHECK (
          jsonb_typeof(offering_cards) = 'array' AND jsonb_typeof(requesting_cards) = 'array');
      END IF;
    END $$;
  `);

  // Retention
  await pool.query(`DELETE FROM site_events WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '400 days';`);
  await pool.query(`DELETE FROM auth_attempts WHERE at < CURRENT_TIMESTAMP - INTERVAL '2 days';`);

  res.json({ message: 'Database initialized successfully' });
};
app.get('/api/init', initHandler);
app.post('/api/init', initHandler);

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
const GENERIC_LOGIN_ERROR = 'Invalid username or password';
let dummyHashPromise = null;
const dummyHash = () => (dummyHashPromise ||= bcrypt.hash(crypto.randomBytes(16).toString('hex'), 11));

app.post('/api/register', rateLimitAuth, async (req, res) => {
  const { username, password } = req.body || {};
  const name = typeof username === 'string' ? username.trim() : '';

  if (!USERNAME_PATTERN.test(name)) {
    return res.status(400).json({ error: 'Usernames are 3-24 characters: letters, numbers, dots, dashes and underscores' });
  }
  if (!isPassword(password)) {
    return res.status(400).json({ error: 'Passwords must be at least 8 characters' });
  }
  const lower = name.toLowerCase();
  if (RESERVED_USERNAMES.has(lower) || adminNames().includes(lower)) {
    return res.status(409).json({ error: 'That username is taken' });
  }

  // At most 10 new accounts per network address per hour.
  const ipKey = `reg:${clientIp(req)}`;
  if ((await attemptsInWindow(ipKey, 60)) >= 10) {
    return res.status(429).json({ error: 'Too many new accounts from this network, please try again later' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 11);
    const user = await withTransaction(async (db) => {
      const created = await db.query('INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username', [name, hashedPassword]);
      const row = created.rows[0];
      const avatar = await ensureAvatar(row.id, db);
      return { ...row, avatar };
    });
    await recordAttempt(ipKey);
    res.json({ token: signToken(user), username: user.username, avatar: user.avatar });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That username is taken' });
    throw error;
  }
});

app.post('/api/login', rateLimitAuth, async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || username.length > 64 || password.length > 256) {
    return res.status(400).json({ error: 'Please enter your username and password' });
  }
  const lower = username.trim().toLowerCase();
  const userKey = `login:u:${lower}`;
  const ipKey = `login:ip:${clientIp(req)}`;

  // One parallel round trip: the two lockout counters and the account lookup.
  const [userFailures, ipFailures, found] = await Promise.all([
    attemptsInWindow(userKey, 15),
    attemptsInWindow(ipKey, 15),
    pool.query(
      `SELECT u.id, u.username, u.password, ud.avatar
       FROM users u LEFT JOIN user_data ud ON ud.user_id = u.id
       WHERE lower(u.username) = $1`,
      [lower]
    )
  ]);

  // Lock an account (and a network address) out after repeated failures.
  if (userFailures >= 8 || ipFailures >= 40) {
    res.set('Retry-After', '900');
    return res.status(429).json({ error: 'Too many failed attempts. Please wait a few minutes and try again.' });
  }

  const user = found.rows[0];

  // Always run a bcrypt comparison so response time doesn't reveal which usernames exist.
  const valid = await bcrypt.compare(password, user ? user.password : await dummyHash());
  if (!user || !valid) {
    await Promise.all([recordAttempt(userKey), recordAttempt(ipKey)]);
    return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
  }

  if (userFailures > 0) await clearAttempts(userKey); // nothing to clear for a clean login
  const avatar = user.avatar || await ensureAvatar(user.id); // only backfills accounts that predate avatars
  res.json({ token: signToken(user), username: user.username, avatar });
});

// ---------------------------------------------------------------------------
// Data sync (collection / wishlist / decks)
// ---------------------------------------------------------------------------
app.get('/api/sync', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT collection, wishlist, custom_decks, updated_at FROM user_data WHERE user_id = $1', [req.user.id]);
  const row = result.rows[0];
  res.json({
    collection: isPlainObject(row?.collection) ? row.collection : {},
    wishlist: isPlainObject(row?.wishlist) ? row.wishlist : {},
    customDecks: Array.isArray(row?.custom_decks) ? row.custom_decks : [],
    updatedAt: row?.updated_at ?? null
  });
});

app.post('/api/sync', authenticateToken, rateLimitWrite, async (req, res) => {
  const { collection, wishlist, customDecks, inGameId } = req.body || {};
  const sets = [];
  const values = [req.user.id];
  const add = (column, value) => { values.push(value); sets.push(`${column} = $${values.length}`); };
  const bad = (what) => res.status(400).json({ error: `Invalid ${what}` });

  if (collection !== undefined) {
    const clean = sanitizeCollection(collection);
    if (!clean) return bad('collection');
    add('collection', JSON.stringify(clean));
  }
  if (wishlist !== undefined) {
    const clean = sanitizeWishlist(wishlist);
    if (!clean) return bad('wishlist');
    add('wishlist', JSON.stringify(clean));
  }
  if (customDecks !== undefined) {
    const clean = sanitizeDecks(customDecks);
    if (!clean) return bad('decks');
    add('custom_decks', JSON.stringify(clean));
  }
  if (inGameId !== undefined) {
    if (inGameId !== null && (typeof inGameId !== 'string' || inGameId.length > 64)) return bad('in-game ID');
    add('in_game_id', inGameId ? inGameId.trim() : null);
  }

  await pool.query('INSERT INTO user_data (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [req.user.id]);
  if (sets.length > 0) {
    await pool.query(`UPDATE user_data SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`, values);
  }
  res.json({ success: true });
});

app.get('/api/user', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT in_game_id, successful_trades FROM user_data WHERE user_id = $1', [req.user.id]);
  const row = result.rows[0];
  res.json({ inGameId: row?.in_game_id ?? null, successfulTrades: row?.successful_trades || 0 });
});

// ---------------------------------------------------------------------------
// Trading
// ---------------------------------------------------------------------------
app.get('/api/trade', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT offering_cards, requesting_cards FROM trades WHERE user_id = $1', [req.user.id]);
  const row = result.rows[0];
  res.json({
    offering_cards: Array.isArray(row?.offering_cards) ? row.offering_cards : [],
    requesting_cards: Array.isArray(row?.requesting_cards) ? row.requesting_cards : []
  });
});

app.post('/api/trade', authenticateToken, rateLimitWrite, async (req, res) => {
  const offering = sanitizeCardList(req.body?.offering_cards);
  const requesting = sanitizeCardList(req.body?.requesting_cards);
  if (!offering || !requesting) return res.status(400).json({ error: 'Invalid card list' });

  // Atomic upsert (relies on the unique constraint on trades.user_id from
  // /api/init) so a double-submit can't leave a user with two listing rows.
  await pool.query(
    `INSERT INTO trades (user_id, offering_cards, requesting_cards)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE
     SET offering_cards = $2, requesting_cards = $3, updated_at = CURRENT_TIMESTAMP`,
    [req.user.id, JSON.stringify(offering), JSON.stringify(requesting)]
  );
  res.json({ success: true });
});

app.get('/api/trade/matches', authenticateToken, async (req, res) => {
  const myTrade = await pool.query('SELECT offering_cards, requesting_cards FROM trades WHERE user_id = $1', [req.user.id]);
  const myOffering = Array.isArray(myTrade.rows[0]?.offering_cards) ? myTrade.rows[0].offering_cards : [];
  const myRequesting = Array.isArray(myTrade.rows[0]?.requesting_cards) ? myTrade.rows[0].requesting_cards : [];
  if (myOffering.length === 0 || myRequesting.length === 0) return res.json([]); // need both to match

  // Others who offer something I request AND request something I offer. The
  // jsonb_typeof guards keep one malformed row from failing the whole query.
  const matches = await pool.query(
    `SELECT t.user_id AS match_user_id, u.username AS match_username, ud.in_game_id, ud.successful_trades,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ud.last_active)) AS seconds_since_active,
            t.offering_cards AS match_offering, t.requesting_cards AS match_requesting,
            (SELECT COUNT(*) FROM messages m WHERE m.sender_id = t.user_id AND m.receiver_id = $1 AND m.is_read = FALSE) AS unread_messages
     FROM trades t
     JOIN users u ON t.user_id = u.id
     LEFT JOIN user_data ud ON t.user_id = ud.user_id
     WHERE t.user_id != $1
       AND jsonb_typeof(t.offering_cards) = 'array' AND jsonb_typeof(t.requesting_cards) = 'array'
       AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(t.offering_cards) AS o WHERE o = ANY($2::text[]))
       AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(t.requesting_cards) AS r WHERE r = ANY($3::text[]))
     ORDER BY ud.last_active DESC NULLS LAST
     LIMIT 100`,
    [req.user.id, myRequesting, myOffering]
  );

  res.json(matches.rows.map(m => ({
    userId: m.match_user_id,
    username: m.match_username,
    inGameId: m.in_game_id,
    successfulTrades: m.successful_trades || 0,
    lastActive: m.seconds_since_active !== null ? parseInt(m.seconds_since_active, 10) : null,
    unreadMessages: parseInt(m.unread_messages, 10) || 0,
    theyGiveIWant: m.match_offering.filter(c => myRequesting.includes(c)),
    iGiveTheyWant: myOffering.filter(c => m.match_requesting.includes(c))
  })));
});

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
const MAX_MESSAGE_LENGTH = 1000;
const MAX_MESSAGES_RETURNED = 300;

app.get('/api/chat/:userId', authenticateToken, validateUserIdParam, async (req, res) => {
  const otherUserId = parseInt(req.params.userId, 10);
  if (!(await hasRelationship(req.user.id, otherUserId))) return res.status(403).json({ error: 'You can only chat with traders you have matched with' });

  await pool.query(
    'UPDATE messages SET is_read = TRUE WHERE receiver_id = $1 AND sender_id = $2 AND is_read = FALSE',
    [req.user.id, otherUserId]
  );

  const result = await pool.query(
    `SELECT * FROM (
       SELECT m.id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at, u.username AS sender_username
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ${MAX_MESSAGES_RETURNED}
     ) recent
     ORDER BY created_at ASC, id ASC`,
    [req.user.id, otherUserId]
  );
  res.json(result.rows);
});

app.post('/api/chat/:userId', authenticateToken, rateLimitChat, validateUserIdParam, async (req, res) => {
  const receiverId = parseInt(req.params.userId, 10);
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';

  if (!content) return res.status(400).json({ error: 'Message content cannot be empty' });
  if (content.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ error: `Messages can be up to ${MAX_MESSAGE_LENGTH} characters` });
  if (receiverId === req.user.id) return res.status(400).json({ error: 'You cannot message yourself' });
  if (!(await hasRelationship(req.user.id, receiverId))) return res.status(403).json({ error: 'You can only chat with traders you have matched with' });

  const result = await pool.query(
    `INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3)
     RETURNING id, sender_id, receiver_id, content, is_read, created_at`,
    [req.user.id, receiverId, content]
  );
  res.json(result.rows[0]);
});

app.get('/api/trade/notifications', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT COUNT(DISTINCT sender_id) AS unread FROM messages WHERE receiver_id = $1 AND is_read = FALSE', [req.user.id]);
  res.json({ unreadCount: parseInt(result.rows[0].unread, 10) });
});

// Endorsing says "we completed a trade", so it needs a real conversation (a
// message each way) and an account that has existed for a day - a matching
// listing alone isn't enough, which stops two throwaway accounts from
// endorsing each other.
app.post('/api/trade/endorse/:userId', authenticateToken, rateLimitWrite, validateUserIdParam, async (req, res) => {
  const endorsedId = parseInt(req.params.userId, 10);
  if (endorsedId === req.user.id) return res.status(400).json({ error: 'Cannot endorse yourself' });

  const conversation = await pool.query(
    `SELECT
       EXISTS (SELECT 1 FROM messages WHERE sender_id = $1 AND receiver_id = $2) AS sent,
       EXISTS (SELECT 1 FROM messages WHERE sender_id = $2 AND receiver_id = $1) AS received,
       (SELECT created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' FROM users WHERE id = $1) AS old_enough,
       EXISTS (SELECT 1 FROM users WHERE id = $2) AS target_exists`,
    [req.user.id, endorsedId]
  );
  const c = conversation.rows[0];
  if (!c.target_exists) return res.status(404).json({ error: 'Trader not found' });
  if (!c.sent || !c.received) return res.status(403).json({ error: "You can endorse a trader once you've both exchanged messages" });
  if (!c.old_enough) return res.status(403).json({ error: 'Accounts need to be at least a day old to endorse traders' });

  const added = await withTransaction(async (db) => {
    const inserted = await db.query(
      'INSERT INTO endorsements (endorser_id, endorsed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
      [req.user.id, endorsedId]
    );
    if (inserted.rowCount === 0) return false;
    await db.query(
      `INSERT INTO user_data (user_id, successful_trades) VALUES ($1, 1)
       ON CONFLICT (user_id) DO UPDATE SET successful_trades = COALESCE(user_data.successful_trades, 0) + 1`,
      [endorsedId]
    );
    return true;
  });

  if (!added) return res.status(400).json({ error: 'Already endorsed this user' });
  res.json({ success: true, message: 'Endorsement added' });
});

// ---------------------------------------------------------------------------
// Pro waitlist ("notify me when Pro launches")
// ---------------------------------------------------------------------------
const getWaitlistStats = async () => {
  const result = await pool.query(`
    SELECT COUNT(*) AS total,
           COUNT(user_id) AS registered,
           COUNT(*) FILTER (WHERE user_id IS NULL) AS anonymous,
           COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days') AS last_7_days
    FROM pro_waitlist
  `);
  const row = result.rows[0];
  return {
    total: parseInt(row.total, 10),
    registered: parseInt(row.registered, 10),
    anonymous: parseInt(row.anonymous, 10),
    last7Days: parseInt(row.last_7_days, 10)
  };
};

// Logged-in users must supply an email (accounts don't store one); anonymous
// visitors are recorded by their browser-generated visitor id only.
app.post('/api/pro/waitlist', rateLimitWaitlist, optionalAuth, async (req, res) => {
  try {
    const { visitorId, email } = req.body || {};
    const hasVisitorId = typeof visitorId === 'string' && VISITOR_ID_PATTERN.test(visitorId);

    if (req.user) {
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!cleanEmail || cleanEmail.length > 254 || !EMAIL_PATTERN.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
      }

      const outcome = await withTransaction(async (db) => {
        const existing = await db.query('SELECT id FROM pro_waitlist WHERE user_id = $1', [req.user.id]);
        if (existing.rows.length > 0) {
          await db.query('UPDATE pro_waitlist SET email = $1 WHERE user_id = $2', [cleanEmail, req.user.id]);
          // This browser may also have joined anonymously earlier - don't count the same person twice.
          if (hasVisitorId) await db.query('DELETE FROM pro_waitlist WHERE visitor_id = $1 AND user_id IS NULL', [visitorId]);
          return { alreadyJoined: true };
        }

        // If this browser already joined anonymously, attach the account + email
        // to that row instead of counting the same person twice.
        if (hasVisitorId) {
          const upgraded = await db.query(
            'UPDATE pro_waitlist SET user_id = $1, email = $2 WHERE visitor_id = $3 AND user_id IS NULL RETURNING id',
            [req.user.id, cleanEmail, visitorId]
          );
          if (upgraded.rows.length > 0) return { alreadyJoined: false };
        }

        // The visitor id may already belong to a different account on a shared browser.
        let visitorIdForInsert = hasVisitorId ? visitorId : null;
        if (visitorIdForInsert) {
          const taken = await db.query('SELECT 1 FROM pro_waitlist WHERE visitor_id = $1', [visitorIdForInsert]);
          if (taken.rows.length > 0) visitorIdForInsert = null;
        }
        await db.query('INSERT INTO pro_waitlist (user_id, visitor_id, email) VALUES ($1, $2, $3)', [req.user.id, visitorIdForInsert, cleanEmail]);
        return { alreadyJoined: false };
      });
      return res.json({ success: true, ...outcome });
    }

    if (!hasVisitorId) return res.status(400).json({ error: 'Invalid visitor id' });

    const inserted = await pool.query(
      'INSERT INTO pro_waitlist (visitor_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id',
      [visitorId]
    );
    return res.json({ success: true, alreadyJoined: inserted.rowCount === 0 });
  } catch (error) {
    // A concurrent double-submit can trip the unique indexes - that just means "already joined".
    if (error.code === '23505') return res.json({ success: true, alreadyJoined: true });
    throw error;
  }
});

// Tells the client whether this user/browser already joined, and - for admins
// only - includes the waitlist counters. Admin status is decided here from the
// verified token; the client never claims it.
app.get('/api/pro/waitlist/status', rateLimitWaitlist, optionalAuth, async (req, res) => {
  const visitorId = typeof req.query.visitorId === 'string' && VISITOR_ID_PATTERN.test(req.query.visitorId)
    ? req.query.visitorId
    : null;

  let joined = false;
  let email = null;

  if (req.user) {
    const result = await pool.query('SELECT email FROM pro_waitlist WHERE user_id = $1', [req.user.id]);
    if (result.rows.length > 0) {
      joined = true;
      email = result.rows[0].email;
    }
  } else if (visitorId) {
    const result = await pool.query('SELECT 1 FROM pro_waitlist WHERE visitor_id = $1', [visitorId]);
    joined = result.rows.length > 0;
  }

  const isAdmin = isAdminUser(req.user);
  const stats = isAdmin ? await getWaitlistStats() : undefined;
  res.json({ joined, email, isAdmin, stats });
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
app.get('/api/profile', rateLimitProfile, authenticateToken, async (req, res) => {
  const result = await pool.query(
    `SELECT u.username, u.email, u.created_at,
            ud.in_game_id, ud.successful_trades, ud.last_active, ud.avatar, ud.luck_last,
            (SELECT CASE WHEN jsonb_typeof(t.offering_cards) = 'array' THEN jsonb_array_length(t.offering_cards) ELSE 0 END
               FROM trades t WHERE t.user_id = u.id LIMIT 1) AS offering_count,
            (SELECT CASE WHEN jsonb_typeof(t.requesting_cards) = 'array' THEN jsonb_array_length(t.requesting_cards) ELSE 0 END
               FROM trades t WHERE t.user_id = u.id LIMIT 1) AS requesting_count
     FROM users u
     LEFT JOIN user_data ud ON ud.user_id = u.id
     WHERE u.id = $1`,
    [req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
  const row = result.rows[0];

  const avatar = row.avatar || await ensureAvatar(req.user.id);

  res.json({
    username: row.username,
    email: row.email,
    inGameId: row.in_game_id,
    avatar,
    createdAt: row.created_at,
    lastActive: row.last_active,
    successfulTrades: row.successful_trades || 0,
    luckLast: row.luck_last,
    isAdmin: isAdminUser(req.user),
    tradeCounts: {
      offering: row.offering_count || 0,
      requesting: row.requesting_count || 0
    }
  });
});

// Partial update: send only the fields being changed.
app.put('/api/profile', rateLimitProfile, authenticateToken, async (req, res) => {
  const { email, inGameId, avatar, luckLast } = req.body || {};

  let cleanEmail;
  if (email !== undefined) {
    cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : null;
    if (cleanEmail === null || (cleanEmail !== '' && (cleanEmail.length > 254 || !EMAIL_PATTERN.test(cleanEmail)))) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
  }

  let cleanInGameId;
  if (inGameId !== undefined) {
    cleanInGameId = typeof inGameId === 'string' ? inGameId.trim() : null;
    if (cleanInGameId === null || cleanInGameId.length > 64) {
      return res.status(400).json({ error: 'In-game ID is too long' });
    }
  }

  if (avatar !== undefined && !isValidAvatar(avatar)) {
    return res.status(400).json({ error: 'Invalid avatar' });
  }

  let cleanLuck;
  if (luckLast !== undefined) {
    const { score, percentile, packs } = luckLast || {};
    const valid = typeof score === 'number' && score >= 1 && score <= 10 &&
      typeof percentile === 'number' && percentile >= 0 && percentile <= 100 &&
      Number.isInteger(packs) && packs >= 0 && packs <= 10000000;
    if (!valid) return res.status(400).json({ error: 'Invalid luck stat' });
    cleanLuck = { score, percentile, packs, at: new Date().toISOString() };
  }

  await withTransaction(async (db) => {
    if (cleanEmail !== undefined) {
      await db.query('UPDATE users SET email = $1 WHERE id = $2', [cleanEmail || null, req.user.id]);
    }

    const setParts = [];
    const values = [req.user.id];
    if (cleanInGameId !== undefined) { values.push(cleanInGameId || null); setParts.push(`in_game_id = $${values.length}`); }
    if (avatar !== undefined) { values.push(JSON.stringify({ pokemon: avatar.pokemon, bg: avatar.bg })); setParts.push(`avatar = $${values.length}`); }
    if (cleanLuck !== undefined) { values.push(JSON.stringify(cleanLuck)); setParts.push(`luck_last = $${values.length}`); }

    if (setParts.length > 0) {
      await db.query('INSERT INTO user_data (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [req.user.id]);
      await db.query(`UPDATE user_data SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`, values);
    }
  });

  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Usage analytics (feeds the admin dashboard)
// ---------------------------------------------------------------------------
const TRACKABLE_VIEWS = new Set(['home', 'calc', 'dex', 'meta', 'decks', 'collection', 'trading', 'profile']);
const BOT_USER_AGENT = /bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|monitor|curl|wget|python-requests/i;

// Fire-and-forget from the client. The admin's own activity and obvious bots
// are skipped so the numbers describe real users.
app.post('/api/track', rateLimitTrack, optionalAuth, async (req, res) => {
  try {
    const { visitorId, kind, view } = req.body || {};
    if (typeof visitorId !== 'string' || !VISITOR_ID_PATTERN.test(visitorId)) return res.sendStatus(204);
    if (kind !== 'session' && kind !== 'view') return res.sendStatus(204);
    if (kind === 'view' && !TRACKABLE_VIEWS.has(view)) return res.sendStatus(204);
    if (isAdminUser(req.user)) return res.sendStatus(204);
    if (BOT_USER_AGENT.test(req.headers['user-agent'] || '')) return res.sendStatus(204);

    await pool.query(
      'INSERT INTO site_events (visitor_id, user_id, kind, view) VALUES ($1, $2, $3, $4)',
      [visitorId, req.user?.id ?? null, kind, kind === 'view' ? view : null]
    );
  } catch (error) {
    console.error('track failed:', error.message); // analytics must never surface an error to the app
  }
  res.sendStatus(204);
});

const pctChange = (current, previous) => {
  if (!previous) return current > 0 ? null : 0; // null = "new" (no previous period to compare)
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

app.get('/api/admin/stats', rateLimitProfile, authenticateToken, async (req, res) => {
  if (!isAdminUser(req.user)) return res.status(403).json({ error: 'Not authorised' });

  const days = [7, 30, 90].includes(parseInt(req.query.days, 10)) ? parseInt(req.query.days, 10) : 30;
  const num = (v) => parseInt(v, 10) || 0;

  // The window is the last `days` UTC days up to now (today is partial). The
  // comparison window is the span of equal length immediately before it, so
  // the percentage changes compare like with like.
  const START = `((CURRENT_DATE - ($1::int - 1))::timestamp)`;
  const PREV_START = `(${START} - (CURRENT_TIMESTAMP::timestamp - ${START}))`;

  await pool.query(`DELETE FROM site_events WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '400 days'`);

  const [
    visitorSeries, userSeries, waitlistSeries,
    totals, prevTotals, returning, sections,
    overview, engagement, recentUsers, waitlistStats, recentWaitlist, firstEvent
  ] = await Promise.all([
    pool.query(`
      SELECT d::date AS day, COALESCE(v.visitors, 0) AS visitors, COALESCE(v.sessions, 0) AS sessions
      FROM generate_series(${START}, CURRENT_DATE::timestamp, interval '1 day') d
      LEFT JOIN (
        SELECT created_at::date AS day, COUNT(DISTINCT visitor_id) AS visitors,
               COUNT(*) FILTER (WHERE kind = 'session') AS sessions
        FROM site_events WHERE created_at >= ${START} GROUP BY 1
      ) v ON v.day = d::date ORDER BY d`, [days]),
    pool.query(`
      SELECT d::date AS day, COALESCE(u.n, 0) AS n
      FROM generate_series(${START}, CURRENT_DATE::timestamp, interval '1 day') d
      LEFT JOIN (SELECT created_at::date AS day, COUNT(*) AS n FROM users WHERE created_at >= ${START} GROUP BY 1) u
        ON u.day = d::date ORDER BY d`, [days]),
    pool.query(`
      SELECT d::date AS day, COALESCE(w.n, 0) AS n
      FROM generate_series(${START}, CURRENT_DATE::timestamp, interval '1 day') d
      LEFT JOIN (SELECT created_at::date AS day, COUNT(*) AS n FROM pro_waitlist WHERE created_at >= ${START} GROUP BY 1) w
        ON w.day = d::date ORDER BY d`, [days]),
    pool.query(`
      SELECT
        (SELECT COUNT(DISTINCT visitor_id) FROM site_events WHERE created_at >= ${START}) AS visitors,
        (SELECT COUNT(*) FROM site_events WHERE kind = 'session' AND created_at >= ${START}) AS sessions,
        (SELECT COUNT(*) FROM site_events WHERE kind = 'view' AND created_at >= ${START}) AS views,
        (SELECT COUNT(*) FROM users WHERE created_at >= ${START}) AS new_users,
        (SELECT COUNT(*) FROM pro_waitlist WHERE created_at >= ${START}) AS waitlist`, [days]),
    pool.query(`
      SELECT
        (SELECT COUNT(DISTINCT visitor_id) FROM site_events WHERE created_at >= ${PREV_START} AND created_at < ${START}) AS visitors,
        (SELECT COUNT(*) FROM site_events WHERE kind = 'session' AND created_at >= ${PREV_START} AND created_at < ${START}) AS sessions,
        (SELECT COUNT(*) FROM users WHERE created_at >= ${PREV_START} AND created_at < ${START}) AS new_users,
        (SELECT COUNT(*) FROM pro_waitlist WHERE created_at >= ${PREV_START} AND created_at < ${START}) AS waitlist`, [days]),
    pool.query(`
      SELECT COUNT(*) AS n FROM (
        SELECT visitor_id FROM site_events GROUP BY visitor_id
        HAVING MIN(created_at) < ${START} AND MAX(created_at) >= ${START}
      ) r`, [days]),
    pool.query(`
      SELECT view, COUNT(*) AS n FROM site_events
      WHERE kind = 'view' AND created_at >= ${START} GROUP BY view ORDER BY n DESC`, [days]),
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM user_data WHERE last_active > CURRENT_TIMESTAMP - INTERVAL '1 day') AS active_24h,
        (SELECT COUNT(*) FROM user_data WHERE last_active > CURRENT_TIMESTAMP - INTERVAL '7 days') AS active_7d,
        (SELECT COUNT(*) FROM user_data WHERE last_active > CURRENT_TIMESTAMP - INTERVAL '30 days') AS active_30d,
        (SELECT COUNT(DISTINCT visitor_id) FROM site_events) AS total_visitors`),
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE email IS NOT NULL AND email <> '') AS with_email,
        COUNT(*) FILTER (WHERE jsonb_typeof(collection) = 'object' AND collection <> '{}'::jsonb) AS with_collection,
        COUNT(*) FILTER (WHERE in_game_id IS NOT NULL AND in_game_id <> '') AS with_ingame,
        COUNT(*) FILTER (WHERE jsonb_typeof(custom_decks) = 'array' AND jsonb_array_length(custom_decks) > 0) AS with_decks,
        COALESCE(SUM(CASE WHEN jsonb_typeof(custom_decks) = 'array' THEN jsonb_array_length(custom_decks) ELSE 0 END), 0) AS total_decks,
        COUNT(*) FILTER (WHERE luck_last IS NOT NULL) AS with_luck,
        AVG((luck_last->>'score')::float) FILTER (WHERE luck_last IS NOT NULL) AS avg_luck,
        COALESCE(SUM(successful_trades), 0) AS endorsements,
        (SELECT COUNT(*) FROM trades WHERE
           (jsonb_typeof(offering_cards) = 'array' AND jsonb_array_length(offering_cards) > 0) OR
           (jsonb_typeof(requesting_cards) = 'array' AND jsonb_array_length(requesting_cards) > 0)) AS with_listing,
        (SELECT COUNT(*) FROM messages) AS messages
      FROM user_data`),
    pool.query(`
      SELECT u.username, u.created_at, ud.avatar
      FROM users u LEFT JOIN user_data ud ON ud.user_id = u.id
      ORDER BY u.created_at DESC LIMIT 8`),
    getWaitlistStats(),
    pool.query(`
      SELECT w.created_at, u.username, COALESCE(w.email, u.email) AS email
      FROM pro_waitlist w LEFT JOIN users u ON u.id = w.user_id
      ORDER BY w.created_at DESC LIMIT 8`),
    pool.query('SELECT MIN(created_at) AS first FROM site_events')
  ]);

  const t = totals.rows[0], p = prevTotals.rows[0];
  const o = overview.rows[0], e = engagement.rows[0];
  const visitors = num(t.visitors);
  const returningVisitors = Math.min(visitors, num(returning.rows[0].n));
  const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

  res.json({
    days,
    generatedAt: new Date().toISOString(),
    trackingSince: firstEvent.rows[0].first,
    overview: {
      totalUsers: num(o.total_users),
      totalVisitors: num(o.total_visitors),
      active24h: num(o.active_24h),
      active7d: num(o.active_7d),
      active30d: num(o.active_30d)
    },
    period: {
      visitors, sessions: num(t.sessions), pageViews: num(t.views),
      newUsers: num(t.new_users), waitlist: num(t.waitlist),
      returningVisitors, newVisitors: visitors - returningVisitors
    },
    change: {
      visitors: pctChange(visitors, num(p.visitors)),
      sessions: pctChange(num(t.sessions), num(p.sessions)),
      newUsers: pctChange(num(t.new_users), num(p.new_users)),
      waitlist: pctChange(num(t.waitlist), num(p.waitlist))
    },
    series: {
      days: visitorSeries.rows.map(r => isoDay(r.day)),
      visitors: visitorSeries.rows.map(r => num(r.visitors)),
      sessions: visitorSeries.rows.map(r => num(r.sessions)),
      newUsers: userSeries.rows.map(r => num(r.n)),
      waitlist: waitlistSeries.rows.map(r => num(r.n))
    },
    sections: sections.rows.map(r => ({ view: r.view, views: num(r.n) })),
    engagement: {
      withEmail: num(e.with_email),
      withCollection: num(e.with_collection),
      withInGameId: num(e.with_ingame),
      withDecks: num(e.with_decks),
      totalDecks: num(e.total_decks),
      withLuck: num(e.with_luck),
      avgLuck: e.avg_luck === null ? null : Math.round(e.avg_luck * 10) / 10,
      withListing: num(e.with_listing),
      messages: num(e.messages),
      endorsements: num(e.endorsements)
    },
    waitlist: {
      ...waitlistStats,
      recent: recentWaitlist.rows.map(r => ({ username: r.username, email: r.email, createdAt: r.created_at }))
    },
    recentUsers: recentUsers.rows.map(r => ({ username: r.username, createdAt: r.created_at, avatar: r.avatar }))
  });
});

// ---------------------------------------------------------------------------
// Fallbacks
// ---------------------------------------------------------------------------
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Last line of defence: every failure becomes a small JSON error - never an
// HTML page, a stack trace, or an unhandled rejection that kills the process.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large' });
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export const handler = serverless(app);
export const expressApp = app;

// For local development
if (process.env.NODE_ENV !== 'production' && process.env.RUN_LOCAL === 'true') {
  const PORT = process.env.PORT || 3001;
  const server = app.listen(PORT, () => {
    console.log(`Express API running on http://localhost:${PORT}`);
  });
  server.on('error', (error) => {
    // Another copy already owns the port (e.g. `vite build` while `vite dev` runs): not fatal.
    if (error.code !== 'EADDRINUSE') throw error;
  });
  server.unref(); // never keep a build/script process alive just for this listener
}
