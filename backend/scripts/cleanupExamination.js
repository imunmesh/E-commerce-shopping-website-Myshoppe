const { pool } = require('../src/db');

async function runCleanup() {
  try {
    console.log('🔧 Starting database cleanup and restoration...\n');

    // 1. Drop Examination Tables
    console.log('🗑️ Dropping examination tables if they exist...');
    await pool.query(`
      DROP TABLE IF EXISTS 
        exam_questions, exam_attempts, exam_logs, exam_answers, 
        coding_submissions, certificates, questions, exams, profiles 
      CASCADE;
    `);
    console.log('✅ Dropped examination tables.');

    // 2. Drop current users table (cascade drops any remaining fk constraints)
    console.log('🗑️ Dropping contaminated users table...');
    await pool.query(`DROP TABLE IF EXISTS users CASCADE;`);
    console.log('✅ Dropped users table.');

    // 3. Recreate correct users table
    console.log('🏗️ Recreating users table schema...');
    await pool.query(`
      CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          firebase_uid VARCHAR(128) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          role VARCHAR(50) DEFAULT 'customer',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Recreated users table schema.');

    // 4. Restore original users from backup + placeholders for new users
    console.log('💾 Restoring backed-up users and placeholders for post-backup users...');
    await pool.query(`
      INSERT INTO users (id, firebase_uid, name, email, role, created_at) VALUES
      (1, 'VDbfgQcMOTWKKyCQ6VR7KC6eZ4D2', 'unmeshbhangale61', 'unmeshbhangale61@gmail.com', 'admin', '2026-05-30 04:52:00.276'),
      (4, '6bnjGEqgfubmkenq9S4vD7Ojal33', 'unmesh', 'unmeshbhangale661@gmail.com', 'customer', '2026-05-30 04:55:10.816'),
      (5, 'ZBWAZLGWsud8l4HpybukHj0GXhp1', 'kavitahbhangale661', 'kavitahbhangale661@gmail.com', 'customer', '2026-05-30 05:22:36.072'),
      (6, 'p9vtTv7HCHRVjhskbpmkuqpNvWE3', '2024.unmesh.bhangale', '2024.unmesh.bhangale@ves.ac.in', 'customer', '2026-05-30 05:37:12.384'),
      (15, 'jzeEwtjQl2SmUYAMZsDulal3u0q1', 'unmeshbhangale6671', 'unmeshbhangale6671@gmail.com', 'customer', '2026-05-30 06:51:43.672'),
      (17, 'T15In7L50xY42uDgsDUlequTOKz1', 'unmeshbhangale529', 'unmeshbhangale529@gmail.com', 'customer', '2026-05-30 07:39:57.523'),
      (16, 'zcxRHNvDycVWfXcWMCFao2FJLxB3', 'unmeshbhangale41', 'unmeshbhangale41@gmail.com', 'customer', '2026-05-30 06:53:21.496'),
      (18, 'placeholder-uid-18', 'Roshan das', 'roshandas@placeholder.com', 'customer', '2026-05-31 07:22:36.516'),
      (19, 'placeholder-uid-19', 'Customer 19', 'customer19@placeholder.com', 'customer', '2026-06-08 02:44:37.379');
    `);
    console.log('✅ Restored standard users and placeholders.');

    // 5. Reset user serial sequence
    console.log('🔢 Resetting users auto-increment sequence...');
    await pool.query(`SELECT setval('users_id_seq', COALESCE((SELECT MAX(id)+1 FROM users), 1), false);`);
    console.log('✅ Reset users sequence.');

    // 6. Ensure notifications table exists
    console.log('🔔 Ensuring notifications table exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(100) NOT NULL,
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Verified notifications table.');

    // 7. Restore foreign key constraints
    console.log('🔗 Restoring foreign key constraints...');
    const fks = [
      { table: 'addresses', constraint: 'fk_addresses_user', query: 'ALTER TABLE addresses ADD CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE' },
      { table: 'cart', constraint: 'fk_cart_user', query: 'ALTER TABLE cart ADD CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE' },
      { table: 'wishlist', constraint: 'fk_wishlist_user', query: 'ALTER TABLE wishlist ADD CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE' },
      { table: 'orders', constraint: 'fk_orders_user', query: 'ALTER TABLE orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL' },
      { table: 'payments', constraint: 'fk_payments_user', query: 'ALTER TABLE payments ADD CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL' },
      { table: 'reviews', constraint: 'fk_reviews_user', query: 'ALTER TABLE reviews ADD CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE' },
      { table: 'email_logs', constraint: 'fk_email_logs_user', query: 'ALTER TABLE email_logs ADD CONSTRAINT fk_email_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE' },
      { table: 'recently_viewed', constraint: 'fk_recently_viewed_user', query: 'ALTER TABLE recently_viewed ADD CONSTRAINT fk_recently_viewed_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE' },
      { table: 'comparison_history', constraint: 'fk_comparison_history_user', query: 'ALTER TABLE comparison_history ADD CONSTRAINT fk_comparison_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE' },
      { table: 'returns', constraint: 'fk_returns_user', query: 'ALTER TABLE returns ADD CONSTRAINT fk_returns_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE' },
      { table: 'notification_logs', constraint: 'fk_notification_logs_user', query: 'ALTER TABLE notification_logs ADD CONSTRAINT fk_notification_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE' },
      { table: 'user_preferences', constraint: 'fk_user_preferences_user', query: 'ALTER TABLE user_preferences ADD CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE' },
      { table: 'notifications', constraint: 'fk_notifications_user', query: 'ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE' },
      { table: 'chat_sessions', constraint: 'fk_chat_sessions_user', query: 'ALTER TABLE chat_sessions ADD CONSTRAINT fk_chat_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL' }
    ];

    for (const fk of fks) {
      console.log(`   - Constraint: ${fk.constraint} on ${fk.table}...`);
      await pool.query(`ALTER TABLE "${fk.table}" DROP CONSTRAINT IF EXISTS "${fk.constraint}";`);
      await pool.query(fk.query);
    }
    console.log('✅ Restored all foreign key constraints.');

    console.log('\n🎉 Database restoration completed successfully!');
  } catch (error) {
    console.error('❌ Restoration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runCleanup();
