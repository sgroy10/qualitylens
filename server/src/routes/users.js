import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, department, created_at FROM users WHERE company_id = $1 ORDER BY name',
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, role, department, password } = req.body;
    let query = 'UPDATE users SET name=COALESCE($1,name), role=COALESCE($2,role), department=COALESCE($3,department)';
    const params = [name, role, department];
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      params.push(hash);
      query += `, password_hash=$${params.length}`;
    }
    params.push(req.params.id);
    query += ` WHERE id=$${params.length} AND company_id=$${params.length + 1} RETURNING id, name, email, role, department`;
    params.push(req.user.company_id);
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
