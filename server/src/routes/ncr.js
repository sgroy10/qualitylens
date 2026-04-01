import { Router } from 'express';
import pool from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const { customer_id, status } = req.query;
    let query = `SELECT n.*, c.name as customer_name, o.order_ref
      FROM ncr_register n
      LEFT JOIN customers c ON n.customer_id = c.id
      LEFT JOIN orders o ON n.order_id = o.id
      WHERE n.company_id = $1`;
    const params = [req.user.company_id];
    let idx = 2;
    if (customer_id) { query += ` AND n.customer_id = $${idx++}`; params.push(customer_id); }
    if (status) { query += ` AND n.status = $${idx++}`; params.push(status); }
    query += ' ORDER BY n.raised_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch NCRs' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { customer_id, order_id, ncr_ref, rejection_category, defect_description, root_cause, corrective_action } = req.body;
    const result = await pool.query(
      `INSERT INTO ncr_register (company_id, customer_id, order_id, ncr_ref, rejection_category, defect_description, root_cause, corrective_action, raised_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.company_id, customer_id, order_id, ncr_ref, rejection_category, defect_description, root_cause, corrective_action, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create NCR' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*, c.name as customer_name, o.order_ref FROM ncr_register n
       LEFT JOIN customers c ON n.customer_id = c.id LEFT JOIN orders o ON n.order_id = o.id WHERE n.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch NCR' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { rejection_category, defect_description, root_cause, corrective_action, status } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;

    if (rejection_category !== undefined) { updates.push(`rejection_category=$${idx++}`); values.push(rejection_category); }
    if (defect_description !== undefined) { updates.push(`defect_description=$${idx++}`); values.push(defect_description); }
    if (root_cause !== undefined) { updates.push(`root_cause=$${idx++}`); values.push(root_cause); }
    if (corrective_action !== undefined) { updates.push(`corrective_action=$${idx++}`); values.push(corrective_action); }
    if (status !== undefined) {
      updates.push(`status=$${idx++}`); values.push(status);
      if (status === 'closed') {
        updates.push(`closed_by=$${idx++}`); values.push(req.user.id);
        updates.push(`closed_at=NOW()`);
      }
    }

    values.push(req.params.id);
    const result = await pool.query(`UPDATE ncr_register SET ${updates.join(', ')} WHERE id=$${idx} RETURNING *`, values);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update NCR' });
  }
});

export default router;
