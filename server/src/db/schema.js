import pool from './index.js';

const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        department VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        name VARCHAR(255) NOT NULL,
        portal_url TEXT,
        contact_name VARCHAR(255),
        contact_email VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS manuals (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        version VARCHAR(50) NOT NULL,
        file_path TEXT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'processing',
        total_pages INTEGER,
        uploaded_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS manual_pages (
        id SERIAL PRIMARY KEY,
        manual_id INTEGER REFERENCES manuals(id) ON DELETE CASCADE,
        page_number INTEGER NOT NULL,
        content TEXT,
        embedding_keywords TEXT
      );

      CREATE TABLE IF NOT EXISTS manual_images (
        id SERIAL PRIMARY KEY,
        manual_id INTEGER REFERENCES manuals(id) ON DELETE CASCADE,
        page_number INTEGER NOT NULL,
        image_path TEXT NOT NULL,
        caption TEXT,
        topic_tags TEXT
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        customer_id INTEGER REFERENCES customers(id),
        order_ref VARCHAR(255) NOT NULL,
        file_path TEXT,
        remarks TEXT,
        status VARCHAR(50) DEFAULT 'open',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_styles (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        vendor_style_code VARCHAR(255),
        dye_file_no VARCHAR(255),
        gold_kt VARCHAR(50),
        gold_colour VARCHAR(50),
        product_type VARCHAR(100),
        size VARCHAR(50),
        gross_weight DECIMAL(10,3),
        target_weight DECIMAL(10,3),
        portal_design_url TEXT,
        sample_image_path TEXT,
        remarks TEXT
      );

      CREATE TABLE IF NOT EXISTS checklists (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        department VARCHAR(100) NOT NULL,
        generated_by_ai BOOLEAN DEFAULT true,
        status VARCHAR(50) DEFAULT 'pending',
        assigned_to INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS checklist_items (
        id SERIAL PRIMARY KEY,
        checklist_id INTEGER REFERENCES checklists(id) ON DELETE CASCADE,
        sequence_no INTEGER,
        check_point TEXT NOT NULL,
        specification TEXT NOT NULL,
        verification_method TEXT,
        manual_page_ref INTEGER,
        reference_image_id INTEGER REFERENCES manual_images(id),
        result VARCHAR(20),
        remarks TEXT,
        checked_by INTEGER REFERENCES users(id),
        checked_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ncr_register (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        customer_id INTEGER REFERENCES customers(id),
        order_id INTEGER REFERENCES orders(id),
        ncr_ref VARCHAR(100) NOT NULL,
        rejection_category VARCHAR(255),
        defect_description TEXT,
        root_cause TEXT,
        corrective_action TEXT,
        status VARCHAR(50) DEFAULT 'open',
        raised_by INTEGER REFERENCES users(id),
        closed_by INTEGER REFERENCES users(id),
        raised_at TIMESTAMP DEFAULT NOW(),
        closed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tp_qc_results (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        style_id INTEGER REFERENCES order_styles(id),
        qty_sent INTEGER,
        standard_reference TEXT,
        checked_by_tp VARCHAR(255),
        check_date DATE,
        result VARCHAR(20),
        tp_remarks TEXT,
        corrective_action TEXT,
        recorded_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    // Add new columns if they don't exist
    await client.query(`
      ALTER TABLE manuals ADD COLUMN IF NOT EXISTS ai_summary JSONB;
      ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS reference_image_path TEXT;
    `);

    console.log('All tables created successfully');
  } finally {
    client.release();
  }
};

export default createTables;
