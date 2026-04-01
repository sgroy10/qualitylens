import { Router } from 'express';
import pool from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM customers WHERE company_id = $1 ORDER BY name',
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, portal_url, contact_name, contact_email, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO customers (company_id, name, portal_url, contact_name, contact_email, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.company_id, name, portal_url, contact_name, contact_email, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, portal_url, contact_name, contact_email, notes } = req.body;
    const result = await pool.query(
      'UPDATE customers SET name=$1, portal_url=$2, contact_name=$3, contact_email=$4, notes=$5 WHERE id=$6 AND company_id=$7 RETURNING *',
      [name, portal_url, contact_name, contact_email, notes, req.params.id, req.user.company_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

export default router;
