const sql = require('../db');
const PDFDocument = require("pdfkit");
const fs = require('fs');
const path = require('path');

const VALID_ACTUAL = ['COMPLETED', 'NOT COMPLETED'];

// ---------- helpers ----------
const normalizeActual = (v) => {
  const s = String(v || '').trim().toUpperCase();
  return VALID_ACTUAL.includes(s) ? s : null;
};

// "2026-10-12T09:30" -> "2026-10-12T09:30:00" (kept as string to avoid timezone shifts)
const toSqlDateTime = (v) => {
  const m = String(v || '').trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  return m ? `${m[1]}T${m[2]}:00` : null;
};

const toSqlDate = (v) => {
  const m = String(v || '').match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
};

// "2026-10-12T09:30" -> "12/10/2026 09:30"
const displayDateTime = (v) => {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '-';
};

const displayDate = (v) => {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '-';
};

// ============================================================
// 1. GET EMPLOYEE PLANS (all saved slots, ordered by planNo)
// ============================================================
const getEmployeePlans = async (req, res) => {
  const { machineShop, empNo } = req.query;

  if (!machineShop || !empNo || !String(empNo).trim()) {
    return res.status(400).json({ error: 'machineShop and empNo are required' });
  }

  try {
    const request = new sql.Request();
    request.input('machineShop', sql.Int, parseInt(machineShop, 10));
    request.input('empNo', sql.NVarChar(50), String(empNo).trim());

    const result = await request.query(`
      SELECT
        planNo,
        empName,
        CONVERT(VARCHAR(10), doj, 23) AS doj,
        CONVERT(VARCHAR(16), planDateTime, 126) AS planDateTime,
        actualStatus
      FROM OperatorObservationPlan
      WHERE machineShop = @machineShop AND empNo = @empNo
      ORDER BY planNo ASC
    `);

    const records = result.recordset;
    if (records.length === 0) {
      return res.status(200).json({ found: false, plans: [] });
    }

    return res.status(200).json({
      found: true,
      empNo: String(empNo).trim(),
      empName: records[0].empName,
      doj: records[0].doj,
      plans: records.map((r) => ({
        planNo: r.planNo,
        planDateTime: r.planDateTime,
        actualStatus: r.actualStatus || '',
      })),
    });
  } catch (err) {
    console.error('Error fetching employee plans:', err);
    return res.status(500).json({ error: 'Failed to fetch employee plans' });
  }
};

