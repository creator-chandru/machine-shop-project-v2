const sql = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ============================================================
// HELPER FUNCTIONS
// ============================================================
const DEFAULT_QF_VALUE = 'QF/07/MPD-06, Revision 05 dt 10.07.2026';
const PE_ROLES = ['productengineer', 'productionengineer', 'pe'];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Returns a valid 'YYYY-MM-DD' string or null (never throws, never returns garbage)
const cleanDateStr = (date) => {
  if (!date) return null;
  let d = String(date).trim();
  if (d.includes('T')) {
    d = d.split('T')[0];
  } else if (d.includes('/')) {
    const p = d.split('/');
    if (p.length === 3) d = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  }
  if (!ISO_DATE_RE.test(d)) return null;
  const parsed = new Date(`${d}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== d) return null;
  return d;
};

// mssql returns DATE columns as JS Date at UTC midnight -> use the UTC day (no timezone shift)
const toIsoDay = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  return cleanDateStr(value);
};

const formatDate = (value) => {
  const iso = toIsoDay(value);
  if (!iso) return value ? String(value) : '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const isPendingSign = (s) => !s || String(s).trim() === '' || String(s).startsWith('Pending');

const safeFilePart = (s) => String(s || '').replace(/[^\w.-]+/g, '_');

// ---- QF value (single source of truth for UI + PDF) ----
const loadQfHistory = async () => {
  const result = await sql.query`
    SELECT id, formName, qfValue, CONVERT(varchar(10), [date], 23) AS [date]
    FROM dbo.OperatorAllotmentQFvalues
    WHERE [date] IS NOT NULL
    ORDER BY [date] DESC, id DESC
  `;
  return result.recordset || [];
};

// history must be sorted newest -> oldest
const pickQfValue = (history, targetIso) => {
  if (!history || history.length === 0) return DEFAULT_QF_VALUE;
  if (!targetIso) return history[0].qfValue || DEFAULT_QF_VALUE;
  const match = history.find((q) => q.date <= targetIso);
  if (match) return match.qfValue || DEFAULT_QF_VALUE;
  // record is older than every revision -> use the oldest known revision
  return history[history.length - 1].qfValue || DEFAULT_QF_VALUE;
};

// ============================================================
// GET LINE CODES
// ============================================================
const getOperatorAllotmentLines = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT DISTINCT LTRIM(RTRIM(lineCode)) AS lineCode
      FROM dbo.MachineShop3Details
      WHERE lineCode IS NOT NULL
        AND LTRIM(RTRIM(lineCode)) <> ''
      ORDER BY LTRIM(RTRIM(lineCode)) ASC
    `;

    const lineCodes = result.recordset.map((row) => row.lineCode);
    return res.status(200).json({ lines: lineCodes, lineCodes });
  } catch (error) {
    console.error('getOperatorAllotmentLines:', error);
    return res.status(500).json({ error: 'Failed to fetch Line Codes' });
  }
};

// ============================================================
// GET PRODUCT ENGINEERS
// ============================================================
const getProductManagers = async (req, res) => {
  try {
    const peRes = await sql.query`
      SELECT username AS name, username, employeeId
      FROM dbo.MachineShopUsers
      WHERE LOWER(LTRIM(RTRIM(role))) IN ('productengineer', 'productionengineer', 'pe')
      ORDER BY username ASC
    `;

    const list = peRes.recordset || [];
    return res.status(200).json({
      peList: list,
      productManagers: list,
      productEngineers: list
    });
  } catch (error) {
    console.error('getProductManagers:', error);
    return res.status(500).json({ error: 'Failed to fetch PE list' });
  }
};

// ============================================================
// GET EFFECTIVE QF VALUE FOR A DATE   (GET /operator-allotment/qf-value?date=YYYY-MM-DD)
// ============================================================
const getOperatorAllotmentQfValue = async (req, res) => {
  try {
    const rawDate = req.query.date;
    let targetIso = null;
    if (rawDate) {
      targetIso = cleanDateStr(rawDate);
      if (!targetIso) return res.status(400).json({ error: 'Invalid date' });
    }

    let history = [];
    try {
      history = await loadQfHistory();
    } catch (qfErr) {
      console.error('Warning: could not read OperatorAllotmentQFvalues:', qfErr.message);
    }

    return res.status(200).json({ qfValue: pickQfValue(history, targetIso) });
  } catch (error) {
    console.error('getOperatorAllotmentQfValue:', error);
    return res.status(500).json({ error: 'Failed to fetch QF value' });
  }
};

