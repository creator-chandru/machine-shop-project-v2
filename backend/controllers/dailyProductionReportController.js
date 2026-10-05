const sql = require('../db');
const PDFDocument = require("pdfkit");
const fs = require('fs');
const path = require('path');

// Helper to sanitize time values
const sanitizeTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.trim()) {
    return null;
  }
  return timeStr.trim();
};

// ============================================================
// HELPER: GENERATE PART TRACEABILITY CODE
// ============================================================
const generatePartTraceability = async (transaction, lineCode, checkDate, shift) => {
  if (!lineCode || !checkDate || !shift) return '';

  const lineMatch = String(lineCode).match(/(\d+)([A-Za-z]*)$/);
  if (!lineMatch) return '';

  const digits = parseInt(lineMatch[1], 10);
  const suffix = lineMatch[2] ? lineMatch[2].toUpperCase() : '';
  const lineIdentifier = `${digits}${suffix}`;

  const shiftMap = {
    I: 1, II: 2, III: 3,
    '1': 1, '2': 2, '3': 3,
  };

  const shiftNumber = shiftMap[String(shift).trim().toUpperCase()];
  if (!shiftNumber) return '';

  let year, month, day;
  if (typeof checkDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(checkDate)) {
    const parts = checkDate.split('T')[0].split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    const dateObj = new Date(checkDate);
    if (isNaN(dateObj.getTime())) return '';
    year = dateObj.getFullYear();
    month = dateObj.getMonth() + 1;
    day = dateObj.getDate();
  }

  const request = transaction.request();
  request.input('yearValue', sql.Int, year);
  request.input('monthValue', sql.Int, month);
  request.input('dayValue', sql.Int, day);
  request.input('shiftValue', sql.Int, shiftNumber);

  const result = await request.query(`
    SELECT
      (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'YEAR' AND SourceValue = @yearValue) AS yearCode,
      (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'MONTH' AND SourceValue = @monthValue) AS monthCode,
      (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'DAY' AND SourceValue = @dayValue) AS dayCode,
      (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'SHIFT' AND SourceValue = @shiftValue) AS shiftCode
  `);

  const mapping = result.recordset[0];
  if (!mapping || !mapping.yearCode || !mapping.monthCode || !mapping.dayCode || !mapping.shiftCode) {
    return '';
  }

  return `${mapping.yearCode}${mapping.monthCode}${mapping.dayCode}${mapping.shiftCode}-${lineIdentifier}`;
};

// ============================================================
// 1. GET PART TRACEABILITY
// ============================================================
const getPartTraceability = async (req, res) => {
  const { lineCode, date, shift } = req.query;

  if (!lineCode || !date || !shift) {
    return res.status(400).json({ error: 'lineCode, date and shift are required' });
  }

  const transaction = new sql.Transaction();
  try {
    await transaction.begin();
    const partTraceability = await generatePartTraceability(transaction, lineCode, date, shift);
    await transaction.commit();
    return res.status(200).json({ partTraceability: partTraceability || '' });
  } catch (err) {
    console.error('Error generating Part Traceability:', err);
    try { await transaction.rollback(); } catch (e) {}
    return res.status(500).json({ error: 'Failed to generate Part Traceability' });
  }
};

// ============================================================
// 2. GET QC INCHARGES LIST
// ============================================================
const getIncharges = async (req, res) => {
  try {
    const qcRes = await sql.query`
      SELECT username AS name, username, employeeId 
      FROM dbo.MachineShopUsers 
      WHERE LOWER(role) IN ('qc', 'qualitycontroller') 
      ORDER BY username ASC
    `;

    const list = qcRes.recordset.length > 0 
      ? qcRes.recordset 
      : [{ name: 'qc', username: 'qc', employeeId: 'qc' }];

    return res.status(200).json({ qcList: list });
  } catch (err) {
    console.error('Error fetching QC incharges:', err);
    return res.status(500).json({ error: 'Failed to fetch QC list' });
  }
};

