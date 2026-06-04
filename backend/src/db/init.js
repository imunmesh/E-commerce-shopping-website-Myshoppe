const fs = require('fs');
const path = require('path');
const db = require('./index');

const initDb = async () => {
  try {
    console.log('Reading init.sql schema file...');
    const schemaPath = path.join(__dirname, 'init.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema script on Neon PostgreSQL...');
    await db.query(sql);
    console.log('Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
};

initDb();