// ============================================================
// GET OPERATOR ALLOTMENT BY DATE & LINE CODE
// ============================================================
const getOperatorAllotment = async (req, res) => {
  try {
    const { date, lineCode } = req.query;

    if (!date || !lineCode) {
      return res.status(400).json({ error: 'Date and Line Code are required' });
    }

    const cleanDate = cleanDateStr(date);
    if (!cleanDate) return res.status(400).json({ error: 'Invalid date' });

    const result = await sql.query`
      SELECT TOP 1 *
      FROM dbo.OperatorAllotmentSheet
      WHERE recordDate = CONVERT(date, ${cleanDate})
        AND lineCode = ${lineCode}
      ORDER BY id DESC
    `;

    if (result.recordset.length === 0) {
      return res.status(200).json({ exists: false, data: null });
    }

    const row = result.recordset[0];
    return res.status(200).json({
      exists: true,
      data: {
        ...row,
        status: isPendingSign(row.peStatus) ? 'Pending' : 'Approved'
      }
    });
  } catch (error) {
    console.error('getOperatorAllotment:', error);
    return res.status(500).json({ error: 'Failed to fetch record' });
  }
};

// ============================================================
// SAVE OPERATOR ALLOTMENT
// ============================================================
const saveOperatorAllotment = async (req, res) => {
  try {
    const {
      lineCode, recordDate, shift,
      oprNo1, oprNo2, oprNo3, oprNo4, oprNo5,
      proQty, incNo, productEngineer
    } = req.body || {};

    if (!lineCode) return res.status(400).json({ error: 'Line Code is required' });
    if (!recordDate) return res.status(400).json({ error: 'Date is required' });
    if (!shift) return res.status(400).json({ error: 'Shift is required' });
    if (!['1', '2', '3'].includes(String(shift))) return res.status(400).json({ error: 'Invalid Shift' });
    if (!productEngineer) return res.status(400).json({ error: 'Product Engineer is required' });

    const cleanDate = cleanDateStr(recordDate);
    if (!cleanDate) return res.status(400).json({ error: 'Invalid date' });

    // Product Engineer must really be a PE
    const peCheck = await sql.query`
      SELECT TOP 1 username
      FROM dbo.MachineShopUsers
      WHERE LOWER(LTRIM(RTRIM(username))) = LOWER(LTRIM(RTRIM(${productEngineer})))
        AND LOWER(LTRIM(RTRIM(role))) IN ('productengineer', 'productionengineer', 'pe')
    `;
    if (peCheck.recordset.length === 0) {
      return res.status(400).json({ error: 'Selected Product Engineer is invalid' });
    }

    // Single atomic UPDATE that refuses to touch approved rows (no check-then-update race)
    const updated = await sql.query`
      UPDATE dbo.OperatorAllotmentSheet
      SET
        shift = ${shift},
        oprNo1 = ${oprNo1 || null},
        oprNo2 = ${oprNo2 || null},
        oprNo3 = ${oprNo3 || null},
        oprNo4 = ${oprNo4 || null},
        oprNo5 = ${oprNo5 || null},
        proQty = ${proQty || null},
        incNo = ${incNo || null},
        productEngineer = ${productEngineer},
        peStatus = 'Pending',
        peSignature = NULL,
        peApprovedAt = NULL,
        updatedAt = GETDATE()
      WHERE lineCode = ${lineCode}
        AND recordDate = CONVERT(date, ${cleanDate})
        AND (peStatus IS NULL OR peStatus <> 'Approved')
    `;

    if (updated.rowsAffected[0] > 0) {
      return res.status(200).json({
        message: 'Operator Allotment updated successfully and submitted for Product Engineer verification',
        peStatus: 'Pending'
      });
    }

    // Nothing updated: either approved (locked) or does not exist yet
    const existing = await sql.query`
      SELECT TOP 1 id
      FROM dbo.OperatorAllotmentSheet
      WHERE lineCode = ${lineCode}
        AND recordDate = CONVERT(date, ${cleanDate})
    `;

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        error: 'This record has already been approved by Product Engineer and cannot be edited.'
      });
    }

    const result = await sql.query`
      INSERT INTO dbo.OperatorAllotmentSheet
      (
        lineCode, recordDate, shift,
        oprNo1, oprNo2, oprNo3, oprNo4, oprNo5,
        proQty, incNo, productEngineer,
        peStatus, createdAt, updatedAt
      )
      OUTPUT INSERTED.id
      VALUES
      (
        ${lineCode}, CONVERT(date, ${cleanDate}), ${shift},
        ${oprNo1 || null}, ${oprNo2 || null}, ${oprNo3 || null}, ${oprNo4 || null}, ${oprNo5 || null},
        ${proQty || null}, ${incNo || null}, ${productEngineer},
        'Pending', GETDATE(), GETDATE()
      )
    `;

    return res.status(201).json({
      message: 'Operator Allotment saved successfully and submitted to Product Engineer',
      id: result.recordset[0].id,
      peStatus: 'Pending'
    });
  } catch (error) {
    console.error('saveOperatorAllotment:', error);
    return res.status(500).json({ error: 'Failed to save Operator Allotment' });
  }
};

