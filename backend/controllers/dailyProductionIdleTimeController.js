const sql = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const TABLE = 'DailyProductionIdleTimeReport';
const SHIFT_NUMS = [1, 2, 3];
const LOSS_IDS = Array.from({ length: 13 }, (_, i) => i + 1);

const LOSS_REASONS = [
  { id: 1, category: 'MAN', name: 'Want of Man power' },
  { id: 2, category: 'MAN', name: 'Efficiency' },
  { id: 3, category: 'MACHINE', name: 'M/c Breakdown' },
  { id: 4, category: 'MACHINE', name: 'Preventive maintenance' },
  { id: 5, category: 'MATERIAL', name: 'Want of load' },
  { id: 6, category: 'MATERIAL', name: 'Want of cutting tool' },
  { id: 7, category: 'MATERIAL', name: 'Want of jig & fig' },
  { id: 8, category: 'METHOD', name: 'Process correction' },
  { id: 9, category: 'METHOD', name: 'Casting Adjustment' },
  { id: 10, category: 'MEASUREMENT', name: 'Want of inspection Delay' },
  { id: 11, category: 'OTHERS', name: 'Tool change' },
  { id: 12, category: 'OTHERS', name: 'Want of Power' },
  { id: 13, category: 'OTHERS', name: 'Want of schedule' }
];

// ============================================================
// SMALL HELPERS
// ============================================================
const cleanDateStr = (date) => {
  if (!date) return null;
  let d = String(date);
  if (d.includes('/')) {
    const p = d.split('/');
    if (p.length === 3) d = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  } else if (d.includes('T')) {
    d = d.split('T')[0];
  }
  return d;
};

const toInt = (v) => {
  if (v === '' || v == null) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
};

