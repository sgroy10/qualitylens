import { Router } from 'express';
import pool from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { generateChecklist } from '../services/checklist.service.js';

const router = Router();

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

router.put('/:id/items/:itemId', authenticate, async (req, res) => {
  try {
    const { result, remarks } = req.body;
    const updated = await pool.query(
      'UPDATE checklist_items SET result=$1, remarks=$2, checked_by=$3, checked_at=NOW() WHERE id=$4 RETURNING *',
      [result, remarks, req.user.id, req.params.itemId]
    );

    // Check if all items are completed
    const checklistId = req.params.id;
    const pending = await pool.query(
      'SELECT COUNT(*) FROM checklist_items WHERE checklist_id = $1 AND result IS NULL',
      [checklistId]
    );
    if (parseInt(pending.rows[0].count) === 0) {
      await pool.query('UPDATE checklists SET status=$1, completed_at=NOW() WHERE id=$2', ['completed', checklistId]);
    } else {
      await pool.query('UPDATE checklists SET status=$1 WHERE id=$2', ['in_progress', checklistId]);
    }

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const checklist = await pool.query(
      `SELECT cl.*, o.order_ref, c.name as customer_name FROM checklists cl
       JOIN orders o ON cl.order_id = o.id JOIN customers c ON o.customer_id = c.id WHERE cl.id = $1`,
      [req.params.id]
    );
    const items = await pool.query('SELECT * FROM checklist_items WHERE checklist_id = $1 ORDER BY sequence_no', [req.params.id]);

    const cl = checklist.rows[0];
    const html = `<!DOCTYPE html><html><head><style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
      h1 { color: #1F3864; border-bottom: 2px solid #2E75B6; padding-bottom: 10px; }
      .header { margin-bottom: 20px; }
      .header p { margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th { background: #1F3864; color: white; padding: 8px; text-align: left; font-size: 12px; }
      td { border: 1px solid #ddd; padding: 8px; font-size: 11px; vertical-align: top; }
      tr:nth-child(even) { background: #f9f9f9; }
      .result-pass { color: green; font-weight: bold; }
      .result-fail { color: red; font-weight: bold; }
      .footer { margin-top: 40px; display: flex; justify-content: space-between; }
      .sign-box { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px; }
    </style></head><body>
      <h1>QC Checklist — ${cl.department}</h1>
      <div class="header">
        <p><strong>Company:</strong> Sky Gold & Diamonds Ltd</p>
        <p><strong>Customer:</strong> ${cl.customer_name}</p>
        <p><strong>Order:</strong> ${cl.order_ref}</p>
        <p><strong>Date:</strong> ${new Date(cl.created_at).toLocaleDateString()}</p>
        <p><strong>Status:</strong> ${cl.status}</p>
      </div>
      <table>
        <tr><th>#</th><th>Check Point</th><th>Specification</th><th>Method</th><th>Page</th><th>Result</th><th>Remarks</th></tr>
        ${items.rows.map(i => `<tr>
          <td>${i.sequence_no}</td>
          <td>${i.check_point}</td>
          <td>${i.specification}</td>
          <td>${i.verification_method || ''}</td>
          <td>${i.manual_page_ref || ''}</td>
          <td class="${i.result === 'pass' ? 'result-pass' : i.result === 'fail' ? 'result-fail' : ''}">${(i.result || '').toUpperCase()}</td>
          <td>${i.remarks || ''}</td>
        </tr>`).join('')}
      </table>
      <div class="footer">
        <div class="sign-box">QA Inspector</div>
        <div class="sign-box">QA Manager</div>
        <div class="sign-box">Supervisor</div>
      </div>
    </body></html>`;

    // Try puppeteer, fallback to HTML
    try {
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=checklist-${cl.department}-${cl.order_ref}.pdf`);
      res.send(pdf);
    } catch (err) {
      console.log('Puppeteer not available, returning HTML:', err.message);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
