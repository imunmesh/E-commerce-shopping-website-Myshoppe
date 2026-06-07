const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    console.log('🔧 Running database migration for chatbot features...\n');

    // 1. Create chat_sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id SERIAL PRIMARY KEY,
        session_uuid VARCHAR(128) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(255) DEFAULT 'New Chat',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created chat_sessions table');

    // 2. Create chat_messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
        sender VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created chat_messages table');

    // 3. Create faqs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS faqs (
        id SERIAL PRIMARY KEY,
        question VARCHAR(255) UNIQUE NOT NULL,
        answer TEXT NOT NULL,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created faqs table');

    // 4. Seed initial FAQs
    const faqSeeds = [
      {
        question: 'What is your return policy?',
        answer: 'You can return any product within 30 days of delivery for a full refund or exchange. The product must be unused, in its original packaging, and with all tags intact. Returns can be initiated from your Profile settings under the order history.',
        category: 'returns'
      },
      {
        question: 'What is your refund policy?',
        answer: 'Once we receive your returned item, we will inspect it and notify you of the status. If approved, your refund will be processed, and a credit will automatically be applied to your original method of payment (Stripe/Card) within 5-7 business days.',
        category: 'refunds'
      },
      {
        question: 'What are your shipping policies and options?',
        answer: 'We offer free standard shipping on all orders! Standard delivery takes 3-5 business days depending on your serviceable pincode location. Orders are confirmed and dispatched within 24 hours of payment authorization.',
        category: 'shipping'
      },
      {
        question: 'What payment methods do you support?',
        answer: 'We support secure online payments handled via Stripe, which accepts all major credit/debit cards (Visa, MasterCard, American Express, Discover) and digital options like Apple Pay and Google Pay.',
        category: 'payments'
      },
      {
        question: 'How can I contact customer support?',
        answer: 'You can contact MyShopee customer support via email at support@myshopee.com or call our toll-free hotline at 1-800-SHOPEE-99. Our customer service agents are available 24/7 to assist you.',
        category: 'contact'
      }
    ];

    for (const faq of faqSeeds) {
      await pool.query(
        `INSERT INTO faqs (question, answer, category) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (question) DO UPDATE SET answer = EXCLUDED.answer, category = EXCLUDED.category`,
        [faq.question, faq.answer, faq.category]
      );
    }
    console.log('✅ Seeded store FAQs');

    console.log('\n🎉 Chatbot DB migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