// ============================================================
// 3. GET HOF INCHARGES LIST
// ============================================================
const getHofIncharges = async (req, res) => {
  try {
    const hofRes = await sql.query`
      SELECT username AS name, username, employeeId 
      FROM dbo.MachineShopUsers 
      WHERE LOWER(role) IN ('hof', 'headfacility', 'headofproduction') 
      ORDER BY username ASC
    `;

    const list = hofRes.recordset.length > 0 
      ? hofRes.recordset 
      : [{ name: 'hof', username: 'hof', employeeId: 'hof' }];

    return res.status(200).json({ hofList: list });
  } catch (err) {
    console.error('Error fetching HOF incharges:', err);
    return res.status(500).json({ error: 'Failed to fetch HOF list' });
  }
};

// ============================================================
// 4. GET MACHINE SHOP DETAILS DYNAMICALLY
// ============================================================
const getMachineShopDetails = async (req, res) => {
  const { shopId } = req.params;
  try {
    const tableName = `MachineShop${parseInt(shopId, 10)}Details`;
    const result = await sql.query(`
      SELECT id, lineCode, partName, partNo, machineNo, machineType
      FROM ${tableName}
      ORDER BY lineCode, partName, partNo, machineNo
    `);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error(`Error fetching Machine Shop ${shopId} details:`, err);
    res.status(500).json({ error: `Failed to fetch Machine Shop ${shopId} details` });
  }
};