// ============================================================
// 2. SAVE OPERATOR OBSERVATION PLAN
// ============================================================
const saveOperatorObservationPlan = async (req, res) => {
  const { machineShop, rows, signature } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No rows to save' });
  }
  if (!signature) {
    return res.status(400).json({ error: 'Shift incharge approval is required' });
  }

  const shop = parseInt(machineShop, 10) || 3;

  // Validate payload + reject duplicate empNo in a single submission
  const seenEmp = new Set();
  for (const row of rows) {
    const empNo = String(row.empNo || '').trim();
    if (!empNo || !String(row.empName || '').trim() || !toSqlDate(row.doj)) {
      return res.status(400).json({ error: 'Name, Emp No and DOJ are required for every row' });
    }
    if (seenEmp.has(empNo.toLowerCase())) {
      return res.status(400).json({ error: `Duplicate Emp No in the form: ${empNo}` });
    }
    seenEmp.add(empNo.toLowerCase());
  }

  let transaction;
  try {
    transaction = new sql.Transaction();
    await transaction.begin();

    for (const row of rows) {
      const empNo = String(row.empNo).trim();
      const empName = String(row.empName).trim();
      const doj = toSqlDate(row.doj);
      const plans = Array.isArray(row.plans) ? row.plans : [];

      for (const plan of plans) {
        const planDateTime = toSqlDateTime(plan.planDateTime);
        const planNo = parseInt(plan.planNo, 10);
        if (!planDateTime || !planNo) continue;

        const actual = normalizeActual(plan.actualStatus);

        const existing = await transaction.request()
          .input('machineShop', sql.Int, shop)
          .input('empNo', sql.NVarChar(50), empNo)
          .input('planNo', sql.Int, planNo)
          .query(`
            SELECT id, actualStatus
            FROM OperatorObservationPlan
            WHERE machineShop = @machineShop AND empNo = @empNo AND planNo = @planNo
          `);

        if (existing.recordset.length === 0) {
          // New plan slot
          await transaction.request()
            .input('machineShop', sql.Int, shop)
            .input('empName', sql.NVarChar(100), empName)
            .input('empNo', sql.NVarChar(50), empNo)
            .input('doj', sql.VarChar(10), doj)
            .input('planNo', sql.Int, planNo)
            .input('planDateTime', sql.VarChar(25), planDateTime)
            .input('actualStatus', sql.NVarChar(20), actual)
            .input('signature', sql.NVarChar(100), String(signature))
            .query(`
              INSERT INTO OperatorObservationPlan (
                machineShop, empName, empNo, doj, planNo, planDateTime, actualStatus, shiftInchargeSignature
              ) VALUES (
                @machineShop, @empName, @empNo, CONVERT(date, @doj), @planNo,
                CONVERT(datetime, @planDateTime, 126), @actualStatus, @signature
              )
            `);
        } else if (!existing.recordset[0].actualStatus && actual) {
          // Existing slot, ACTUAL still blank -> allowed to set once
          await transaction.request()
            .input('id', sql.Int, existing.recordset[0].id)
            .input('actualStatus', sql.NVarChar(20), actual)
            .input('signature', sql.NVarChar(100), String(signature))
            .query(`
              UPDATE OperatorObservationPlan
              SET actualStatus = @actualStatus,
                  shiftInchargeSignature = @signature,
                  updatedAt = GETDATE()
              WHERE id = @id AND actualStatus IS NULL
            `);
        }
      }
    }

    await transaction.commit();

    // Remember employee numbers for the dropdown.
    for (const row of rows) {
      const empNo = String(row.empNo || '').trim();
      if (!empNo) continue;

      try {
        const request = new sql.Request();
        request.input('machineShop', sql.Int, shop);
        request.input('empNo', sql.NVarChar(50), empNo);

        await request.query(`
          IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OperatorObservationEmployeeOptions' AND xtype='U')
          BEGIN
            CREATE TABLE OperatorObservationEmployeeOptions (
              id INT IDENTITY(1,1) PRIMARY KEY,
              machineShop INT NOT NULL,
              empNo NVARCHAR(50) NOT NULL,
              createdAt DATETIME DEFAULT GETDATE()
            );
          END

          IF EXISTS (
            SELECT 1
            FROM OperatorObservationEmployeeOptions
            WHERE machineShop = @machineShop
              AND empNo = @empNo
          )
          BEGIN
            UPDATE OperatorObservationEmployeeOptions
            SET createdAt = GETDATE()
            WHERE machineShop = @machineShop
              AND empNo = @empNo;
          END
          ELSE
          BEGIN
            INSERT INTO OperatorObservationEmployeeOptions (
              machineShop,
              empNo
            )
            VALUES (
              @machineShop,
              @empNo
            );
          END
        `);
      } catch (optionError) {
        console.error('Failed to update employee-number dropdown:', optionError);
      }
    }

    // Keep only the 10 most recently used employee numbers per shop
    try {
      const cleanup = new sql.Request();
      cleanup.input('machineShop', sql.Int, shop);

      await cleanup.query(`
        ;WITH RankedOptions AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY machineShop
              ORDER BY createdAt DESC, id DESC
            ) AS rn
          FROM OperatorObservationEmployeeOptions
          WHERE machineShop = @machineShop
        )
        DELETE FROM RankedOptions
        WHERE rn > 10;
      `);
    } catch (cleanupError) {
      console.error('Failed to trim employee-number dropdown:', cleanupError);
    }

    return res.status(201).json({
      message: 'Operator Observation Plan saved successfully'
    });
  } catch (err) {
    console.error('Error saving Operator Observation Plan:', err);
    if (transaction) {
      try { await transaction.rollback(); } catch (e) {}
    }
    return res.status(500).json({ error: 'Failed to save Operator Observation Plan' });
  }
};

