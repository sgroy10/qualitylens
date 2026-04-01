import puppeteer from 'puppeteer';
import pool from '../db/index.js';

// ─── LAUNCH BROWSER ──────────────────────────────────────────────
async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process'
    ]
  });
}

// ─── GENERATE CHECKLIST PDF ──────────────────────────────────────
export async function generateChecklistPDF(checklistId) {
  // Fetch checklist with order and customer info
  const checklistRes = await pool.query(
    `SELECT cl.*, o.order_ref, o.remarks as order_remarks,
            c.name as customer_name,
            u.name as assigned_to_name
     FROM checklists cl
     JOIN orders o ON cl.order_id = o.id
     JOIN customers c ON o.customer_id = c.id
     LEFT JOIN users u ON cl.assigned_to = u.id
     WHERE cl.id = $1`,
    [checklistId]
  );

  if (checklistRes.rows.length === 0) throw new Error('Checklist not found');
  const checklist = checklistRes.rows[0];

  // Fetch checklist items
  const itemsRes = await pool.query(
    `SELECT ci.*, u.name as checked_by_name,
            mi.image_path as ref_image_path,
            mi.caption as ref_image_caption
     FROM checklist_items ci
     LEFT JOIN users u ON ci.checked_by = u.id
     LEFT JOIN manual_images mi ON ci.reference_image_id = mi.id
     WHERE ci.checklist_id = $1
     ORDER BY ci.sequence_no`,
    [checklistId]
  );
  const items = itemsRes.rows;

  // Fetch order styles for context
  const stylesRes = await pool.query(
    `SELECT * FROM order_styles WHERE order_id = $1`,
    [checklist.order_id]
  );
  const styles = stylesRes.rows;

  // Calculate stats
  const total = items.length;
  const passed = items.filter(i => i.result === 'pass').length;
  const failed = items.filter(i => i.result === 'fail').length;
  const pending = items.filter(i => !i.result || i.result === '').length;
  const completion = total > 0 ? Math.round((passed + failed) / total * 100) : 0;

  // Department color map
  const deptColors = {
    'CAD QC': '#1F3864',
    'Casting QC': '#C55A11',
    'Filing QC': '#1F6864',
    'Electropolish QC': '#7030A0',
    'Polish QC': '#375623',
    'Plating QC': '#C00000',
    'Final QC': '#1F3864',
    'cad': '#1F3864',
    'casting': '#C55A11',
    'filing': '#1F6864',
    'polish': '#375623',
    'plating': '#C00000',
    'final': '#1F3864',
  };
  const deptColor = deptColors[checklist.department] || '#1F3864';

  // Build HTML
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      color: #333;
      background: white;
    }

    /* HEADER */
    .header {
      background: ${deptColor};
      color: white;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-left h1 { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
    .header-left h2 { font-size: 13px; font-weight: normal; opacity: 0.85; }
    .header-right { text-align: right; font-size: 10px; opacity: 0.9; line-height: 1.6; }

    /* ORDER INFO BAR */
    .order-bar {
      background: #f0f4f8;
      border-bottom: 2px solid ${deptColor};
      padding: 10px 24px;
      display: flex;
      gap: 32px;
      flex-wrap: wrap;
    }
    .order-bar-item { display: flex; flex-direction: column; }
    .order-bar-item .label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .order-bar-item .value { font-size: 12px; font-weight: bold; color: #1F3864; margin-top: 2px; }

    /* STATS ROW */
    .stats-row {
      display: flex;
      padding: 12px 24px;
      gap: 16px;
      border-bottom: 1px solid #e0e0e0;
    }
    .stat-card {
      flex: 1;
      border-radius: 6px;
      padding: 8px 12px;
      text-align: center;
    }
    .stat-card.total { background: #e8f0fe; }
    .stat-card.passed { background: #e2efda; }
    .stat-card.failed { background: #fce4d6; }
    .stat-card.pending { background: #fff2cc; }
    .stat-card .num { font-size: 22px; font-weight: bold; }
    .stat-card.total .num { color: #1F3864; }
    .stat-card.passed .num { color: #375623; }
    .stat-card.failed .num { color: #C00000; }
    .stat-card.pending .num { color: #C55A11; }
    .stat-card .lbl { font-size: 9px; text-transform: uppercase; color: #666; margin-top: 2px; }

    /* ORDER STYLES TABLE */
    .section-title {
      font-size: 11px;
      font-weight: bold;
      color: ${deptColor};
      padding: 10px 24px 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .styles-table {
      width: calc(100% - 48px);
      margin: 0 24px 12px;
      border-collapse: collapse;
      font-size: 10px;
    }
    .styles-table th {
      background: ${deptColor};
      color: white;
      padding: 6px 8px;
      text-align: left;
    }
    .styles-table td {
      padding: 5px 8px;
      border-bottom: 1px solid #e0e0e0;
    }
    .styles-table tr:nth-child(even) td { background: #f8f8f8; }

    /* CHECKLIST TABLE */
    .checklist-table {
      width: calc(100% - 48px);
      margin: 0 24px;
      border-collapse: collapse;
      font-size: 10px;
    }
    .checklist-table th {
      background: ${deptColor};
      color: white;
      padding: 7px 8px;
      text-align: left;
      font-size: 10px;
    }
    .checklist-table td {
      padding: 7px 8px;
      border-bottom: 1px solid #e0e0e0;
      vertical-align: top;
    }
    .checklist-table tr:nth-child(even) td { background: #f8f8f8; }
    .checklist-table tr:nth-child(odd) td { background: #ffffff; }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 9px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge.pass { background: #e2efda; color: #375623; }
    .badge.fail { background: #fce4d6; color: #C00000; }
    .badge.pending { background: #fff2cc; color: #C55A11; }
    .badge.na { background: #e0e0e0; color: #666; }

    .page-ref {
      font-size: 9px;
      color: #888;
      font-style: italic;
      margin-top: 3px;
    }
    .item-remarks {
      font-size: 9px;
      color: #555;
      font-style: italic;
      margin-top: 3px;
      border-top: 1px dashed #ddd;
      padding-top: 3px;
    }

    /* SIGN OFF */
    .signoff {
      margin: 24px 24px 16px;
      border: 1px solid #ddd;
      border-radius: 6px;
      overflow: hidden;
    }
    .signoff-header {
      background: ${deptColor};
      color: white;
      padding: 7px 16px;
      font-size: 11px;
      font-weight: bold;
    }
    .signoff-body {
      display: flex;
      padding: 16px;
      gap: 24px;
    }
    .signoff-col {
      flex: 1;
      border-right: 1px dashed #ddd;
      padding-right: 24px;
    }
    .signoff-col:last-child { border-right: none; padding-right: 0; }
    .signoff-col .slabel { font-size: 9px; color: #888; text-transform: uppercase; margin-bottom: 8px; }
    .signoff-col .sline {
      border-bottom: 1px solid #333;
      margin-bottom: 4px;
      height: 28px;
    }
    .signoff-col .sname { font-size: 9px; color: #666; }

    /* NOTE BOX */
    .note-box {
      margin: 0 24px 16px;
      background: #fff2cc;
      border: 1px solid #ffd700;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 10px;
      color: #555;
    }

    /* FOOTER */
    .footer {
      border-top: 2px solid ${deptColor};
      padding: 8px 24px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #888;
      margin-top: 16px;
    }

    /* PAGE BREAK */
    .page-break { page-break-before: always; }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <h1>${checklist.department} — QC Checklist</h1>
      <h2>SKY GOLD & DIAMONDS LTD &nbsp;|&nbsp; ${checklist.customer_name} Order: ${checklist.order_ref}</h2>
    </div>
    <div class="header-right">
      <div>Doc Ref: SKY-QC-${checklist.department.replace(/\s+/g, '').substring(0,3).toUpperCase()}-${checklist.id.toString().padStart(4,'0')}</div>
      <div>Customer: ${checklist.customer_name}</div>
      <div>Generated: ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</div>
      <div>Status: ${checklist.status.toUpperCase()}</div>
    </div>
  </div>

  <!-- ORDER INFO BAR -->
  <div class="order-bar">
    <div class="order-bar-item">
      <span class="label">Order Reference</span>
      <span class="value">${checklist.order_ref}</span>
    </div>
    <div class="order-bar-item">
      <span class="label">Department</span>
      <span class="value">${checklist.department}</span>
    </div>
    <div class="order-bar-item">
      <span class="label">Assigned To</span>
      <span class="value">${checklist.assigned_to_name || 'Unassigned'}</span>
    </div>
    <div class="order-bar-item">
      <span class="label">Completion</span>
      <span class="value">${completion}%</span>
    </div>
    ${checklist.order_remarks ? `
    <div class="order-bar-item">
      <span class="label">Order Remarks</span>
      <span class="value">${checklist.order_remarks}</span>
    </div>` : ''}
  </div>

  <!-- STATS ROW -->
  <div class="stats-row">
    <div class="stat-card total">
      <div class="num">${total}</div>
      <div class="lbl">Total Checks</div>
    </div>
    <div class="stat-card passed">
      <div class="num">${passed}</div>
      <div class="lbl">Passed</div>
    </div>
    <div class="stat-card failed">
      <div class="num">${failed}</div>
      <div class="lbl">Failed</div>
    </div>
    <div class="stat-card pending">
      <div class="num">${pending}</div>
      <div class="lbl">Pending</div>
    </div>
  </div>

  <!-- ORDER STYLES -->
  ${styles.length > 0 ? `
  <div class="section-title">Order Styles in this Batch</div>
  <table class="styles-table">
    <thead>
      <tr>
        <th>Style Code</th>
        <th>Dye/File No</th>
        <th>Gold KT</th>
        <th>Colour</th>
        <th>Product</th>
        <th>Size</th>
        <th>Gross Wt (g)</th>
        <th>Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${styles.map(s => `
      <tr>
        <td><strong>${s.vendor_style_code || '\u2014'}</strong></td>
        <td>${s.dye_file_no || '\u2014'}</td>
        <td>${s.gold_kt || '\u2014'}</td>
        <td>${s.gold_colour || '\u2014'}</td>
        <td>${s.product_type || '\u2014'}</td>
        <td>${s.size || '\u2014'}</td>
        <td>${s.gross_weight || '\u2014'}</td>
        <td>${s.remarks || '\u2014'}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  <!-- CHECKLIST ITEMS -->
  <div class="section-title">Quality Check Points</div>
  <table class="checklist-table">
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th style="width:180px">Check Point</th>
        <th style="width:200px">Specification</th>
        <th style="width:150px">How to Verify</th>
        <th style="width:60px">Manual Ref</th>
        <th style="width:55px">Result</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
      <tr>
        <td style="text-align:center; font-weight:bold;">${item.sequence_no}</td>
        <td>
          <strong>${item.check_point}</strong>
          ${item.remarks ? `<div class="item-remarks">Remark: ${item.remarks}</div>` : ''}
        </td>
        <td>${item.specification}</td>
        <td>${item.verification_method || '\u2014'}</td>
        <td style="text-align:center;">
          ${item.manual_page_ref && item.manual_page_ref > 0 ? `<span class="page-ref">Pg. ${item.manual_page_ref}</span>` : '\u2014'}
        </td>
        <td style="text-align:center;">
          ${item.result === 'pass' ? '<span class="badge pass">Pass</span>'
            : item.result === 'fail' ? '<span class="badge fail">Fail</span>'
            : item.result === 'na' ? '<span class="badge na">N/A</span>'
            : '<span class="badge pending">Pending</span>'}
          ${item.checked_by_name ? `<div style="font-size:8px;color:#888;margin-top:2px;">${item.checked_by_name}</div>` : ''}
        </td>
      </tr>`).join('')}
    </tbody>
  </table>

  <!-- NOTE IF FAILURES EXIST -->
  ${failed > 0 ? `
  <div class="note-box" style="margin-top:16px;">
    <strong>${failed} check point(s) failed.</strong> Raise NCR for each failed item before proceeding to next department. Do NOT dispatch.
  </div>` : ''}

  <!-- SIGN OFF -->
  <div class="signoff">
    <div class="signoff-header">Department Sign-Off</div>
    <div class="signoff-body">
      <div class="signoff-col">
        <div class="slabel">QC Supervisor Name</div>
        <div class="sline"></div>
        <div class="sname">${checklist.assigned_to_name || '________________________'}</div>
      </div>
      <div class="signoff-col">
        <div class="slabel">Signature</div>
        <div class="sline"></div>
        <div class="sname">Signature</div>
      </div>
      <div class="signoff-col">
        <div class="slabel">Date & Time</div>
        <div class="sline"></div>
        <div class="sname">Date / Time</div>
      </div>
      <div class="signoff-col">
        <div class="slabel">QA Manager Approval</div>
        <div class="sline"></div>
        <div class="sname">QA Manager</div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <span>SKY GOLD & DIAMONDS LTD | MIDC Shirvane, Navi Mumbai | Confidential — For Internal QC Use Only</span>
    <span>QualityLens | Checklist ID: ${checklist.id} | ${new Date().toLocaleDateString('en-IN')}</span>
  </div>

</body>
</html>`;

  // Generate PDF with Puppeteer
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}


// ─── GENERATE TPQC RESULT SHEET PDF ─────────────────────────────
export async function generateTPQCPDF(tpqcId) {
  // Fetch TPQC result with order and style info
  const tpqcRes = await pool.query(
    `SELECT tq.*,
            o.order_ref, o.remarks as order_remarks,
            c.name as customer_name,
            os.vendor_style_code, os.dye_file_no,
            os.gold_kt, os.gold_colour, os.product_type,
            os.size, os.gross_weight,
            u.name as recorded_by_name
     FROM tp_qc_results tq
     JOIN orders o ON tq.order_id = o.id
     JOIN customers c ON o.customer_id = c.id
     LEFT JOIN order_styles os ON tq.style_id = os.id
     LEFT JOIN users u ON tq.recorded_by = u.id
     WHERE tq.id = $1`,
    [tpqcId]
  );

  if (tpqcRes.rows.length === 0) throw new Error('TPQC result not found');
  const tpqc = tpqcRes.rows[0];

  // Also fetch ALL tpqc results for this order for full result sheet
  const allResultsRes = await pool.query(
    `SELECT tq.*,
            os.vendor_style_code, os.dye_file_no,
            os.gold_kt, os.gold_colour, os.product_type,
            os.size, os.gross_weight
     FROM tp_qc_results tq
     LEFT JOIN order_styles os ON tq.style_id = os.id
     WHERE tq.order_id = $1
     ORDER BY tq.id`,
    [tpqc.order_id]
  );
  const allResults = allResultsRes.rows;

  const totalSent = allResults.reduce((sum, r) => sum + (r.qty_sent || 0), 0);
  const passed = allResults.filter(r => r.result === 'pass').length;
  const failed = allResults.filter(r => r.result === 'fail').length;
  const rework = allResults.filter(r => r.result === 'rework').length;

  const resultColor = (result) => {
    if (result === 'pass') return '#375623';
    if (result === 'fail') return '#C00000';
    if (result === 'rework') return '#C55A11';
    return '#666';
  };

  const resultBg = (result) => {
    if (result === 'pass') return '#e2efda';
    if (result === 'fail') return '#fce4d6';
    if (result === 'rework') return '#fff2cc';
    return '#f0f0f0';
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      color: #333;
      background: white;
    }

    .header {
      background: #1F3864;
      color: white;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-left h1 { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
    .header-left h2 { font-size: 12px; font-weight: normal; opacity: 0.85; }
    .header-right { text-align: right; font-size: 10px; opacity: 0.9; line-height: 1.8; }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0;
      border-bottom: 2px solid #1F3864;
    }
    .info-cell {
      padding: 10px 16px;
      border-right: 1px solid #e0e0e0;
    }
    .info-cell:last-child { border-right: none; }
    .info-cell .label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-cell .value { font-size: 12px; font-weight: bold; color: #1F3864; margin-top: 3px; }

    .stats-row {
      display: flex;
      padding: 12px 24px;
      gap: 16px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }
    .stat {
      flex: 1;
      text-align: center;
      padding: 8px;
      border-radius: 6px;
    }
    .stat.s1 { background: #e8f0fe; }
    .stat.s2 { background: #e2efda; }
    .stat.s3 { background: #fce4d6; }
    .stat.s4 { background: #fff2cc; }
    .stat .num { font-size: 24px; font-weight: bold; }
    .stat.s1 .num { color: #1F3864; }
    .stat.s2 .num { color: #375623; }
    .stat.s3 .num { color: #C00000; }
    .stat.s4 .num { color: #C55A11; }
    .stat .lbl { font-size: 9px; text-transform: uppercase; color: #666; }

    .section-title {
      font-size: 11px;
      font-weight: bold;
      color: #1F3864;
      padding: 12px 24px 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-top: 1px solid #e0e0e0;
    }

    table {
      width: calc(100% - 48px);
      margin: 0 24px 16px;
      border-collapse: collapse;
      font-size: 10px;
    }
    thead tr { background: #1F3864; color: white; }
    th { padding: 7px 8px; text-align: left; }
    td {
      padding: 7px 8px;
      border-bottom: 1px solid #e0e0e0;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: #f8f8f8; }

    .result-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 10px;
      font-size: 9px;
      font-weight: bold;
      text-transform: uppercase;
    }

    .signoff {
      margin: 8px 24px 16px;
      border: 1px solid #ddd;
      border-radius: 6px;
      overflow: hidden;
    }
    .signoff-header {
      background: #1F3864;
      color: white;
      padding: 7px 16px;
      font-size: 11px;
      font-weight: bold;
    }
    .signoff-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0;
    }
    .signoff-cell {
      padding: 16px;
      border-right: 1px dashed #ddd;
    }
    .signoff-cell:last-child { border-right: none; }
    .signoff-cell .slabel {
      font-size: 9px;
      color: #888;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .signoff-cell .sline {
      border-bottom: 1px solid #333;
      height: 28px;
      margin-bottom: 4px;
    }
    .signoff-cell .sname { font-size: 9px; color: #666; }

    .footer {
      border-top: 2px solid #1F3864;
      padding: 8px 24px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #888;
    }

    .official-notice {
      margin: 0 24px 16px;
      background: #e8f0fe;
      border: 1px solid #2E75B6;
      border-radius: 4px;
      padding: 10px 16px;
      font-size: 10px;
      color: #1F3864;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <h1>Third Party QC Result Sheet</h1>
      <h2>SKY GOLD & DIAMONDS LTD &nbsp;|&nbsp; Customer: ${tpqc.customer_name} &nbsp;|&nbsp; Order: ${tpqc.order_ref}</h2>
    </div>
    <div class="header-right">
      <div>Doc Ref: SKY-TPQC-${tpqc.order_id.toString().padStart(4,'0')}</div>
      <div>Check Date: ${tpqc.check_date ? new Date(tpqc.check_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : new Date().toLocaleDateString('en-IN')}</div>
      <div>Generated: ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</div>
      <div>Recorded By: ${tpqc.recorded_by_name || 'QA Manager'}</div>
    </div>
  </div>

  <!-- INFO GRID -->
  <div class="info-grid">
    <div class="info-cell">
      <div class="label">Customer</div>
      <div class="value">${tpqc.customer_name}</div>
    </div>
    <div class="info-cell">
      <div class="label">Order Reference</div>
      <div class="value">${tpqc.order_ref}</div>
    </div>
    <div class="info-cell">
      <div class="label">Third Party QC By</div>
      <div class="value">${tpqc.checked_by_tp || 'Customer QC Team'}</div>
    </div>
    <div class="info-cell">
      <div class="label">Inspection Date</div>
      <div class="value">${tpqc.check_date ? new Date(tpqc.check_date).toLocaleDateString('en-IN') : '\u2014'}</div>
    </div>
  </div>

  <!-- STATS -->
  <div class="stats-row">
    <div class="stat s1">
      <div class="num">${totalSent}</div>
      <div class="lbl">Total Pieces Sent</div>
    </div>
    <div class="stat s2">
      <div class="num">${passed}</div>
      <div class="lbl">Styles Passed</div>
    </div>
    <div class="stat s3">
      <div class="num">${failed}</div>
      <div class="lbl">Styles Failed</div>
    </div>
    <div class="stat s4">
      <div class="num">${rework}</div>
      <div class="lbl">Styles for Rework</div>
    </div>
  </div>

  <!-- RESULTS TABLE -->
  <div class="section-title">Inspection Results — Style Wise</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Style Code</th>
        <th>Dye/File No</th>
        <th>Product</th>
        <th>Gold KT</th>
        <th>Wt (g)</th>
        <th>Qty Sent</th>
        <th>Standard / Spec Checked</th>
        <th>Result</th>
        <th>TP Remarks</th>
        <th>Corrective Action</th>
      </tr>
    </thead>
    <tbody>
      ${allResults.map((r, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td><strong>${r.vendor_style_code || '\u2014'}</strong></td>
        <td>${r.dye_file_no || '\u2014'}</td>
        <td>${r.product_type || '\u2014'}</td>
        <td>${r.gold_kt || '\u2014'}</td>
        <td>${r.gross_weight || '\u2014'}</td>
        <td style="text-align:center">${r.qty_sent || '\u2014'}</td>
        <td>${r.standard_reference || '\u2014'}</td>
        <td style="text-align:center">
          <span class="result-badge" style="background:${resultBg(r.result)}; color:${resultColor(r.result)}">
            ${r.result ? r.result.toUpperCase() : 'PENDING'}
          </span>
        </td>
        <td>${r.tp_remarks || '\u2014'}</td>
        <td>${r.corrective_action || '\u2014'}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <!-- OFFICIAL NOTICE -->
  <div class="official-notice">
    <strong>This document is an official record of third-party QC inspection results.</strong>
    All failed/rework items must be logged in the NCR register before re-inspection.
    This sheet must be signed by both Sky Gold QA Manager and the Third Party QC Inspector
    and retained for a minimum of 5 years as per RJC COP 2.5 requirements.
  </div>

  <!-- SIGN OFF -->
  <div class="signoff">
    <div class="signoff-header">Official Sign-Off — Both Parties Required</div>
    <div class="signoff-grid">
      <div class="signoff-cell">
        <div class="slabel">Sky Gold — QA Manager</div>
        <div class="sline"></div>
        <div class="sname">Name: ________________________</div>
        <div style="margin-top:8px; border-bottom:1px solid #ccc; height:28px;"></div>
        <div class="sname">Date: ________________________</div>
      </div>
      <div class="signoff-cell">
        <div class="slabel">Third Party QC Inspector</div>
        <div class="sline"></div>
        <div class="sname">Name: ${tpqc.checked_by_tp || '________________________'}</div>
        <div style="margin-top:8px; border-bottom:1px solid #ccc; height:28px;"></div>
        <div class="sname">Date: ${tpqc.check_date ? new Date(tpqc.check_date).toLocaleDateString('en-IN') : '________________________'}</div>
      </div>
      <div class="signoff-cell">
        <div class="slabel">Customer Representative</div>
        <div class="sline"></div>
        <div class="sname">Name: ________________________</div>
        <div style="margin-top:8px; border-bottom:1px solid #ccc; height:28px;"></div>
        <div class="sname">Date: ________________________</div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <span>SKY GOLD & DIAMONDS LTD | MIDC Shirvane, Navi Mumbai 400706 | Confidential — Official QC Record</span>
    <span>QualityLens | Order: ${tpqc.order_ref} | ${new Date().toLocaleDateString('en-IN')}</span>
  </div>

</body>
</html>`;

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
