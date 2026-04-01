import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import pool from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { parseJSON } from '../services/ai.service.js';

const router = Router();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = path.join(process.env.STORAGE_PATH || './storage', 'orders');
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

router.get('/', authenticate, async (req, res) => {
  try {
    const { customer_id, status } = req.query;
    let query = `SELECT o.*, c.name as customer_name,
      (SELECT COUNT(*) FROM order_styles WHERE order_id = o.id) as style_count
      FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.company_id = $1`;
    const params = [req.user.company_id];
    let idx = 2;
    if (customer_id) { query += ` AND o.customer_id = $${idx++}`; params.push(customer_id); }
    if (status) { query += ` AND o.status = $${idx++}`; params.push(status); }
    query += ' ORDER BY o.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { customer_id, order_ref, remarks } = req.body;
    const filePath = req.file ? req.file.path : null;

    const result = await pool.query(
      'INSERT INTO orders (company_id, customer_id, order_ref, file_path, remarks, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.company_id, customer_id, order_ref, filePath, remarks, req.user.id]
    );
    const order = result.rows[0];

    // Parse order PDF for styles if file uploaded
    if (req.file) {
      parseOrderStyles(order.id, req.file.path).catch(err => console.error('Style parsing error:', err));
    }

    res.status(201).json(order);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

async function parseOrderStyles(orderId, filePath) {
  try {
    const pdfBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(pdfBuffer);

    const styles = await parseJSON(
      `Extract all jewelry order line items from this text. Return JSON array with fields: vendor_style_code, dye_file_no, gold_kt, gold_colour, product_type, size, gross_weight. Return ONLY valid JSON, no other text.\n\nORDER TEXT:\n${pdfData.text}`
    );

    if (Array.isArray(styles)) {
      for (const style of styles) {
        await pool.query(
          `INSERT INTO order_styles (order_id, vendor_style_code, dye_file_no, gold_kt, gold_colour, product_type, size, gross_weight)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [orderId, style.vendor_style_code, style.dye_file_no, style.gold_kt, style.gold_colour, style.product_type, style.size, style.gross_weight]
        );
      }
    }
  } catch (err) {
    console.error('Failed to parse order styles:', err);
  }
}

router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await pool.query(
      `SELECT o.*, c.name as customer_name FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = $1`,
      [req.params.id]
    );
    if (order.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const styles = await pool.query('SELECT * FROM order_styles WHERE order_id = $1', [req.params.id]);
    const checklists = await pool.query('SELECT * FROM checklists WHERE order_id = $1', [req.params.id]);

    res.json({ ...order.rows[0], styles: styles.rows, checklists: checklists.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { order_ref, remarks, status } = req.body;
    const result = await pool.query(
      'UPDATE orders SET order_ref=COALESCE($1,order_ref), remarks=COALESCE($2,remarks), status=COALESCE($3,status) WHERE id=$4 RETURNING *',
      [order_ref, remarks, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// Order styles sub-routes
router.get('/:id/styles', authenticate, async (req, res) => {
  const result = await pool.query('SELECT * FROM order_styles WHERE order_id = $1', [req.params.id]);
  res.json(result.rows);
});

router.post('/:id/styles', authenticate, async (req, res) => {
  const { vendor_style_code, dye_file_no, gold_kt, gold_colour, product_type, size, gross_weight, target_weight, portal_design_url, remarks } = req.body;
  const result = await pool.query(
    `INSERT INTO order_styles (order_id, vendor_style_code, dye_file_no, gold_kt, gold_colour, product_type, size, gross_weight, target_weight, portal_design_url, remarks)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [req.params.id, vendor_style_code, dye_file_no, gold_kt, gold_colour, product_type, size, gross_weight, target_weight, portal_design_url, remarks]
  );
  res.status(201).json(result.rows[0]);
});

router.put('/:id/styles/:styleId', authenticate, async (req, res) => {
  const fields = req.body;
  const setClauses = Object.keys(fields).map((k, i) => `${k}=$${i+1}`).join(', ');
  const values = Object.values(fields);
  values.push(req.params.styleId);
  const result = await pool.query(`UPDATE order_styles SET ${setClauses} WHERE id=$${values.length} RETURNING *`, values);
  res.json(result.rows[0]);
});

router.delete('/:id/styles/:styleId', authenticate, async (req, res) => {
  await pool.query('DELETE FROM order_styles WHERE id = $1', [req.params.styleId]);
  res.json({ success: true });
});

// Upload sample image for a style
router.post('/:id/styles/:styleId/image', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image required' });
    const relativePath = `/storage/orders/${req.params.id}/images/${req.file.filename}`;
    await pool.query('UPDATE order_styles SET sample_image_path=$1 WHERE id=$2', [relativePath, req.params.styleId]);
    res.json({ image_path: relativePath });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Re-parse order PDF for styles
router.post('/:id/reparse', authenticate, async (req, res) => {
  try {
    const order = await pool.query('SELECT file_path FROM orders WHERE id = $1', [req.params.id]);
    if (!order.rows[0]?.file_path) return res.status(400).json({ error: 'No PDF file for this order' });

    // Clear existing styles and re-parse
    await pool.query('DELETE FROM order_styles WHERE order_id = $1', [req.params.id]);

    const pdfBuffer = await fs.readFile(order.rows[0].file_path);
    const pdfData = await pdfParse(pdfBuffer);

    const styles = await parseJSON(
      `Extract all jewelry order line items from this text. Return JSON array with fields: vendor_style_code, dye_file_no, gold_kt, gold_colour, product_type, size, gross_weight. Return ONLY valid JSON, no other text.\n\nORDER TEXT:\n${pdfData.text}`
    );

    if (Array.isArray(styles)) {
      for (const style of styles) {
        await pool.query(
          `INSERT INTO order_styles (order_id, vendor_style_code, dye_file_no, gold_kt, gold_colour, product_type, size, gross_weight)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [req.params.id, style.vendor_style_code, style.dye_file_no, style.gold_kt, style.gold_colour, style.product_type, style.size, style.gross_weight]
        );
      }
    }

    const result = await pool.query('SELECT * FROM order_styles WHERE order_id = $1', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Reparse error:', err);
    res.status(500).json({ error: 'Failed to reparse: ' + err.message });
  }
});

export default router;
