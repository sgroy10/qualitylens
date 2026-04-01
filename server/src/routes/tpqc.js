import { Router } from 'express';
import pool from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const { order_id } = req.query;
    let query = `SELECT t.*, os.vendor_style_code, o.order_ref, c.name as customer_name
      FROM tp_qc_results t
      LEFT JOIN order_styles os ON t.style_id = os.id
      JOIN orders o ON t.order_id = o.id
      JOIN customers c ON o.customer_id = c.id
      WHERE o.company_id = $1`;
    const params = [req.user.company_id];
    if (order_id) { query += ' AND t.order_id = $2'; params.push(order_id); }
    query += ' ORDER BY t.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch TP QC results' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { order_id, style_id, qty_sent, standard_reference, checked_by_tp, check_date, result, tp_remarks, corrective_action } = req.body;
    const r = await pool.query(
      `INSERT INTO tp_qc_results (order_id, style_id, qty_sent, standard_reference, checked_by_tp, check_date, result, tp_remarks, corrective_action, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [order_id, style_id, qty_sent, standard_reference, checked_by_tp, check_date, result, tp_remarks, corrective_action, req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create TP QC result' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { qty_sent, standard_reference, checked_by_tp, check_date, result, tp_remarks, corrective_action } = req.body;
    const r = await pool.query(
      `UPDATE tp_qc_results SET qty_sent=COALESCE($1,qty_sent), standard_reference=COALESCE($2,standard_reference),
       checked_by_tp=COALESCE($3,checked_by_tp), check_date=COALESCE($4,check_date), result=COALESCE($5,result),
       tp_remarks=COALESCE($6,tp_remarks), corrective_action=COALESCE($7,corrective_action) WHERE id=$8 RETURNING *`,
      [qty_sent, standard_reference, checked_by_tp, check_date, result, tp_remarks, corrective_action, req.params.id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update TP QC result' });
  }
});

router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const results = await pool.query(
      `SELECT t.*, os.vendor_style_code, o.order_ref, c.name as customer_name
       FROM tp_qc_results t
       LEFT JOIN order_styles os ON t.style_id = os.id
       JOIN orders o ON t.order_id = o.id
       JOIN customers c ON o.customer_id = c.id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (results.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = results.rows[0];

    const html = `<!DOCTYPE html><html><head><style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
      h1 { color: #1F3864; border-bottom: 2px solid #2E75B6; padding-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th { background: #1F3864; color: white; padding: 10px; text-align: left; }
      td { border: 1px solid #ddd; padding: 10px; }
      .footer { margin-top: 60px; display: flex; justify-content: space-between; }
      .sign-box { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 8px; }
    </style></head><body>
      <h1>Third Party QC Result Sheet</h1>
      <p><strong>Company:</strong> Sky Gold & Diamonds Ltd, Navi Mumbai</p>
      <p><strong>Customer:</strong> ${r.customer_name}</p>
      <p><strong>Order Ref:</strong> ${r.order_ref}</p>
      <p><strong>Date:</strong> ${r.check_date || new Date().toLocaleDateString()}</p>
      <table>
        <tr><th>Style Code</th><th>Qty Sent</th><th>Standard/Spec</th><th>Result</th><th>TP Remarks</th><th>Corrective Action</th></tr>
        <tr>
          <td>${r.vendor_style_code || '-'}</td>
          <td>${r.qty_sent || '-'}</td>
          <td>${r.standard_reference || '-'}</td>
          <td style="color: ${r.result === 'pass' ? 'green' : 'red'}; font-weight: bold;">${(r.result || '').toUpperCase()}</td>
          <td>${r.tp_remarks || '-'}</td>
          <td>${r.corrective_action || '-'}</td>
        </tr>
      </table>
      <div class="footer">
        <div class="sign-box">QA Manager</div>
        <div class="sign-box">Third Party QC Inspector</div>
      </div>
    </body></html>`;

    try {
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();
      res.setHeader('Content-Type', 'application/pdf');
      res.send(pdf);
    } catch {
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
