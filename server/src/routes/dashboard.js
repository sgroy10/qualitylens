import { Router } from 'express';
import pool from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/summary', authenticate, async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [
      openOrders,
      pendingChecklists,
      openNCRs,
      recentOrders,
      recentNCRs,
      manualCount,
      checklistStats
    ] = await Promise.all([
      pool.query(
        "SELECT COUNT(*) FROM orders WHERE company_id=$1 AND status IN ('open','in_production')",
        [companyId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM checklists cl JOIN orders o ON cl.order_id=o.id
         WHERE o.company_id=$1 AND cl.status IN ('pending','draft','in_progress')`,
        [companyId]
      ),
      pool.query(
        "SELECT COUNT(*) FROM ncr_register WHERE company_id=$1 AND status='open'",
        [companyId]
      ),
      pool.query(
        `SELECT o.id, o.order_ref, o.status, o.created_at,
                c.name as customer_name,
                COUNT(os.id) as style_count
         FROM orders o
         JOIN customers c ON o.customer_id=c.id
         LEFT JOIN order_styles os ON os.order_id=o.id
         WHERE o.company_id=$1
         GROUP BY o.id, o.order_ref, o.status, o.created_at, c.name
         ORDER BY o.created_at DESC LIMIT 5`,
        [companyId]
      ),
      pool.query(
        `SELECT n.id, n.ncr_ref, n.rejection_category, n.status, n.raised_at,
                c.name as customer_name
         FROM ncr_register n
         LEFT JOIN customers c ON n.customer_id=c.id
         WHERE n.company_id=$1
         ORDER BY n.raised_at DESC LIMIT 5`,
        [companyId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM manuals m
         JOIN customers c ON m.customer_id=c.id
         WHERE c.company_id=$1 AND m.status='ready'`,
        [companyId]
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE result='pass') as passed,
           COUNT(*) FILTER (WHERE result='fail') as failed,
           COUNT(*) as total
         FROM tp_qc_results tq
         JOIN orders o ON tq.order_id=o.id
         WHERE o.company_id=$1 AND tq.created_at > NOW() - INTERVAL '30 days'`,
        [companyId]
      )
    ]);

    const tpStats = checklistStats.rows[0];
    const rejectionRate = tpStats.total > 0
      ? Math.round((tpStats.failed / tpStats.total) * 100)
      : 0;

    res.json({
      open_orders: parseInt(openOrders.rows[0].count),
      pending_checklists: parseInt(pendingChecklists.rows[0].count),
      open_ncrs: parseInt(openNCRs.rows[0].count),
      ready_manuals: parseInt(manualCount.rows[0].count),
      rejection_rate_this_month: rejectionRate,
      recent_orders: recentOrders.rows,
      recent_ncrs: recentNCRs.rows,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

export default router;
