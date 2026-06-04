const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon PostgreSQL
  }
});

pool.on('connect', () => {
  console.log('Connected to Neon PostgreSQL Database.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on database client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