// ============================================================
// GET PENDING RECORDS FOR PRODUCT ENGINEER
// ============================================================
const getPendingPEOperatorAllotment = async (req, res) => {
  try {
    const { name } = req.params;
    const targetPE = name || req.query.peUsername;

    let result;
    if (targetPE && targetPE !== 'all') {
      result = await sql.query`
        SELECT id, lineCode, shift, productEngineer,
               FORMAT(recordDate, 'yyyy-MM-dd') AS recordDate,
               'Pending' AS status
        FROM dbo.OperatorAllotmentSheet
        WHERE (peStatus IS NULL OR peStatus = '' OR peStatus = 'Pending')
          AND LOWER(LTRIM(RTRIM(productEngineer))) = LOWER(LTRIM(RTRIM(${targetPE})))
        ORDER BY recordDate DESC, id DESC
      `;
    } else {
      result = await sql.query`
        SELECT id, lineCode, shift, productEngineer,
               FORMAT(recordDate, 'yyyy-MM-dd') AS recordDate,
               'Pending' AS status
        FROM dbo.OperatorAllotmentSheet
        WHERE (peStatus IS NULL OR peStatus = '' OR peStatus = 'Pending')
        ORDER BY recordDate DESC, id DESC
      `;
    }

    return res.status(200).json({ records: result.recordset || [] });
  } catch (error) {
    console.error('getPendingPEOperatorAllotment:', error);
    return res.status(500).json({ error: 'Failed to fetch pending Operator Allotments' });
  }
};