// ============================================================
// 3. PDF REPORT FOR A SPECIFIC EMP NO (WITH DYNAMIC QF VALUES)
// ============================================================
const generateReport = async (req, res) => {
  try {
    const { empNo, shopId } = req.query;

    if (!empNo || !String(empNo).trim()) {
      return res.status(400).send("empNo is required.");
    }

    const request = new sql.Request();
    request.input('empNo', sql.NVarChar(50), String(empNo).trim());

    let query = `
      SELECT
        MachineShop, empName, empNo,
        CONVERT(VARCHAR(10), doj, 23) AS doj,
        planNo,
        CONVERT(VARCHAR(16), planDateTime, 126) AS planDateTime,
        actualStatus,
        shiftInchargeSignature
      FROM OperatorObservationPlan
      WHERE empNo = @empNo
    `;
    if (shopId) {
      request.input('machineShop', sql.Int, parseInt(shopId, 10));
      query += ` AND machineShop = @machineShop`;
    }
    query += ` ORDER BY planNo ASC`;

    const result = await request.query(query);
    const records = result.recordset;

    if (!records || records.length === 0) {
      return res.status(404).send("No records found for the given Emp No.");
    }

    const first = records[0];
    const safeEmp = String(first.empNo).replace(/[^A-Za-z0-9_-]/g, '_');

    // Fetch QF History for dynamic versioning
    let qfHistory = [];
    try {
      const qfRes = await sql.query(`
        SELECT id, formName, qfValue, date 
        FROM OperatorObservationPlanQFvalues 
        ORDER BY date DESC, id DESC
      `);
      qfHistory = qfRes.recordset || [];
    } catch (qfErr) {
      console.error("Warning: Could not fetch OperatorObservationPlanQFvalues:", qfErr.message);
    }

    const getEffectiveQfValue = (recordDateStr) => {
      const fallback = "QF/XX/MPD-XX | Revision 00 | Revision Date: 01.01.2024";
      if (!qfHistory || qfHistory.length === 0) return fallback;

      if (recordDateStr) {
        const targetDate = new Date(recordDateStr);
        targetDate.setHours(0, 0, 0, 0);

        for (let qf of qfHistory) {
          if (!qf.date) continue;
          const qfDate = new Date(qf.date);
          qfDate.setHours(0, 0, 0, 0);

          if (qfDate <= targetDate) {
            return qf.qfValue;
          }
        }
      }
      return qfHistory[0]?.qfValue || fallback;
    };

    const effectiveQf = getEffectiveQfValue(first.planDateTime || first.doj);

    const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true, autoPageBreak: false });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Operator_Observation_Plan_${safeEmp}.pdf`);
    doc.pipe(res);

    const startX = 20;
    const totalWidth = doc.page.width - 40;
    const pageBottom = doc.page.height - 20;
    const topMargin = 20;

    const drawPageHeader = () => {
      const headerH = 34;
      doc.lineWidth(0.8).strokeColor('black');
      doc.rect(startX, topMargin, 90, headerH).stroke();

      const logoPath = path.join(__dirname, 'logo.jpg');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, startX + 5, topMargin + 4, { width: 80, height: 26, fit: [80, 26], align: 'center', valign: 'center' });
      } else {
        doc.font("Helvetica-Bold").fontSize(10).fillColor('black').text("SAKTHI\nAUTO", startX, topMargin + 8, { width: 90, align: "center" });
      }

      const titleW = totalWidth - 90 - 180;
      doc.rect(startX + 90, topMargin, titleW, headerH).stroke();
      doc.font("Helvetica-Bold").fontSize(11).fillColor('black')
        .text("OPERATOR OBSERVATION PLAN", startX + 90, topMargin + 12, { width: titleW, align: "center" });

      doc.rect(startX + totalWidth - 180, topMargin, 180, headerH).stroke();
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor('black')
        .text(`SHOP: ${first.MachineShop} | EMP: ${first.empNo}`, startX + totalWidth - 180, topMargin + 5, { width: 180, align: "center" });
      doc.font("Helvetica").fontSize(6.5).fillColor('black')
        .text(effectiveQf, startX + totalWidth - 180, topMargin + 18, { width: 180, align: "center" });

      const infoY = topMargin + headerH + 6;
      const infoH = 20;
      const infoW = totalWidth / 3;
      const info = [
        ["NAME", first.empName],
        ["EMP NO", first.empNo],
        ["DOJ", displayDate(first.doj)],
      ];
      info.forEach(([label, value], i) => {
        const x = startX + infoW * i;
        doc.lineWidth(0.5).strokeColor('black').rect(x, infoY, infoW, infoH).stroke();
        doc.font("Helvetica-Bold").fontSize(7).fillColor('black').text(`${label}: `, x + 6, infoY + 6, { continued: true });
        doc.font("Helvetica").text(String(value || '-'));
      });

      return infoY + infoH + 8;
    };

    const headers = ["Plan No", "Plan (Date & Time)", "Actual"];
    const fractions = [0.12, 0.44, 0.44];
    const colWidths = fractions.map((f) => f * totalWidth);
    const rowH = 18;
    const sigBlockH = 50;

    const drawTableHeader = (y) => {
      let x = startX;
      doc.font("Helvetica-Bold").fontSize(7.5).lineWidth(0.5);
      headers.forEach((h, i) => {
        doc.rect(x, y, colWidths[i], rowH).fillAndStroke('#f0f0f0', 'black');
        doc.fillColor('black').text(h, x + 3, y + 5, { width: colWidths[i] - 6, align: "center" });
        x += colWidths[i];
      });
      return y + rowH;
    };

    let y = drawTableHeader(drawPageHeader());

    records.forEach((r) => {
      if (y + rowH > pageBottom - sigBlockH) {
        doc.addPage();
        y = drawTableHeader(drawPageHeader());
      }

      const status = r.actualStatus || '';
      const actualFill = status === 'COMPLETED' ? '#16a34a' : status === 'NOT COMPLETED' ? '#dc2626' : '#ffffff';
      const actualText = status ? status : '-';

      let x = startX;
      const cells = [String(r.planNo), displayDateTime(r.planDateTime), actualText];
      cells.forEach((c, i) => {
        if (i === 2) {
          doc.rect(x, y, colWidths[i], rowH).fillAndStroke(actualFill, 'black');
          doc.fillColor(status ? 'white' : 'black').font(status ? "Helvetica-Bold" : "Helvetica").fontSize(7.5)
            .text(c, x + 3, y + 5, { width: colWidths[i] - 6, align: "center" });
        } else {
          doc.rect(x, y, colWidths[i], rowH).stroke();
          doc.fillColor('black').font("Helvetica").fontSize(7.5)
            .text(c, x + 3, y + 5, { width: colWidths[i] - 6, align: "center" });
        }
        x += colWidths[i];
      });
      y += rowH;
    });

    const sig = [...records].reverse().find((r) => r.shiftInchargeSignature)?.shiftInchargeSignature || '';
    const sigY = y + 14;
    const sigW = 220;
    doc.fillColor('black').font("Helvetica-Bold").fontSize(7)
      .text("Shift Incharge", startX, sigY, { width: sigW, align: "center" });
    doc.lineWidth(0.5).strokeColor('black').rect(startX, sigY + 10, sigW, 20).stroke();
    if (sig) {
      doc.fillColor('black').font('Helvetica-Bold').fontSize(7)
        .text(String(sig).toUpperCase(), startX, sigY + 16, { width: sigW, align: "center" });
    } else {
      doc.fillColor('red').font('Helvetica').fontSize(7)
        .text("Pending", startX, sigY + 16, { width: sigW, align: "center" });
    }

    doc.end();
  } catch (err) {
    console.error("PDF generation error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "PDF generation failed" });
    } else {
      res.end();
    }
  }
};

// ============================================================
// 4. GET SAVED EMPLOYEE-NUMBER OPTIONS (MAXIMUM 10)
// ============================================================
const getEmployeeNumberOptions = async (req, res) => {
  const machineShop = parseInt(req.query.machineShop, 10) || 3;

  try {
    const request = new sql.Request();
    request.input('machineShop', sql.Int, machineShop);

    await request.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OperatorObservationEmployeeOptions' AND xtype='U')
      BEGIN
        CREATE TABLE OperatorObservationEmployeeOptions (
          id INT IDENTITY(1,1) PRIMARY KEY,
          machineShop INT NOT NULL,
          empNo NVARCHAR(50) NOT NULL,
          createdAt DATETIME DEFAULT GETDATE()
        );
      END
    `);

    const result = await request.query(`
      SELECT TOP 10 id, empNo
      FROM OperatorObservationEmployeeOptions
      WHERE machineShop = @machineShop
      ORDER BY createdAt DESC, id DESC
    `);

    return res.status(200).json({
      employeeNumbers: result.recordset
    });
  } catch (err) {
    console.error('Error fetching employee-number options:', err);
    return res.status(500).json({
      error: 'Failed to fetch employee-number options'
    });
  }
};

