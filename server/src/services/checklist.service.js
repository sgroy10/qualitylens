import pool from '../db/index.js';
import { parseJSON } from './ai.service.js';

export async function generateChecklist(orderId, department, userId) {
  // Fetch order with customer info
  const orderRes = await pool.query(
    `SELECT o.*, c.name as customer_name FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = $1`,
    [orderId]
  );
  if (orderRes.rows.length === 0) throw new Error('Order not found');
  const order = orderRes.rows[0];

  // Fetch order styles
  const stylesRes = await pool.query('SELECT * FROM order_styles WHERE order_id = $1', [orderId]);
  const styles = stylesRes.rows;

  // Fetch customer manual content
  const manualRes = await pool.query(
    `SELECT mp.page_number, mp.content FROM manual_pages mp
     JOIN manuals m ON mp.manual_id = m.id
     WHERE m.customer_id = $1 AND m.status = 'ready'
     ORDER BY m.id DESC, mp.page_number`,
    [order.customer_id]
  );
  const manualContent = manualRes.rows.map(r => `--- PAGE ${r.page_number} ---\n${r.content}`).join('\n\n');

  // Build prompt
  const prompt = `You are a jewelry QC expert. Generate a department QC checklist for the following order being manufactured for ${order.customer_name}.

CUSTOMER QA MANUAL CONTENT:
${manualContent || 'No manual uploaded yet. Generate general jewelry QC checks for this department.'}

ORDER DETAILS:
${JSON.stringify(styles, null, 2)}

DEPARTMENT: ${department}

Generate a checklist with 10-15 specific check points relevant to this department for this specific order. Each check point must:
1. Be directly derived from the customer's QA manual (if available)
2. Include the exact specification from the manual
3. Include how to verify it
4. Reference the manual page number where this spec is found (0 if no manual)

Return ONLY a JSON array with objects containing:
{
  "sequence_no": number,
  "check_point": "string",
  "specification": "string",
  "verification_method": "string",
  "manual_page_ref": number
}

Focus on specs specific to: gold_kt=${styles.map(s => s.gold_kt).filter(Boolean).join(',')}, colour=${styles.map(s => s.gold_colour).filter(Boolean).join(',')}, product_type=${styles.map(s => s.product_type).filter(Boolean).join(',')}, weight_ranges=${styles.map(s => s.gross_weight).filter(Boolean).join('-')}`;

  const items = await parseJSON(prompt);

  // Create checklist record
  const checklistRes = await pool.query(
    `INSERT INTO checklists (order_id, department, generated_by_ai, assigned_to) VALUES ($1, $2, true, $3) RETURNING id`,
    [orderId, department, userId]
  );
  const checklistId = checklistRes.rows[0].id;

  // Fetch manual images for reference matching
  const imagesRes = await pool.query(
    `SELECT mi.id, mi.topic_tags FROM manual_images mi
     JOIN manuals m ON mi.manual_id = m.id
     WHERE m.customer_id = $1`,
    [order.customer_id]
  );

  // Insert checklist items
  for (const item of items) {
    // Try to find a relevant reference image
    let refImageId = null;
    if (imagesRes.rows.length > 0) {
      const checkWords = item.check_point.toLowerCase().split(/\s+/);
      let bestMatch = null;
      let bestScore = 0;

      for (const img of imagesRes.rows) {
        const tags = (img.topic_tags || '').toLowerCase();
        const score = checkWords.filter(w => tags.includes(w)).length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = img.id;
        }
      }
      if (bestScore >= 2) refImageId = bestMatch;
    }

    await pool.query(
      `INSERT INTO checklist_items (checklist_id, sequence_no, check_point, specification, verification_method, manual_page_ref, reference_image_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [checklistId, item.sequence_no, item.check_point, item.specification, item.verification_method, item.manual_page_ref, refImageId]
    );
  }

  return checklistId;
}
