import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pool.query(`ALTER TABLE user_data ADD COLUMN IF NOT EXISTS custom_decks JSONB DEFAULT '[]'::jsonb`);
    console.log("Column added successfully");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
