const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function backupFullDatabase() {
  try {
    console.log('🔄 Starting full database backup of all tables...\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `myshopee-full-backup-${timestamp}.sql`);

    // 1. Get all table names in public schema
    const tablesRes = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} tables to backup: ${tables.join(', ')}`);
    
    let backupContent = `-- MyShopee Full Database Backup\n-- Timestamp: ${new Date().toISOString()}\n\n`;

    for (const table of tables) {
      console.log(`📦 Backing up table: ${table}...`);
      
      try {
        // Query columns order
        const colsRes = await pool.query(
          "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
          [table]
        );
        const colNames = colsRes.rows.map(c => c.column_name);

        const result = await pool.query(`SELECT * FROM "${table}"`);
        
        if (result.rows.length > 0) {
          backupContent += `-- Table: ${table}\n`;
          backupContent += `-- Records: ${result.rows.length}\n`;
          
          for (const row of result.rows) {
            const columns = colNames.map(c => `"${c}"`).join(', ');
            const values = colNames.map(c => {
              const v = row[c];
              if (v === null) return 'NULL';
              if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
              if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
              if (v instanceof Date) return `'${v.toISOString()}'`;
              if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
              return v;
            }).join(', ');
            
            backupContent += `INSERT INTO "${table}" (${columns}) VALUES (${values});\n`;
          }
          
          backupContent += '\n';
        } else {
          backupContent += `-- Table: ${table} (0 records)\n\n`;
        }
      } catch (error) {
        console.log(`⚠️  Failed to backup table ${table}: ${error.message}`);
        backupContent += `-- Failed to backup table: ${table}. Error: ${error.message}\n\n`;
      }
    }

    fs.writeFileSync(backupFile, backupContent);
    
    const fileSize = (fs.statSync(backupFile).size / 1024).toFixed(2);
    console.log(`\n✅ Backup completed: ${backupFile}`);
    console.log(`📊 File size: ${fileSize} KB`);

  } catch (error) {
    console.error('❌ Backup error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

backupFullDatabase();