// ============================================================
// 5. SAVE DAILY PRODUCTION REPORT
// ============================================================
const saveDailyProductionReport = async (req, res) => {
  const { header, rows, signatures, status } = req.body;
  let transaction;

  try {
    transaction = new sql.Transaction();
    await transaction.begin();

    const machineShop = String(header?.machineShop || '3');
    const lineCode = header?.lineCode || '';
    const reportDate = header?.date ? String(header.date).split('T')[0] : null;
    const shift = header?.shift || 'I';
    const shiftInchargeName = header?.shiftInchargeName || '';
    const assignedQc = header?.assignedQc || '';
    const assignedHof = header?.assignedHof || '';

    let partTraceabilityMachining = header?.partTraceabilityMachining || '';
    if (!partTraceabilityMachining.trim()) {
      partTraceabilityMachining = await generatePartTraceability(transaction, lineCode, reportDate, shift);
    }

    const qcSignature = signatures?.shiftSupervisorQuality || '';
    const hofSignature = signatures?.hofProduction || '';

    // Clear previous unverified draft rows
    await transaction.request()
      .input('MachineShop', sql.NVarChar(50), machineShop)
      .input('lineCode', sql.NVarChar(50), lineCode)
      .input('ReportDate', sql.Date, reportDate)
      .input('Shift', sql.NVarChar(10), shift)
      .query(`
        DELETE FROM DailyProductionReport
        WHERE MachineShop = @MachineShop
          AND lineCode = @lineCode
          AND CONVERT(date, ReportDate) = CONVERT(date, @ReportDate)
          AND Shift = @Shift
          AND (Sign_SupervisorQuality IS NULL OR Sign_SupervisorQuality = '' OR Sign_SupervisorQuality = 'Pending'
               OR Sign_HOFProduction IS NULL OR Sign_HOFProduction = '' OR Sign_HOFProduction = 'Pending')
      `);

    for (const row of rows) {
      await transaction.request()
        .input('MachineShop', sql.NVarChar(50), machineShop)
        .input('lineCode', sql.NVarChar(50), lineCode)
        .input('PartTraceabilityMachining', sql.NVarChar(100), partTraceabilityMachining)
        .input('ReportDate', sql.Date, reportDate ? reportDate : null)
        .input('Shift', sql.NVarChar(10), shift)
        .input('ShiftInchargeName', sql.NVarChar(100), shiftInchargeName)
        
        .input('MachineNo', sql.NVarChar(50), row.machineNo || '')
        .input('MachineName', sql.NVarChar(100), row.machineName || '')
        .input('PartNameNo', sql.NVarChar(100), row.partNameNo || '')
        .input('OperationDescription', sql.NVarChar(255), row.operationDescription || '')
        .input('OperatorName', sql.NVarChar(100), row.operatorName || '')
        .input('Produced', sql.Int, (row.produced !== "" && row.produced != null) ? parseInt(row.produced, 10) : null)
        .input('Accepted', sql.Int, (row.accepted !== "" && row.accepted != null) ? parseInt(row.accepted, 10) : null)
        .input('HoldNonConformance', sql.NVarChar(100), row.holdNonConformance || '')
        .input('ReasonForHold_Casting', sql.NVarChar(255), row.reasonForHold?.casting || '')
        .input('ReasonForHold_CastingQty', sql.Int, (row.reasonForHold?.castingQty !== "" && row.reasonForHold?.castingQty != null) ? parseInt(row.reasonForHold.castingQty, 10) : null)
        .input('ReasonForHold_Machining', sql.NVarChar(255), row.reasonForHold?.machining || '')
        .input('ReasonForHold_MachiningQty', sql.Int, (row.reasonForHold?.machiningQty !== "" && row.reasonForHold?.machiningQty != null) ? parseInt(row.reasonForHold.machiningQty, 10) : null)
        .input('McStopTimeReason', sql.NVarChar(255), row.mcStopTimeReason || '')
        
        .input('TimeFrom', sql.VarChar(10), sanitizeTime(row.time?.from))
        .input('TimeTo', sql.VarChar(10), sanitizeTime(row.time?.to))

        .input('Sign_SupervisorProduction', sql.NVarChar(100), signatures?.shiftSupervisorProduction || '')
        .input('Sign_SupervisorQuality', sql.NVarChar(100), qcSignature)
        .input('Sign_ProductionEngineer', sql.NVarChar(100), signatures?.productionEngineer || '')
        .input('Sign_HOFProduction', sql.NVarChar(100), hofSignature)
        .input('assignedQc', sql.NVarChar(100), assignedQc)
        .input('assignedHof', sql.NVarChar(100), assignedHof)
        .query(`
          INSERT INTO DailyProductionReport (
            MachineShop, lineCode, PartTraceabilityMachining, ReportDate, Shift, ShiftInchargeName, 
            MachineNo, MachineName, PartNameNo, OperationDescription, OperatorName, 
            Produced, Accepted, HoldNonConformance, ReasonForHold_Casting, ReasonForHold_CastingQty, 
            ReasonForHold_Machining, ReasonForHold_MachiningQty, McStopTimeReason, TimeFrom, TimeTo,
            Sign_SupervisorProduction, Sign_SupervisorQuality, Sign_ProductionEngineer, Sign_HOFProduction
          ) VALUES (
            @MachineShop, @lineCode, @PartTraceabilityMachining, @ReportDate, @Shift, @ShiftInchargeName, 
            @MachineNo, @MachineName, @PartNameNo, @OperationDescription, @OperatorName, 
            @Produced, @Accepted, @HoldNonConformance, @ReasonForHold_Casting, @ReasonForHold_CastingQty, 
            @ReasonForHold_Machining, @ReasonForHold_MachiningQty, @McStopTimeReason, @TimeFrom, @TimeTo,
            @Sign_SupervisorProduction, @Sign_SupervisorQuality, @Sign_ProductionEngineer, @Sign_HOFProduction
          )
        `);
    }

    await transaction.commit();
    res.status(201).json({ message: 'Daily Production Report saved successfully' });
  } catch (err) {
    console.error('Error saving Daily Production Report:', err);
    if (transaction) {
      try { await transaction.rollback(); } catch (e) {}
    }
    res.status(500).json({ error: 'Failed to save Daily Production Report' });
  }
};

