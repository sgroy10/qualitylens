import 'dotenv/config';
import pool from './index.js';
import createTables from './schema.js';
import bcrypt from 'bcryptjs';

async function seed() {
  await createTables();
  const client = await pool.connect();
  try {
    // Check if already seeded
    const existing = await client.query('SELECT id FROM companies LIMIT 1');
    if (existing.rows.length > 0) {
      console.log('Database already seeded');
      return;
    }

    // Company
    const companyRes = await client.query(
      `INSERT INTO companies (name, address) VALUES ($1, $2) RETURNING id`,
      ['Sky Gold & Diamonds Ltd', 'Navi Mumbai, Maharashtra, India']
    );
    const companyId = companyRes.rows[0].id;

    // Admin user
    const hash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (company_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
      [companyId, 'Admin', 'admin@skygold.com', hash, 'admin']
    );

    // Sample customer
    await client.query(
      `INSERT INTO customers (company_id, name, contact_name, contact_email, notes) VALUES ($1, $2, $3, $4, $5)`,
      [companyId, 'CaratLane', 'QA Team', 'qa@caratlane.com', 'Primary customer - strict QC requirements']
    );

    console.log('Seed data inserted successfully');
    console.log('Admin login: admin@skygold.com / admin123');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
