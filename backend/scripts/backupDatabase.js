const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function backupDatabase() {
  try {
    console.log('🔄 Starting database backup...\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `myshopee-backup-${timestamp}.sql`);

    // Get all table data
    const tables = ['users', 'products', 'product_images', 'product_variants', 'orders', 'order_items', 'reviews', 'cart_items', 'wishlist_items'];
    
    let backupContent = `-- MyShopee Database Backup\n-- Timestamp: ${new Date().toISOString()}\n\n`;

    for (const table of tables) {
      console.log(`📦 Backing up ${table}...`);
      
      try {
        const result = await pool.query(`SELECT * FROM ${table}`);
        const columns = Object.keys(result.rows[0] || {}).join(', ');
        
        if (result.rows.length > 0) {
          backupContent += `-- Table: ${table}\n`;
          backupContent += `-- Records: ${result.rows.length}\n`;
          
          for (const row of result.rows) {
            const values = Object.values(row).map(v => {
              if (v === null) return 'NULL';
              if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
              if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
              if (v instanceof Date) return `'${v.toISOString()}'`;
              return v;
            }).join(', ');
            
            backupContent += `INSERT INTO ${table} (${columns}) VALUES (${values});\n`;
          }
          
          backupContent += '\n';
        }
      } catch (error) {
        console.log(`⚠️  Skipped ${table}: ${error.message}`);
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

backupDatabase();