// ============================================================
// 6. GET QC PENDING DAILY PRODUCTION REPORTS
// ============================================================
const getQcReports = async (req, res) => {
  try {
    const { name } = req.params;
    const shopId = req.query.shopId;

    const request = new sql.Request();
    request.input('qcName', sql.NVarChar(100), String(name || '').trim());

    let shopFilter = '';
    if (shopId) {
      request.input('machineShop', sql.NVarChar(50), String(shopId));
      shopFilter = ' AND MachineShop = @machineShop';
    }

    const result = await request.query(`
      SELECT 
        MIN(Id) AS id,
        MachineShop AS machineShop,
        lineCode,
        MAX(PartNameNo) AS partName,
        FORMAT(ReportDate, 'yyyy-MM-dd') AS reportDate,
        Shift AS shift,
        MAX(ShiftInchargeName) AS shiftInchargeName,
        MAX(Sign_SupervisorQuality) AS verifiedByQcSignature,
        MAX(Sign_HOFProduction) AS hofSignature,
        'Pending' AS status
      FROM DailyProductionReport
      WHERE (Sign_SupervisorQuality IS NULL OR Sign_SupervisorQuality = '' OR Sign_SupervisorQuality = 'Pending')
        ${shopFilter}
      GROUP BY MachineShop, lineCode, ReportDate, Shift
      ORDER BY ReportDate DESC, MIN(Id) DESC
    `);

    return res.status(200).json(result.recordset);
  } catch (err) {
    console.error('QC Daily Production Dashboard Fetch Error:', err);
    return res.status(500).json({ message: 'DB error' });
  }
};

// ============================================================
// 7. GET HOF PENDING DAILY PRODUCTION REPORTS
// ============================================================
const getHofReports = async (req, res) => {
  try {
    const { name } = req.params;
    const shopId = req.query.shopId;

    const request = new sql.Request();
    request.input('hofName', sql.NVarChar(100), String(name || '').trim());

    let shopFilter = '';
    if (shopId) {
      request.input('machineShop', sql.NVarChar(50), String(shopId));
      shopFilter = ' AND MachineShop = @machineShop';
    }

    const result = await request.query(`
      SELECT 
        MIN(Id) AS id,
        MachineShop AS machineShop,
        lineCode,
        MAX(PartNameNo) AS partName,
        FORMAT(ReportDate, 'yyyy-MM-dd') AS reportDate,
        Shift AS shift,
        MAX(ShiftInchargeName) AS shiftInchargeName,
        MAX(Sign_SupervisorQuality) AS verifiedByQcSignature,
        MAX(Sign_HOFProduction) AS hofSignature,
        'Pending' AS status
      FROM DailyProductionReport
      WHERE (Sign_HOFProduction IS NULL OR Sign_HOFProduction = '' OR Sign_HOFProduction = 'Pending')
        ${shopFilter}
      GROUP BY MachineShop, lineCode, ReportDate, Shift
      ORDER BY ReportDate DESC, MIN(Id) DESC
    `);

    return res.status(200).json(result.recordset);
  } catch (err) {
    console.error('HOF Daily Production Dashboard Fetch Error:', err);
    return res.status(500).json({ message: 'DB error' });
  }
};

// ============================================================
// 8. POST QC APPROVAL SIGNATURE
// ============================================================
const signQcApproval = async (req, res) => {
  try {
    const { lineCode, date, shift, signature, qcUsername } = req.body;

    if (!lineCode || !date) {
      return res.status(400).json({ message: 'Missing lineCode or date' });
    }

    const signVal = signature || qcUsername || 'Approved';
    let cleanDate = String(date).split('T')[0];

    const request = new sql.Request();
    request.input('lineCode', sql.NVarChar(50), lineCode);
    request.input('reportDate', sql.NVarChar(50), cleanDate);
    request.input('signature', sql.NVarChar(100), signVal);

    let shiftFilter = '';
    if (shift) {
      request.input('shift', sql.NVarChar(10), shift);
      shiftFilter = ' AND Shift = @shift';
    }

    const result = await request.query(`
      UPDATE DailyProductionReport 
      SET Sign_SupervisorQuality = @signature
      WHERE lineCode = @lineCode 
        AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)
        AND (Sign_SupervisorQuality IS NULL OR Sign_SupervisorQuality = '' OR Sign_SupervisorQuality = 'Pending')
        ${shiftFilter}
    `);

    if (!result.rowsAffected[0]) {
      return res.status(404).json({ message: 'No pending records found to approve' });
    }

    return res.status(200).json({ success: true, message: 'Daily Production Report approved by QC successfully!' });
  } catch (err) {
    console.error('Sign QC Error:', err);
    return res.status(500).json({ message: 'Failed to approve report' });
  }
};

