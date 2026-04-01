import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import pool from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { generateChecklist } from '../services/checklist.service.js';
import { generateChecklistPDF } from '../services/pdf.print.service.js';

const router = Router();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = path.join(process.env.STORAGE_PATH || './storage', 'checklists', req.params.id, 'images');
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
    const { order_id } = req.query;
    let query = `SELECT cl.*, o.order_ref, c.name as customer_name,
      (SELECT COUNT(*) FROM checklist_items WHERE checklist_id = cl.id) as total_items,
      (SELECT COUNT(*) FROM checklist_items WHERE checklist_id = cl.id AND result IS NOT NULL) as completed_items
      FROM checklists cl
      JOIN orders o ON cl.order_id = o.id
      JOIN customers c ON o.customer_id = c.id
      WHERE o.company_id = $1`;
    const params = [req.user.company_id];
    if (order_id) {
      query += ' AND cl.order_id = $2';
      params.push(order_id);
    }
    query += ' ORDER BY cl.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch checklists' });
  }
});

router.post('/generate', authenticate, async (req, res) => {
  try {
    const { order_id, department } = req.body;
    if (!order_id || !department) return res.status(400).json({ error: 'order_id and department required' });

    const checklistId = await generateChecklist(order_id, department, req.user.id);

    // Fetch the complete checklist
    const checklist = await pool.query('SELECT * FROM checklists WHERE id = $1', [checklistId]);
    const items = await pool.query('SELECT * FROM checklist_items WHERE checklist_id = $1 ORDER BY sequence_no', [checklistId]);

    res.status(201).json({ ...checklist.rows[0], items: items.rows });
  } catch (err) {
    console.error('Checklist generation error:', err);
    res.status(500).json({ error: 'Failed to generate checklist: ' + err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const checklist = await pool.query(
      `SELECT cl.*, o.order_ref, c.name as customer_name FROM checklists cl
       JOIN orders o ON cl.order_id = o.id JOIN customers c ON o.customer_id = c.id WHERE cl.id = $1`,
      [req.params.id]
    );
    if (checklist.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const items = await pool.query(
      `SELECT ci.*, mi.image_path, mi.caption as image_caption FROM checklist_items ci
       LEFT JOIN manual_images mi ON ci.reference_image_id = mi.id
       WHERE ci.checklist_id = $1 ORDER BY ci.sequence_no`,
      [req.params.id]
    );

    res.json({ ...checklist.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch checklist' });
  }
});

// Update checklist status
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'pending', 'in_progress', 'finalised'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const result = await pool.query(
      'UPDATE checklists SET status=$1, completed_at=$2 WHERE id=$3 RETURNING *',
      [status, status === 'finalised' ? new Date() : null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Add new checklist item
router.post('/:id/items', authenticate, async (req, res) => {
  try {
    const { check_point, specification, verification_method, manual_page_ref } = req.body;
    // Get next sequence number
    const maxSeq = await pool.query('SELECT COALESCE(MAX(sequence_no), 0) + 1 as next FROM checklist_items WHERE checklist_id = $1', [req.params.id]);
    const result = await pool.query(
      `INSERT INTO checklist_items (checklist_id, sequence_no, check_point, specification, verification_method, manual_page_ref)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.id, maxSeq.rows[0].next, check_point, specification, verification_method || '', manual_page_ref || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Update checklist item (full edit)
router.put('/:id/items/:itemId', authenticate, async (req, res) => {
  try {
    const { check_point, specification, verification_method, manual_page_ref, result, remarks } = req.body;
    const updated = await pool.query(
      `UPDATE checklist_items SET
        check_point=COALESCE($1,check_point), specification=COALESCE($2,specification),
        verification_method=COALESCE($3,verification_method), manual_page_ref=COALESCE($4,manual_page_ref),
        result=COALESCE($5,result), remarks=COALESCE($6,remarks),
        checked_by=$7, checked_at=CASE WHEN $5 IS NOT NULL THEN NOW() ELSE checked_at END
       WHERE id=$8 RETURNING *`,
      [check_point, specification, verification_method, manual_page_ref, result, remarks, req.user.id, req.params.itemId]
    );

    // Update checklist status based on completion
    const checklistId = req.params.id;
    const pending = await pool.query(
      'SELECT COUNT(*) FROM checklist_items WHERE checklist_id = $1 AND result IS NULL', [checklistId]
    );
    const total = await pool.query(
      'SELECT COUNT(*) FROM checklist_items WHERE checklist_id = $1', [checklistId]
    );
    if (parseInt(pending.rows[0].count) === 0 && parseInt(total.rows[0].count) > 0) {
      await pool.query("UPDATE checklists SET status='completed', completed_at=NOW() WHERE id=$1 AND status != 'finalised'", [checklistId]);
    } else if (parseInt(total.rows[0].count) - parseInt(pending.rows[0].count) > 0) {
      await pool.query("UPDATE checklists SET status='in_progress' WHERE id=$1 AND status NOT IN ('finalised', 'completed')", [checklistId]);
    }

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete checklist item
router.delete('/:id/items/:itemId', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM checklist_items WHERE id = $1 AND checklist_id = $2', [req.params.itemId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Upload reference image for checklist item
router.post('/:id/items/:itemId/image', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image file required' });
    const relativePath = `/storage/checklists/${req.params.id}/images/${req.file.filename}`;
    await pool.query('UPDATE checklist_items SET reference_image_path=$1 WHERE id=$2', [relativePath, req.params.itemId]);
    res.json({ image_path: relativePath });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const pdfBuffer = await generateChecklistPDF(parseInt(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="checklist-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Checklist PDF error:', err);
    res.status(500).json({ error: 'PDF generation failed: ' + err.message });
  }
});

export default router;