const toFloat = (v) => {
  if (v === '' || v == null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
};

const num = (v) => parseFloat(v) || 0;

const validShopId = (shopId) => {
  const n = parseInt(shopId, 10);
  return !isNaN(n) && n >= 1 && n <= 5 ? n : null;
};

const isPendingSign = (s) => !s || String(s).trim() === '' || String(s).startsWith('Pending');

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

// ============================================================
// HELPER: PART TRACEABILITY CODE
// ============================================================
const generatePartTraceability = async (transaction, lineCode, checkDate, shift) => {
  if (!lineCode || !checkDate) return '';

  const lineMatch = String(lineCode).match(/(\d+)([A-Za-z]*)$/);
  if (!lineMatch) return '';

  const lineIdentifier = `${parseInt(lineMatch[1], 10)}${lineMatch[2] ? lineMatch[2].toUpperCase() : ''}`;
  const shiftMap = { I: 1, II: 2, III: 3, '1': 1, '2': 2, '3': 3 };
  const shiftNumber = shiftMap[String(shift || 'I').trim().toUpperCase()] || 1;

  let year, month, day;
  if (typeof checkDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(checkDate)) {
    const parts = checkDate.split('T')[0].split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    const d = new Date(checkDate);
    if (isNaN(d.getTime())) return '';
    year = d.getFullYear();
    month = d.getMonth() + 1;
    day = d.getDate();
  }

  const request = transaction.request();
  request.input('yearValue', sql.Int, year);
  request.input('monthValue', sql.Int, month);
  request.input('dayValue', sql.Int, day);
  request.input('shiftValue', sql.Int, shiftNumber);

  const result = await request.query(`
    SELECT
      (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'YEAR'  AND SourceValue = @yearValue)  AS yearCode,
      (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'MONTH' AND SourceValue = @monthValue) AS monthCode,
      (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'DAY'   AND SourceValue = @dayValue)   AS dayCode,
      (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'SHIFT' AND SourceValue = @shiftValue) AS shiftCode
  `);

  const m = result.recordset[0];
  if (!m || !m.yearCode || !m.monthCode || !m.dayCode || !m.shiftCode) return '';
  return `${m.yearCode}${m.monthCode}${m.dayCode}${m.shiftCode}-${lineIdentifier}`;
};

// ============================================================
// 1. GET PART TRACEABILITY
// ============================================================
const getPartTraceability = async (req, res) => {
  const { lineCode, date, shift } = req.query;
  if (!lineCode || !date) {
    return res.status(400).json({ error: 'lineCode and date are required' });
  }

  const transaction = new sql.Transaction();
  try {
    await transaction.begin();
    const partTraceability = await generatePartTraceability(transaction, lineCode, date, shift || 'I');
    await transaction.commit();
    return res.status(200).json({ partTraceability: partTraceability || '' });
  } catch (err) {
    console.error('Error generating Part Traceability:', err);
    try { await transaction.rollback(); } catch (e) { }
    return res.status(500).json({ error: 'Failed to generate Part Traceability' });
  }
};

// ============================================================
// 2. GET PE USERS (dropdown for Section Incharge / PE)
// ============================================================
const getPEUsers = async (req, res) => {
  try {
    const peRes = await sql.query`
      SELECT username AS name, username, employeeId
      FROM dbo.MachineShopUsers
      WHERE LOWER(role) IN ('productengineer', 'productionengineer', 'pe')
      ORDER BY username ASC
    `;
    return res.status(200).json({ peList: peRes.recordset || [] });
  } catch (err) {
    console.error('Error fetching PE users:', err);
    return res.status(500).json({ error: 'Failed to fetch PE list' });
  }
};

// ============================================================
// 3. GET MACHINE SHOP DETAILS
// ============================================================
const getMachineShopDetails = async (req, res) => {
  const { shopId } = req.params;
  try {
    const parsedShopId = validShopId(shopId);
    if (!parsedShopId) return res.status(400).json({ error: 'Invalid machine shop ID' });

    const result = await sql.query(`
      SELECT id, lineCode, partName, partNo, machineNo, machineType
      FROM MachineShop${parsedShopId}Details
      ORDER BY lineCode, partName
    `);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error(`Error fetching Machine Shop ${shopId} details:`, err);
    res.status(500).json({ error: `Failed to fetch Machine Shop ${shopId} details` });
  }
};

// ============================================================
// 4. GET PART QUANTITIES (capacity set by HOD / HOF)
// ============================================================
const getPartQuantities = async (req, res) => {
  const { shopId } = req.params;
  try {
    const parsedShopId = validShopId(shopId);
    if (!parsedShopId) return res.status(400).json({ error: 'Invalid machine shop ID' });

    const result = await sql.query(`
      SELECT partName, shift1Quantity, shift2Quantity, shift3Quantity
      FROM MachineShop${parsedShopId}PartQty
    `);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error(`Error fetching part quantities for shop ${shopId}:`, err);
    res.status(500).json({ error: 'Failed to fetch part quantities' });
  }
};

// ============================================================
// 5. GET SAVED REPORT (shopId + date [+ lineCode])
// ============================================================
const rowToColumn = (r) => {
  const s = (v) => (v != null ? String(v) : '');

  const losses = {};
  LOSS_IDS.forEach((i) => {
    losses[`loss_${i}`] = {
      shift1: s(r[`Loss${i}_Shift1`]),
      shift2: s(r[`Loss${i}_Shift2`]),
      shift3: s(r[`Loss${i}_Shift3`])
    };
  });

  return {
    lineCode: r.LineCode || '',
    partName: r.PartName || '',
    brakeType: r.BrakeType || '',
    capacity: {
      shift1: s(r.Capacity_Shift1),
      shift2: s(r.Capacity_Shift2),
      shift3: s(r.Capacity_Shift3)
    },
    actualProd: {
      lh: {
        shift1: s(r.ActualProd_LH_Shift1),
        shift2: s(r.ActualProd_LH_Shift2),
        shift3: s(r.ActualProd_LH_Shift3)
      },
      rh: {
        shift1: s(r.ActualProd_RH_Shift1),
        shift2: s(r.ActualProd_RH_Shift2),
        shift3: s(r.ActualProd_RH_Shift3)
      }
    },
    manpower: {
      shift1: s(r.Manpower_Shift1),
      shift2: s(r.Manpower_Shift2),
      shift3: s(r.Manpower_Shift3)
    },
    losses,
    signatures: {
      shift1: r.ShiftInchargeSign_Shift1 || '',
      shift2: r.ShiftInchargeSign_Shift2 || '',
      shift3: r.ShiftInchargeSign_Shift3 || ''
    },
    assignedPe: r.assignedPe || '',
    peSign: r.Sign_ProductionEngineer || 'Pending',
    status: isPendingSign(r.Sign_ProductionEngineer) ? 'Pending' : 'Completed'
  };
};

const getDailyProductionIdleTime = async (req, res) => {
  try {
    const { shopId, date, lineCode } = req.query;
    const parsedShopId = validShopId(shopId);

    if (!parsedShopId || !date) {
      return res.status(400).json({ error: 'shopId and date are required' });
    }

    const request = new sql.Request();
    request.input('machineShop', sql.Int, parsedShopId);
    request.input('reportDate', sql.NVarChar(50), cleanDateStr(date));

    let query = `
      SELECT * FROM ${TABLE}
      WHERE MachineShop = @machineShop
        AND ReportDate = CONVERT(date, @reportDate)
    `;

    if (lineCode) {
      request.input('lineCode', sql.NVarChar(50), lineCode);
      query += ' AND LineCode = @lineCode';
    }
    query += ' ORDER BY Id ASC';

    const result = await request.query(query);
    const rows = result.recordset || [];

    if (rows.length === 0) {
      return res.status(200).json({ exists: false, lineColumns: [] });
    }

    return res.status(200).json({
      exists: true,
      lineColumns: rows.map(rowToColumn)
    });
  } catch (err) {
    console.error('Error fetching daily production idle time report:', err);
    return res.status(500).json({ error: 'Failed to fetch report data' });
  }
};

// ============================================================
// 6. SAVE REPORT (Shift Incharge submit)
// ============================================================
const shiftHasData = (col, n) => {
  const k = `shift${n}`;
  const has = (v) => v !== '' && v != null;
  if (has(col.actualProd?.lh?.[k]) || has(col.actualProd?.rh?.[k]) || has(col.manpower?.[k])) return true;
  return LOSS_IDS.some((i) => has(col.losses?.[`loss_${i}`]?.[k]));
};

const saveDailyProductionIdleTime = async (req, res) => {
  const { machineShop, date, lineColumns } = req.body;
  let transaction;

  try {
    const shopId = validShopId(machineShop);
    const reportDate = cleanDateStr(date);

    if (!shopId) return res.status(400).json({ error: 'Machine shop is required' });
    if (!reportDate) return res.status(400).json({ error: 'Report date is required' });
    if (!Array.isArray(lineColumns) || lineColumns.length === 0) {
      return res.status(400).json({ error: 'At least one line column is required' });
    }

    transaction = new sql.Transaction();
    await transaction.begin();

    const savedLines = [];
    const skippedLines = [];

    for (const col of lineColumns) {
      const lineCode = String(col.lineCode || '').trim();
      const partName = String(col.partName || '').trim();
      const assignedPe = String(col.assignedPe || '').trim();

      if (!lineCode) throw httpError(400, 'Line code is required');
      if (!partName) throw httpError(400, `Part name could not be resolved for line ${lineCode}`);
      if (!assignedPe) throw httpError(400, `Select a Product Engineer for line ${lineCode}`);

      // Existing data for this date + line is immutable
      const existReq = new sql.Request(transaction);
      existReq.input('m', sql.Int, shopId);
      existReq.input('d', sql.NVarChar(50), reportDate);
      existReq.input('l', sql.NVarChar(50), lineCode);
      const exist = await existReq.query(`
        SELECT COUNT(*) AS cnt FROM ${TABLE}
        WHERE MachineShop = @m AND ReportDate = CONVERT(date, @d) AND LineCode = @l
      `);
      if (exist.recordset[0].cnt > 0) {
        skippedLines.push(lineCode);
        continue;
      }

      // Capacity comes from the line mapping set by HOD/HOF (sent by the form, read-only there)
      const capacity = {
        shift1: toInt(col.capacity?.shift1),
        shift2: toInt(col.capacity?.shift2),
        shift3: toInt(col.capacity?.shift3)
      };

      const signatures = col.signatures || {};
      let anyData = false;

      for (const n of SHIFT_NUMS) {
        const k = `shift${n}`;
        const cap = num(capacity[k]);
        const has = shiftHasData(col, n);
        const sign = String(signatures[k] || '').trim();

        if (has) {
          anyData = true;
          if (!(cap > 0)) throw httpError(400, `Line ${lineCode} Shift ${n}: capacity is not set`);
          if (num(col.actualProd?.lh?.[k]) > cap || num(col.actualProd?.rh?.[k]) > cap) {
            throw httpError(400, `Line ${lineCode} Shift ${n}: actual production cannot exceed capacity (${cap})`);
          }
          const lossSum = LOSS_IDS.reduce((a, i) => a + num(col.losses?.[`loss_${i}`]?.[k]), 0);
          if (lossSum > cap) {
            throw httpError(400, `Line ${lineCode} Shift ${n}: total losses (${lossSum}) cannot exceed capacity (${cap})`);
          }
          if (!sign) throw httpError(400, `Line ${lineCode} Shift ${n}: shift officer approval is required`);
        }
      }
      if (!anyData) throw httpError(400, `Line ${lineCode}: no production / loss data entered`);

      // Build the INSERT
      const f = [];
      const add = (name, type, val) => f.push({ name, type, val });

      add('MachineShop', sql.Int, shopId);
      add('ReportDate', sql.NVarChar(50), reportDate);
      add('LineCode', sql.NVarChar(50), lineCode);
      add('PartName', sql.NVarChar(100), partName);
      add('BrakeType', sql.NVarChar(20), col.brakeType || '');
      add(
        'partTraceabilityMachining',
        sql.NVarChar(100),
        await generatePartTraceability(transaction, lineCode, reportDate, 'I')
      );

      SHIFT_NUMS.forEach((n) => {
        const k = `shift${n}`;
        add(`Capacity_Shift${n}`, sql.Int, toInt(capacity[k]));
        add(`ActualProd_LH_Shift${n}`, sql.Int, toInt(col.actualProd?.lh?.[k]));
        add(`ActualProd_RH_Shift${n}`, sql.Int, toInt(col.actualProd?.rh?.[k]));
        add(`Manpower_Shift${n}`, sql.Int, toInt(col.manpower?.[k]));
      });

      LOSS_IDS.forEach((i) => {
        SHIFT_NUMS.forEach((n) => {
          add(`Loss${i}_Shift${n}`, sql.Float, toFloat(col.losses?.[`loss_${i}`]?.[`shift${n}`]));
        });
      });

      SHIFT_NUMS.forEach((n) => {
        add(`ShiftInchargeSign_Shift${n}`, sql.NVarChar(100), String(signatures[`shift${n}`] || '').trim());
      });

      add('assignedPe', sql.NVarChar(100), assignedPe);
      add('Sign_ProductionEngineer', sql.NVarChar(100), 'Pending');

      const insReq = new sql.Request(transaction);
      f.forEach((x) => insReq.input(x.name, x.type, x.val));

      await insReq.query(`
        INSERT INTO ${TABLE} (${f.map((x) => x.name).join(', ')})
        VALUES (${f.map((x) => (x.name === 'ReportDate' ? 'CONVERT(date, @ReportDate)' : '@' + x.name)).join(', ')})
      `);

      savedLines.push(lineCode);
    }

    if (savedLines.length === 0) {
      await transaction.rollback();
      return res.status(409).json({
        error: 'Data already exists for the selected date and line code and cannot be changed.',
        skippedLines
      });
    }

    await transaction.commit();

    return res.status(201).json({
      message: 'Daily Production & Idle Time Report saved successfully',
      savedLines,
      skippedLines
    });
  } catch (err) {
    console.error('Error saving Idle Time Report:', err);
    if (transaction) {
      try { await transaction.rollback(); } catch (e) { }
    }
    return res.status(err.status || 500).json({
      error: err.status ? err.message : 'Failed to save Idle Time Report'
    });
  }
};

// ============================================================
// 7. GET PENDING REPORTS FOR A PRODUCT ENGINEER
// ============================================================
const getPendingPEIdleTimeData = async (req, res) => {
  try {
    const { name } = req.params;
    const shopId = validShopId(req.query.shopId);

    const request = new sql.Request();
    request.input('peName', sql.NVarChar(100), String(name || '').trim());

    let shopFilter = '';
    if (shopId) {
      request.input('machineShop', sql.Int, shopId);
      shopFilter = ' AND MachineShop = @machineShop';
    }

    const result = await request.query(`
      SELECT
        Id AS id,
        MachineShop AS machineShop,
        LineCode AS lineCode,
        PartName AS partName,
        FORMAT(ReportDate, 'yyyy-MM-dd') AS reportDate,
        COALESCE(
          NULLIF(ShiftInchargeSign_Shift1, ''),
          NULLIF(ShiftInchargeSign_Shift2, ''),
          NULLIF(ShiftInchargeSign_Shift3, '')
        ) AS submittedBy,
        'Pending' AS status
      FROM ${TABLE}
      WHERE LOWER(assignedPe) = LOWER(@peName)
        AND (
          Sign_ProductionEngineer IS NULL
          OR Sign_ProductionEngineer = ''
          OR Sign_ProductionEngineer LIKE 'Pending%'
        )
        ${shopFilter}
      ORDER BY ReportDate DESC, Id DESC
    `);

    return res.status(200).json(result.recordset);
  } catch (err) {
    console.error('Error fetching pending PE idle time data:', err);
    return res.status(500).json({ error: 'Failed to fetch pending PE idle time data' });
  }
};

// ============================================================
// 8. PE SIGN AND APPROVE
// ============================================================
const signPEApproval = async (req, res) => {
  try {
    const { lineCode, date, machineShop, signature, peUsername } = req.body;
    const signVal = String(signature || peUsername || '').trim();

    if (!date || !lineCode || !signVal) {
      return res.status(400).json({ error: 'lineCode, date and signature are required' });
    }

    const request = new sql.Request();
    request.input('checkDate', sql.NVarChar(50), cleanDateStr(date));
    request.input('lineCode', sql.NVarChar(50), lineCode);
    request.input('signature', sql.NVarChar(100), signVal);
    request.input('approvedStr', sql.NVarChar(100), `Approved (${signVal})`);

    let shopFilter = '';
    const shopId = validShopId(machineShop);
    if (shopId) {
      request.input('machineShop', sql.Int, shopId);
      shopFilter = ' AND MachineShop = @machineShop';
    }

    // Only the PE the shift incharge assigned can approve
    const result = await request.query(`
      UPDATE ${TABLE}
      SET Sign_ProductionEngineer = @approvedStr
      WHERE ReportDate = CONVERT(date, @checkDate)
        AND LineCode = @lineCode
        AND LOWER(assignedPe) = LOWER(@signature)
        AND (
          Sign_ProductionEngineer IS NULL
          OR Sign_ProductionEngineer = ''
          OR Sign_ProductionEngineer LIKE 'Pending%'
        )
        ${shopFilter}
    `);

    if (!result.rowsAffected[0]) {
      return res.status(404).json({ error: 'No pending records found for your assignment' });
    }

    return res.status(200).json({
      success: true,
      message: 'Daily Production & Idle Time Report approved by PE successfully!'
    });
  } catch (err) {
    console.error('Error approving Idle Time Report:', err);
    return res.status(500).json({ error: 'Failed to sign and approve report' });
  }
};

// ============================================================
// 9. PDF REPORT
// ============================================================
const generateIdleTimeReport = async (req, res) => {
  try {
    const { shopId, date, lineCode } = req.query;
    if (!date) return res.status(400).send('Date is required.');

    const cleanDate = cleanDateStr(date);

    const request = new sql.Request();
    request.input('reportDate', sql.NVarChar(50), cleanDate);

    let query = `SELECT * FROM ${TABLE} WHERE ReportDate = CONVERT(date, @reportDate)`;

    const parsedShop = validShopId(shopId);
    if (parsedShop) {
      request.input('machineShop', sql.Int, parsedShop);
      query += ' AND MachineShop = @machineShop';
    }
    if (lineCode) {
      request.input('lineCode', sql.NVarChar(50), lineCode);
      query += ' AND LineCode = @lineCode';
    }
    query += ' ORDER BY LineCode ASC, Id ASC';

    const result = await request.query(query);
    const records = result.recordset || [];

    if (records.length === 0) {
      return res.status(404).send('No records found for the selected parameters.');
    }

    const first = records[0];
    const [yy, mm, dd] = String(cleanDate).split('-');
    const displayDate = `${dd}/${mm}/${yy}`;

    const doc = new PDFDocument({
      margin: 20,
      size: 'A4',
      layout: 'landscape',
      bufferPages: true,
      autoPageBreak: false
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Daily_Production_Idle_Time_${cleanDate}.pdf`);
    doc.pipe(res);

    const startX = 20;
    const headerY = 20;
    const totalWidth = doc.page.width - 40;
    const pageBottom = doc.page.height - 20;

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
      .text('DAILY PRODUCTION & IDLE TIME REPORT (MACHINE SHOP)', startX + 100, headerY + 12, {
        width: totalWidth - 260,
        align: 'center'
      });

    const distinctLines = [...new Set(records.map((r) => r.LineCode).filter(Boolean))].join(', ');

    doc.rect(startX + totalWidth - 160, headerY, 160, 35).stroke();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('black')
      .text(`LINE: ${distinctLines || 'ALL'}`, startX + totalWidth - 160, headerY + 6, {
        width: 160,
        align: 'center'
      });
    doc.font('Helvetica').fontSize(8).fillColor('black')
      .text(`DATE: ${displayDate} | MS: ${shopId || first.MachineShop || 3}`, startX + totalWidth - 160, headerY + 20, {
        width: 160,
        align: 'center'
      });

    // ---------------- LAYOUT ----------------
    let curY = headerY + 42;
    const numCols = records.length;
    const colW = Math.min(130, (totalWidth - 150) / Math.max(1, numCols));
    const descW = totalWidth - colW * numCols;
    const shiftW = colW / 4;
    const rowH = 11.5;
    const fontSize = 6.8;

    const drawCell = (x, y, w, h, text, isBold = false, bg = null, align = 'center') => {
      if (bg) doc.rect(x, y, w, h).fillAndStroke(bg, 'black');
      else doc.rect(x, y, w, h).stroke();

      doc.fillColor('black')
        .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(fontSize)
        .text(String(text != null ? text : '-'), x + 2, y + 2.5, { width: w - 4, align });
    };

    doc.lineWidth(0.5).strokeColor('black');

    const colX = (idx) => startX + descW + idx * colW;

    // ---------------- TABLE HEADERS ----------------
    drawCell(startX, curY, descW, rowH, 'LINE CODE', true, '#f0f0f0', 'left');
    records.forEach((rec, idx) => drawCell(colX(idx), curY, colW, rowH, rec.LineCode || '-', true, '#f0f0f0'));
    curY += rowH;

    drawCell(startX, curY, descW, rowH, 'PART NAME', true, '#ffffff', 'left');
    records.forEach((rec, idx) => drawCell(colX(idx), curY, colW, rowH, rec.PartName || '-', false, '#ffffff'));
    curY += rowH;

    drawCell(startX, curY, descW, rowH, 'ABS / NABS', true, '#ffffff', 'left');
    records.forEach((rec, idx) => drawCell(colX(idx), curY, colW, rowH, rec.BrakeType || '-', false, '#ffffff'));
    curY += rowH;

    drawCell(startX, curY, descW, rowH, 'SHIFT DETAILS / PARAMETERS', true, '#f0f0f0', 'left');
    records.forEach((rec, idx) => {
      ['I', 'II', 'III', 'T'].forEach((sh, shIdx) => {
        drawCell(colX(idx) + shIdx * shiftW, curY, shiftW, rowH, sh, true, sh === 'T' ? '#e5e7eb' : '#f9fafb');
      });
    });
    curY += rowH;

    // ---------------- DATA ROW HELPER ----------------
    const drawShiftDataRow = (title, getVals, isBold = false, bgColor = '#ffffff') => {
      drawCell(startX, curY, descW, rowH, title, isBold, bgColor, 'left');

      records.forEach((rec, idx) => {
        const vals = getVals(rec).map((v) => (v != null && v !== '' ? parseFloat(v) : 0));
        const total = vals[0] + vals[1] + vals[2];

        [vals[0], vals[1], vals[2], total].forEach((val, shIdx) => {
          drawCell(
            colX(idx) + shIdx * shiftW,
            curY,
            shiftW,
            rowH,
            val !== 0 ? String(val) : '-',
            isBold || shIdx === 3,
            shIdx === 3 ? '#e5e7eb' : bgColor
          );
        });
      });

      curY += rowH;
    };

    drawShiftDataRow('CAPACITY QTY IN SETS', (r) => [r.Capacity_Shift1, r.Capacity_Shift2, r.Capacity_Shift3], true, '#f3f4f6');
    drawShiftDataRow('ACTUAL PROD QTY (LH)', (r) => [r.ActualProd_LH_Shift1, r.ActualProd_LH_Shift2, r.ActualProd_LH_Shift3]);
    drawShiftDataRow('ACTUAL PROD QTY (RH)', (r) => [r.ActualProd_RH_Shift1, r.ActualProd_RH_Shift2, r.ActualProd_RH_Shift3]);
    drawShiftDataRow('NO OF MANPOWER (UTILIZED)', (r) => [r.Manpower_Shift1, r.Manpower_Shift2, r.Manpower_Shift3], false, '#f9fafb');

    LOSS_REASONS.forEach((loss) => {
      drawShiftDataRow(
        `${loss.id}. [${loss.category}] ${loss.name}`,
        (r) => [r[`Loss${loss.id}_Shift1`], r[`Loss${loss.id}_Shift2`], r[`Loss${loss.id}_Shift3`]]
      );
    });

    const calcTotalLossRec = (r, shift) =>
      LOSS_IDS.reduce((sum, i) => sum + (r[`Loss${i}_Shift${shift}`] || 0), 0);

    drawShiftDataRow(
      'TOTAL LOSS (MINS)',
      (r) => [calcTotalLossRec(r, 1), calcTotalLossRec(r, 2), calcTotalLossRec(r, 3)],
      true,
      '#e5e7eb'
    );

    // ---------------- SIGNATURE ROWS ----------------
    // Shift officer (approved by the shift incharge, per shift)
    const signH = rowH * 3;
    drawCell(startX, curY, descW, signH, 'SHIFT OFFICER SIGN (APPROVED BY SHIFT INCHARGE)', true, '#f3f4f6', 'left');
    records.forEach((rec, idx) => {
      const x = colX(idx);
      doc.rect(x, curY, colW, signH).stroke();
      [
        ['I', rec.ShiftInchargeSign_Shift1],
        ['II', rec.ShiftInchargeSign_Shift2],
        ['III', rec.ShiftInchargeSign_Shift3]
      ].forEach(([label, v], i) => {
        doc.fillColor(v ? '#16a34a' : '#6b7280')
          .font('Helvetica-Bold')
          .fontSize(6)
          .text(`${label}: ${v ? String(v).toUpperCase() : '-'}`, x + 3, curY + 3.5 + i * rowH, {
            width: colW - 6,
            lineBreak: false
          });
      });
    });
    curY += signH;

    // PE
    const peH = rowH * 2;
    drawCell(startX, curY, descW, peH, 'SECTION INCHARGE (PE) SIGN', true, '#f3f4f6', 'left');
    records.forEach((rec, idx) => {
      const x = colX(idx);
      doc.rect(x, curY, colW, peH).stroke();

      const sig = rec.Sign_ProductionEngineer || '';
      if (sig && !isPendingSign(sig)) {
        const name = String(sig).replace('Approved (', '').replace(')', '').trim();
        doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(6.5)
          .text('APPROVED', x + 3, curY + 3, { width: colW - 6, align: 'center', lineBreak: false });
        doc.fillColor('black').font('Helvetica-Bold').fontSize(6.5)
          .text(name.toUpperCase(), x + 3, curY + 12, { width: colW - 6, align: 'center', lineBreak: false });
      } else {
        doc.fillColor('#dc2626').font('Helvetica-Bold').fontSize(6.5)
          .text('PENDING', x + 3, curY + 3, { width: colW - 6, align: 'center', lineBreak: false });
        doc.fillColor('black').font('Helvetica').fontSize(6.5)
          .text(rec.assignedPe ? `[${String(rec.assignedPe).toUpperCase()}]` : '', x + 3, curY + 12, {
            width: colW - 6,
            align: 'center',
            lineBreak: false
          });
      }
    });
    curY += peH + 8;

    // ---------------- NOTES ----------------
    if (curY + 30 > pageBottom) {
      doc.addPage();
      curY = 30;
    }

    doc.lineWidth(0.5).strokeColor('black');
    doc.rect(startX, curY, totalWidth, 24).stroke();
    doc.fillColor('black').font('Helvetica-Bold').fontSize(7)
      .text('Notes / Instructions:', startX + 5, curY + 3);
    doc.font('Helvetica').fontSize(6.5)
      .text('1. TOOL CHANGE LOSSES TIME ABOVE 20 MINS ONLY MENTION THE LOSS.', startX + 5, curY + 10);
    doc.font('Helvetica').fontSize(6.5)
      .text('2. During set-up change, the production and idle time parameters should be verified and recorded.', startX + 5, curY + 16);

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'PDF generation failed' });
    } else {
      res.end();
    }
  }
};

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  getMachineShopDetails,
  getPartQuantities,
  getPEUsers,
  getPartTraceability,
  getDailyProductionIdleTime,
  saveDailyProductionIdleTime,
  getPendingPEIdleTimeData,
  signPEApproval,
  generateIdleTimeReport
};