// ============================================================
// 9. POST HOF APPROVAL SIGNATURE
// ============================================================
const signHofApproval = async (req, res) => {
  try {
    const { lineCode, date, shift, signature, hofUsername } = req.body;

    if (!lineCode || !date) {
      return res.status(400).json({ message: 'Missing lineCode or date' });
    }

    const signVal = signature || hofUsername || 'Approved';
    let cleanDate = String(date).split('T')[0];

    const request = new sql.Request();
    request.input('lineCode', sql.NVarChar(50), lineCode);
    request.input('reportDate', sql.NVarChar(50), cleanDate);
    request.input('signature', sql.NVarChar(100), signVal);

    let shiftFilter = '';
    if (shift) {
      request.input('shift', sql.NVarChar(10), shift);
      shiftFilter = ' AND Shift = @shift';
    }

    const result = await request.query(`
      UPDATE DailyProductionReport 
      SET Sign_HOFProduction = @signature
      WHERE lineCode = @lineCode 
        AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)
        AND (Sign_HOFProduction IS NULL OR Sign_HOFProduction = '' OR Sign_HOFProduction = 'Pending')
        ${shiftFilter}
    `);

    if (!result.rowsAffected[0]) {
      return res.status(404).json({ message: 'No pending records found for HOF approval' });
    }

    return res.status(200).json({ success: true, message: 'Daily Production Report approved by HOF successfully!' });
  } catch (err) {
    console.error('Sign HOF Error:', err);
    return res.status(500).json({ message: 'Failed to approve report' });
  }
};