// ============================================================
// PRODUCT ENGINEER APPROVAL
// ============================================================
const signPEOperatorAllotment = async (req, res) => {
  try {
    const { id, peSignature } = req.body || {};

    if (!id) return res.status(400).json({ error: 'Record ID is required' });
    if (!peSignature) return res.status(400).json({ error: 'PE signature is required' });

    const approvedStr = `Approved (${String(peSignature).trim()})`;

    const result = await sql.query`
      UPDATE dbo.OperatorAllotmentSheet
      SET
        peSignature = ${approvedStr},
        peStatus = 'Approved',
        peApprovedAt = GETDATE(),
        updatedAt = GETDATE()
      WHERE id = ${id} AND (peStatus IS NULL OR peStatus = '' OR peStatus = 'Pending')
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Record not found or already approved' });
    }

    return res.status(200).json({
      success: true,
      message: 'Operator Allotment Sheet verified and approved successfully!',
      peStatus: 'Approved'
    });
  } catch (error) {
    console.error('signPEOperatorAllotment:', error);
    return res.status(500).json({ error: 'Failed to approve Operator Allotment' });
  }
};

// ============================================================
// GENERATE PDF REPORT (WITH DYNAMIC QF VALUES)
// ============================================================
const generateOperatorAllotmentReport = async (req, res) => {
  try {
    const { date, lineCode } = req.query;

    if (!date || !lineCode) {
      return res.status(400).json({ error: 'Date and Line Code are required.' });
    }

    const cleanDate = cleanDateStr(date);
    if (!cleanDate) return res.status(400).json({ error: 'Invalid date' });

    const result = await sql.query`
      SELECT TOP 1 *
      FROM dbo.OperatorAllotmentSheet
      WHERE recordDate = CONVERT(date, ${cleanDate})
        AND lineCode = ${lineCode}
      ORDER BY id DESC
    `;

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No Operator Allotment found for this date.' });
    }

    const row = result.recordset[0];
    const displayDate = formatDate(row.recordDate);

    let qfHistory = [];
    try {
      qfHistory = await loadQfHistory();
    } catch (qfErr) {
      console.error('Warning: Could not fetch OperatorAllotmentQFvalues:', qfErr.message);
    }
    const effectiveQf = pickQfValue(qfHistory, toIsoDay(row.recordDate) || cleanDate);

    const doc = new PDFDocument({
      margin: 20,
      size: 'A4',
      layout: 'landscape',
      bufferPages: true,
      autoPageBreak: false
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="Operator_Allotment_${safeFilePart(lineCode)}_${cleanDate}.pdf"`
    );

    doc.on('error', (err) => {
      console.error('PDF stream error:', err);
      if (!res.writableEnded) res.end();
    });

    doc.pipe(res);

    const startX = 20;
    const headerY = 20;
    const totalWidth = doc.page.width - 40;

    // ---------------- HEADER ----------------
    doc.lineWidth(1).strokeColor('black');
    doc.rect(startX, headerY, 100, 35).stroke();

    const logoPath = path.join(__dirname, 'logo.jpg');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, startX + 10, headerY + 5, { width: 80, height: 25 });
    } else {
      doc.font('Helvetica-Bold').fontSize(12).fillColor('black')
        .text('SAKTHI\nAUTO', startX, headerY + 8, { width: 100, align: 'center' });
    }

    doc.rect(startX + 100, headerY, totalWidth - 260, 35).stroke();
    doc.font('Helvetica-Bold').fontSize(13).fillColor('black')
      .text('OPERATOR ALLOTMENT SHEET', startX + 100, headerY + 12, {
        width: totalWidth - 260,
        align: 'center'
      });

    doc.rect(startX + totalWidth - 160, headerY, 160, 35).stroke();
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('black')
      .text(`LINE: ${row.lineCode || 'ALL'} | DATE: ${displayDate}`, startX + totalWidth - 158, headerY + 6, {
        width: 156,
        height: 10,
        ellipsis: true,
        align: 'center'
      });
    doc.font('Helvetica').fontSize(7).fillColor('black')
      .text(effectiveQf, startX + totalWidth - 158, headerY + 20, {
        width: 156,
        height: 10,
        ellipsis: true,
        align: 'center'
      });

    // ---------------- TABLE LAYOUT ----------------
    let curY = headerY + 45;
    const rowH = 22;
    const fontSize = 8;

    const drawCell = (x, y, w, h, text, isBold = false, bg = null, align = 'center') => {
      if (bg) doc.rect(x, y, w, h).fillAndStroke(bg, 'black');
      else doc.rect(x, y, w, h).stroke();

      doc.fillColor('black')
        .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(fontSize)
        .text(String(text != null ? text : '-'), x + 2, y + (h / 2 - 4), { width: w - 4, align });
    };

    doc.lineWidth(0.5).strokeColor('black');

    const fixedWidths = [70, 80, 80, 80, 80, 80, 80, 80];
    // last column takes the remaining width so the table spans the full header width
    const widths = [...fixedWidths, totalWidth - fixedWidths.reduce((a, b) => a + b, 0)];
    const headers = ['SHIFT', 'OPR NO 1', 'OPR NO 2', 'OPR NO 3', 'OPR NO 4', 'OPR NO 5', 'PRO QTY', 'INC NO', 'PRODUCT ENGINEER'];
    const values = [
      `SHIFT ${row.shift}`,
      row.oprNo1 || '-',
      row.oprNo2 || '-',
      row.oprNo3 || '-',
      row.oprNo4 || '-',
      row.oprNo5 || '-',
      row.proQty || '-',
      row.incNo || '-',
      row.productEngineer || '-'
    ];

    let currentX = startX;
    headers.forEach((header, idx) => {
      drawCell(currentX, curY, widths[idx], rowH, header, true, '#f0f0f0');
      currentX += widths[idx];
    });

    curY += rowH;
    currentX = startX;
    values.forEach((val, idx) => {
      drawCell(currentX, curY, widths[idx], rowH * 1.5, val, false, '#ffffff');
      currentX += widths[idx];
    });

    curY += rowH * 1.5 + 15;

    // ---------------- SECTION INCHARGE (PE) SIGN ----------------
    const peH = rowH * 2.5;
    const descW = 200;
    const colW = totalWidth - descW;

    drawCell(startX, curY, descW, peH, 'SECTION INCHARGE (PE) SIGN', true, '#f3f4f6', 'left');

    doc.rect(startX + descW, curY, colW, peH).stroke();
    const sig = row.peSignature || '';

    if (sig && !isPendingSign(sig)) {
      const m = String(sig).match(/^Approved \(([\s\S]*)\)$/);
      const name = (m ? m[1] : String(sig)).trim();
      doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(9)
        .text('APPROVED', startX + descW + 10, curY + 10, { width: colW - 20, align: 'left' });
      doc.fillColor('black').font('Helvetica-Bold').fontSize(8.5)
        .text(`ENGINEER: ${name.toUpperCase()}`, startX + descW + 10, curY + 24, { width: colW - 20, align: 'left' });
    } else {
      doc.fillColor('#dc2626').font('Helvetica-Bold').fontSize(9)
        .text('PENDING', startX + descW + 10, curY + 10, { width: colW - 20, align: 'left' });
      doc.fillColor('black').font('Helvetica').fontSize(8.5)
        .text(`ASSIGNED PE: ${row.productEngineer ? String(row.productEngineer).toUpperCase() : 'N/A'}`, startX + descW + 10, curY + 24, { width: colW - 20, align: 'left' });
    }

    doc.end();
  } catch (error) {
    console.error('generateOperatorAllotmentReport:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to generate PDF' });
    }
    if (!res.writableEnded) res.end(); // don't leave a half-sent PDF hanging
  }
};

module.exports = {
  getOperatorAllotmentLines,
  getProductManagers,
  getOperatorAllotmentQfValue,
  getOperatorAllotment,
  saveOperatorAllotment,
  getPendingPEOperatorAllotment,
  signPEOperatorAllotment,
  generateOperatorAllotmentReport
};