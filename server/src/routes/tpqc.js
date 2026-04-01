import { Router } from 'express';
import pool from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { generateTPQCPDF, generateCorrectiveMeasuresPDF } from '../services/pdf.print.service.js';

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

router.get('/corrective-measures/:orderId/pdf', authenticate, async (req, res) => {
  try {
    const pdfBuffer = await generateCorrectiveMeasuresPDF(parseInt(req.params.orderId));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="corrective-measures-${req.params.orderId}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Corrective measures PDF error:', err);
    res.status(500).json({ error: 'PDF generation failed: ' + err.message });
  }
});

router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const pdfBuffer = await generateTPQCPDF(parseInt(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="tpqc-result-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('TPQC PDF error:', err);
    res.status(500).json({ error: 'PDF generation failed: ' + err.message });
  }
});

export default router;