// ============================================================
// 10. GET DAILY PRODUCTION RECORDS (AUTO LOAD EXISTING)
// ============================================================
const getDailyProductionRecords = async (req, res) => {
  const { machineShop, lineCode, date, shift } = req.query;

  try {
    let query = `
      SELECT
        Id,
        MachineShop,
        lineCode,
        PartTraceabilityMachining,
        FORMAT(ReportDate, 'yyyy-MM-dd') AS ReportDate,
        Shift,
        ShiftInchargeName,
        MachineNo,
        MachineName,
        PartNameNo,
        OperationDescription,
        OperatorName,
        Produced,
        Accepted,
        HoldNonConformance,
        ReasonForHold_Casting,
        ReasonForHold_CastingQty,
        ReasonForHold_Machining,
        ReasonForHold_MachiningQty,
        McStopTimeReason,
        CONVERT(VARCHAR(5), TimeFrom, 108) AS TimeFrom,
        CONVERT(VARCHAR(5), TimeTo, 108) AS TimeTo,
        Sign_SupervisorProduction,
        Sign_SupervisorQuality,
        Sign_ProductionEngineer,
        Sign_HOFProduction
      FROM DailyProductionReport
      WHERE 1=1
    `;

    const request = new sql.Request();

    if (machineShop) {
      request.input('machineShop', sql.NVarChar(50), String(machineShop));
      query += ` AND MachineShop = @machineShop`;
    }
    if (lineCode) {
      request.input('lineCode', sql.NVarChar(50), lineCode);
      query += ` AND lineCode = @lineCode`;
    }
    if (date) {
      const cleanDate = String(date).split('T')[0];
      request.input('reportDate', sql.NVarChar(50), cleanDate);
      query += ` AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)`;
    }
    if (shift) {
      request.input('shift', sql.NVarChar(10), shift);
      query += ` AND Shift = @shift`;
    }

    query += ` ORDER BY Id ASC`;

    const result = await request.query(query);
    const rows = result.recordset;

    if (rows.length === 0) {
      return res.status(200).json([]);
    }

    const first = rows[0];
    const structuredRows = rows.map((r) => ({
      machineNo: r.MachineNo || "",
      machineName: r.MachineName || "",
      partNameNo: r.PartNameNo || "",
      operationDescription: r.OperationDescription || "",
      operatorName: r.OperatorName || "",
      produced: r.Produced ?? "",
      accepted: r.Accepted ?? "",
      holdNonConformance: r.HoldNonConformance || "",
      reasonForHold: {
        casting: r.ReasonForHold_Casting || "",
        castingQty: r.ReasonForHold_CastingQty ?? "",
        machining: r.ReasonForHold_Machining || "",
        machiningQty: r.ReasonForHold_MachiningQty ?? "",
      },
      mcStopTimeReason: r.McStopTimeReason || "",
      time: {
        from: r.TimeFrom || "",
        to: r.TimeTo || "",
      },
    }));

    const partTokens = String(first.PartNameNo || "").split("/");
    const partName = partTokens[0] ? partTokens[0].trim() : "";
    const partNo = partTokens[1] ? partTokens[1].trim() : "";

    const structuredRecord = {
      header: {
        machineShop: first.MachineShop,
        lineCode: first.lineCode,
        partName,
        partNo,
        date: first.ReportDate,
        shift: first.Shift || "I",
        shiftInchargeName: first.ShiftInchargeName || "",
        partTraceabilityMachining: first.PartTraceabilityMachining || "",
        assignedQc: "",
        assignedHof: "",
      },
      rows: structuredRows,
      signatures: {
        shiftSupervisorProduction: first.Sign_SupervisorProduction || "",
        shiftSupervisorQuality: first.Sign_SupervisorQuality || "",
        productionEngineer: first.Sign_ProductionEngineer || "",
        hofProduction: first.Sign_HOFProduction || "",
      },
      status: (first.Sign_SupervisorQuality && first.Sign_HOFProduction && first.Sign_SupervisorQuality !== "Pending" && first.Sign_HOFProduction !== "Pending") ? "Completed" : "Pending",
    };

    return res.status(200).json([structuredRecord]);
  } catch (err) {
    console.error('Error fetching Daily Production records:', err);
    return res.status(500).json({ error: 'Failed to fetch Daily Production records' });
  }
};

