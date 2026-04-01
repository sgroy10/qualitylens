import { Router } from 'express';
import pool from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/summary', authenticate, async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [openOrders, pendingChecklists, openNcrs, rejectionRate, recentActivity] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM orders WHERE company_id = $1 AND status IN ('open', 'in_production')", [companyId]),
      pool.query(`SELECT COUNT(*) FROM checklists cl JOIN orders o ON cl.order_id = o.id WHERE o.company_id = $1 AND cl.status = 'pending'`, [companyId]),
      pool.query("SELECT COUNT(*) FROM ncr_register WHERE company_id = $1 AND status = 'open'", [companyId]),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE result = 'fail') as fails,
        COUNT(*) as total
        FROM tp_qc_results t JOIN orders o ON t.order_id = o.id
        WHERE o.company_id = $1 AND t.created_at > NOW() - INTERVAL '30 days'`, [companyId]),
      pool.query(`SELECT 'order' as type, order_ref as title, created_at FROM orders WHERE company_id = $1
        UNION ALL
        SELECT 'ncr', ncr_ref, raised_at FROM ncr_register WHERE company_id = $1
        ORDER BY created_at DESC LIMIT 10`, [companyId])
    ]);

    const rate = rejectionRate.rows[0];

    res.json({
      open_orders: parseInt(openOrders.rows[0].count),
      pending_checklists: parseInt(pendingChecklists.rows[0].count),
      open_ncrs: parseInt(openNcrs.rows[0].count),
      rejection_rate_this_month: rate.total > 0 ? Math.round((rate.fails / rate.total) * 100) : 0,
      recent_activity: recentActivity.rows
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

export default router;
