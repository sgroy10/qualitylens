import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import pool from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { processManual } from '../services/pdf.service.js';

const router = Router();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = path.join(process.env.STORAGE_PATH || './storage', 'manuals', 'uploads');
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage, fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/pdf') });

router.get('/', authenticate, async (req, res) => {
  try {
    const { customer_id } = req.query;
    let query = `SELECT m.*, c.name as customer_name FROM manuals m JOIN customers c ON m.customer_id = c.id WHERE c.company_id = $1`;
    const params = [req.user.company_id];
    if (customer_id) {
      query += ' AND m.customer_id = $2';
      params.push(customer_id);
    }
    query += ' ORDER BY m.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch manuals' });
  }
});

router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'PDF file required' });
    const { customer_id, version } = req.body;

    const result = await pool.query(
      'INSERT INTO manuals (customer_id, version, file_path, file_name, uploaded_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [customer_id, version || '1.0', req.file.path, req.file.originalname, req.user.id]
    );

    // Process in background
    processManual(result.rows[0].id, req.file.path).catch(err => console.error('Manual processing error:', err));

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const manual = await pool.query('SELECT m.*, c.name as customer_name FROM manuals m JOIN customers c ON m.customer_id = c.id WHERE m.id = $1', [req.params.id]);
    if (manual.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const pages = await pool.query('SELECT * FROM manual_pages WHERE manual_id = $1 ORDER BY page_number', [req.params.id]);
    const images = await pool.query('SELECT * FROM manual_images WHERE manual_id = $1 ORDER BY page_number', [req.params.id]);

    res.json({ ...manual.rows[0], pages: pages.rows, images: images.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch manual' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM manuals WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete manual' });
  }
});

router.post('/:id/reprocess', authenticate, async (req, res) => {
  try {
    const manual = await pool.query('SELECT * FROM manuals WHERE id = $1', [req.params.id]);
    if (manual.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    await pool.query('UPDATE manuals SET status = $1 WHERE id = $2', ['processing', req.params.id]);
    await pool.query('DELETE FROM manual_pages WHERE manual_id = $1', [req.params.id]);
    await pool.query('DELETE FROM manual_images WHERE manual_id = $1', [req.params.id]);

    processManual(manual.rows[0].id, manual.rows[0].file_path).catch(console.error);

    res.json({ message: 'Reprocessing started' });
  } catch (err) {
    res.status(500).json({ error: 'Reprocess failed' });
  }
});

export default router;