// ============================================================
// 11. PDF REPORT GENERATOR
// ============================================================
const generateReport = async (req, res) => {
  try {
    const { lineCode, date, shift, shopId } = req.query;

    if (!lineCode || !date) {
      return res.status(400).send("lineCode and date are required.");
    }

    const cleanDate = String(date).split('T')[0];
    const request = new sql.Request();
    request.input('lineCode', sql.NVarChar(50), lineCode);
    request.input('reportDate', sql.NVarChar(50), cleanDate);

    let query = `
      SELECT
        Id, MachineShop, lineCode, PartTraceabilityMachining,
        FORMAT(ReportDate, 'yyyy-MM-dd') AS ReportDate,
        Shift, ShiftInchargeName, MachineNo, MachineName, PartNameNo,
        OperationDescription, OperatorName, Produced, Accepted, HoldNonConformance,
        ReasonForHold_Casting, ReasonForHold_CastingQty, ReasonForHold_Machining, ReasonForHold_MachiningQty,
        McStopTimeReason,
        CONVERT(VARCHAR(5), TimeFrom, 108) AS TimeFrom,
        CONVERT(VARCHAR(5), TimeTo, 108) AS TimeTo,
        Sign_SupervisorProduction, Sign_SupervisorQuality, Sign_ProductionEngineer, Sign_HOFProduction
      FROM DailyProductionReport
      WHERE lineCode = @lineCode
        AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)
    `;

    if (shift) {
      request.input('shift', sql.NVarChar(10), shift);
      query += ` AND Shift = @shift`;
    }
    if (shopId) {
      request.input('machineShop', sql.NVarChar(50), String(shopId));
      query += ` AND MachineShop = @machineShop`;
    }

    query += ` ORDER BY Id ASC`;

    const result = await request.query(query);
    const records = result.recordset;

    if (records.length === 0) {
      return res.status(404).send("No records found for the selected parameters.");
    }

    const first = records[0];
    const [yy, mm, dd] = String(first.ReportDate).split('-');
    const displayDate = `${dd}/${mm}/${yy}`;

    const doc = new PDFDocument({ margin: 25, size: "A4", layout: "landscape", bufferPages: true, autoPageBreak: false });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=Daily_Production_Report.pdf");
    doc.pipe(res);

    const startX = 25;
    const headerY = 25;
    const totalWidth = doc.page.width - 50;
    const pageBottom = doc.page.height - 25;

    // Header Blocks
    doc.lineWidth(1).strokeColor('black');
    doc.rect(startX, headerY, 100, 35).stroke();

    const logoPath = path.join(__dirname, 'logo.jpg');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, startX + 10, headerY + 5, { width: 80, height: 25 });
    } else {
      doc.font("Helvetica-Bold").fontSize(12).fillColor('black').text("SAKTHI\nAUTO", startX, headerY + 8, { width: 100, align: "center" });
    }

    doc.rect(startX + 100, headerY, totalWidth - 250, 35).stroke();
    doc.font("Helvetica-Bold").fontSize(13).text("DAILY PRODUCTION REPORT (MACHINE SHOP)", startX + 100, headerY + 12, { width: totalWidth - 250, align: "center" });

    doc.rect(startX + totalWidth - 150, headerY, 150, 35).stroke();
    doc.font("Helvetica-Bold").fontSize(9).text(`LINE: ${lineCode} | SHIFT: ${first.Shift || 'I'}`, startX + totalWidth - 150, headerY + 6, { width: 150, align: "center" });
    doc.font("Helvetica").fontSize(8).text(`DATE: ${displayDate}`, startX + totalWidth - 150, headerY + 20, { width: 150, align: "center" });

    // Table Data
    const headers = ["M/C No", "Part Name / No", "Operator", "Prod", "Acc", "Hold", "Casting Reason", "Machining Reason", "Time", "M/C Stop Reason"];
    const fractions = [0.08, 0.16, 0.10, 0.05, 0.05, 0.06, 0.12, 0.12, 0.08, 0.18];
    const colWidths = fractions.map((f) => f * totalWidth);
    const pad = 4;
    const fontSize = 7;

    const drawRow = (cells, y, isHeader) => {
      doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);

      let rowH = 0;
      cells.forEach((c, i) => {
        const h = doc.heightOfString(String(c), { width: colWidths[i] - pad * 2 });
        if (h > rowH) rowH = h;
      });
      rowH += pad * 2;

      if (!isHeader && y + rowH > pageBottom) {
        doc.addPage();
        y = 25;
        y = drawRow(headers, y, true);
        doc.font("Helvetica").fontSize(fontSize);
      }

      let x = startX;
      cells.forEach((c, i) => {
        if (isHeader) {
          doc.rect(x, y, colWidths[i], rowH).fillAndStroke('#f0f0f0', 'black');
        } else {
          doc.rect(x, y, colWidths[i], rowH).stroke();
        }
        doc.fillColor('black').font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize)
          .text(String(c), x + pad, y + pad, { width: colWidths[i] - pad * 2, align: "center" });
        x += colWidths[i];
      });

      return y + rowH;
    };

    doc.lineWidth(0.5).strokeColor('black');
    let y = drawRow(headers, headerY + 45, true);

    records.forEach((r) => {
      const timeVal = (r.TimeFrom || r.TimeTo) ? `${r.TimeFrom || ''}-${r.TimeTo || ''}` : '-';
      const castHold = r.ReasonForHold_Casting ? `${r.ReasonForHold_Casting} (${r.ReasonForHold_CastingQty || 0})` : '-';
      const machHold = r.ReasonForHold_Machining ? `${r.ReasonForHold_Machining} (${r.ReasonForHold_MachiningQty || 0})` : '-';

      y = drawRow([
        r.MachineNo || "-",
        r.PartNameNo || "-",
        r.OperatorName || "-",
        r.Produced != null ? r.Produced : "-",
        r.Accepted != null ? r.Accepted : "-",
        r.HoldNonConformance || "-",
        castHold,
        machHold,
        timeVal,
        r.McStopTimeReason || "-"
      ], y, false);
    });

    // Signatures Block
    let sigY = y + 18;
    if (sigY + 50 > pageBottom) {
      doc.addPage();
      sigY = 30;
    }

    const sigColWidth = totalWidth / 4;

    // 1. Shift Supervisor (Production)
    doc.lineWidth(0.5).strokeColor('black');
    doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("Shift Supervisor (Production)", startX, sigY, { width: sigColWidth - 10, align: "center" });
    doc.rect(startX + 10, sigY + 12, sigColWidth - 20, 28).stroke();
    const opSig = first.Sign_SupervisorProduction;
    if (opSig && !String(opSig).includes('Pending')) {
      doc.fillColor('black').font('Helvetica').fontSize(8).text(String(opSig), startX + 10, sigY + 22, { width: sigColWidth - 20, align: "center" });
    }

    // 2. Shift Supervisor (Quality)
    const qcX = startX + sigColWidth;
    doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("Shift Supervisor (Quality)", qcX, sigY, { width: sigColWidth - 10, align: "center" });
    doc.rect(qcX + 10, sigY + 12, sigColWidth - 20, 28).stroke();
    const qcSig = first.Sign_SupervisorQuality;
    if (qcSig && !String(qcSig).includes('Pending')) {
      doc.lineWidth(1.5).strokeColor('#16a34a').moveTo(qcX + 20, sigY + 26).lineTo(qcX + 24, sigY + 31).lineTo(qcX + 30, sigY + 20).stroke();
      doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(8).text(`APPROVED (${String(qcSig).toUpperCase()})`, qcX + 34, sigY + 22, { lineBreak: false });
    } else {
      doc.fillColor('red').font('Helvetica').fontSize(8).text("Pending", qcX + 10, sigY + 22, { width: sigColWidth - 20, align: "center" });
    }

    // 3. Production Engineer
    const peX = startX + sigColWidth * 2;
    doc.strokeColor('black').lineWidth(0.5);
    doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("Production Engineer", peX, sigY, { width: sigColWidth - 10, align: "center" });
    doc.rect(peX + 10, sigY + 12, sigColWidth - 20, 28).stroke();
    const peSig = first.Sign_ProductionEngineer;
    if (peSig && !String(peSig).includes('Pending')) {
      doc.fillColor('black').font('Helvetica').fontSize(8).text(String(peSig), peX + 10, sigY + 22, { width: sigColWidth - 20, align: "center" });
    }

    // 4. HOF - Production
    const hofX = startX + sigColWidth * 3;
    doc.strokeColor('black').lineWidth(0.5);
    doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("HOF - Production", hofX, sigY, { width: sigColWidth - 10, align: "center" });
    doc.rect(hofX + 10, sigY + 12, sigColWidth - 20, 28).stroke();
    const hofSig = first.Sign_HOFProduction;
    if (hofSig && !String(hofSig).includes('Pending')) {
      doc.lineWidth(1.5).strokeColor('#16a34a').moveTo(hofX + 20, sigY + 26).lineTo(hofX + 24, sigY + 31).lineTo(hofX + 30, sigY + 20).stroke();
      doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(8).text(`APPROVED (${String(hofSig).toUpperCase()})`, hofX + 34, sigY + 22, { lineBreak: false });
    } else {
      doc.fillColor('red').font('Helvetica').fontSize(8).text("Pending", hofX + 10, sigY + 22, { width: sigColWidth - 20, align: "center" });
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

module.exports = {
  getMachineShopDetails,
  saveDailyProductionReport,
  getDailyProductionRecords,
  getQcReports,
  getHofReports,
  signQcApproval,
  signHofApproval,
  generateReport,
  getPartTraceability,
  getIncharges,
  getHofIncharges
};