// ============================================================
// 5. REMOVE AN EMPLOYEE-NUMBER OPTION
// ============================================================
const removeEmployeeNumberOption = async (req, res) => {
  const machineShop = parseInt(req.query.machineShop, 10) || 3;
  const empNo = String(req.query.empNo || '').trim();

  if (!empNo) {
    return res.status(400).json({
      error: 'empNo is required'
    });
  }

  try {
    const request = new sql.Request();
    request.input('machineShop', sql.Int, machineShop);
    request.input('empNo', sql.NVarChar(50), empNo);

    await request.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OperatorObservationEmployeeOptions' AND xtype='U')
      BEGIN
        CREATE TABLE OperatorObservationEmployeeOptions (
          id INT IDENTITY(1,1) PRIMARY KEY,
          machineShop INT NOT NULL,
          empNo NVARCHAR(50) NOT NULL,
          createdAt DATETIME DEFAULT GETDATE()
        );
      END

      DELETE FROM OperatorObservationEmployeeOptions
      WHERE machineShop = @machineShop
        AND empNo = @empNo
    `);

    return res.status(200).json({
      message: 'Employee-number option removed successfully'
    });
  } catch (err) {
    console.error('Error removing employee-number option:', err);
    return res.status(500).json({
      error: 'Failed to remove employee-number option'
    });
  }
};

module.exports = {
  getEmployeePlans,
  saveOperatorObservationPlan,
  generateReport,
  getEmployeeNumberOptions,
  removeEmployeeNumberOption
};