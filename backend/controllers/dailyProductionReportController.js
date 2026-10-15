const sql = require('../db');
const PDFDocument = require("pdfkit");
const fs = require('fs');
const path = require('path');

const sanitizeTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.trim()) {
    return null;
  }
  return timeStr.trim();
};

const generatePartTraceability = async (transaction, lineCode, checkDate, shift) => {
  if (!lineCode || !checkDate || !shift) return '';

  const lineMatch = String(lineCode).match(/(\d+)([A-Za-z]*)$/);
  if (!lineMatch) return '';

  const digits = parseInt(lineMatch[1], 10);
  const suffix = lineMatch[2] ? lineMatch[2].toUpperCase() : '';
  const lineIdentifier = `${digits}${suffix}`;

  const shiftMap = { I: 1, II: 2, III: 3, '1': 1, '2': 2, '3': 3 };
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
    try { await transaction.rollback(); } catch (e) {}
    return res.status(500).json({ error: 'Failed to generate Part Traceability' });
  }
};

const getIncharges = async (req, res) => {
  try {
    const qcRes = await sql.query`SELECT username AS name, username, employeeId FROM dbo.MachineShopUsers WHERE LOWER(role) IN ('qc', 'qualitycontroller') ORDER BY username ASC`;
    const list = qcRes.recordset.length > 0 ? qcRes.recordset : [{ name: 'qc', username: 'qc', employeeId: 'qc' }];
    return res.status(200).json({ qcList: list });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch QC list' });
  }
};

const getPeIncharges = async (req, res) => {
  try {
    const peRes = await sql.query`SELECT username AS name, username, employeeId FROM dbo.MachineShopUsers WHERE LOWER(role) IN ('pe', 'productengineer', 'productionengineer') ORDER BY username ASC`;
    const list = peRes.recordset.length > 0 ? peRes.recordset : [{ name: 'pe', username: 'pe', employeeId: 'pe' }];
    return res.status(200).json({ peList: list });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch PE list' });
  }
};

const getHofIncharges = async (req, res) => {
  try {
    const hofRes = await sql.query`SELECT username AS name, username, employeeId FROM dbo.MachineShopUsers WHERE LOWER(role) IN ('hof', 'headfacility', 'headofproduction') ORDER BY username ASC`;
    const list = hofRes.recordset.length > 0 ? hofRes.recordset : [{ name: 'hof', username: 'hof', employeeId: 'hof' }];
    return res.status(200).json({ hofList: list });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch HOF list' });
  }
};

const getMachineShopDetails = async (req, res) => {
  const { shopId } = req.params;
  try {
    const tableName = `MachineShop${parseInt(shopId, 10)}Details`;
    const result = await sql.query(`SELECT id, lineCode, partName, partNo, machineNo, machineType FROM ${tableName} ORDER BY lineCode, partName, partNo, machineNo`);
    res.status(200).json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch Machine Shop ${shopId} details` });
  }
};

const saveDailyProductionReport = async (req, res) => {
  const { header, rows, signatures } = req.body;
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
    const assignedPe = header?.assignedPe || '';
    const assignedHof = header?.assignedHof || '';

    let partTraceabilityMachining = header?.partTraceabilityMachining || '';
    if (!partTraceabilityMachining.trim()) {
      partTraceabilityMachining = await generatePartTraceability(transaction, lineCode, reportDate, shift);
    }

    const qcSignature = signatures?.shiftSupervisorQuality || '';
    const peSignature = signatures?.productionEngineer || '';
    const hofSignature = signatures?.hofProduction || '';

    const deleteReq = transaction.request();
    deleteReq.input('MachineShop', sql.NVarChar(50), machineShop);
    deleteReq.input('lineCode', sql.NVarChar(50), lineCode);
    deleteReq.input('ReportDate', sql.Date, reportDate);
    deleteReq.input('Shift', sql.NVarChar(10), shift);

    await deleteReq.query(`
      DELETE FROM DailyProductionReport
      WHERE MachineShop = @MachineShop
        AND lineCode = @lineCode
        AND CONVERT(date, ReportDate) = CONVERT(date, @ReportDate)
        AND Shift = @Shift
        AND (
          Sign_SupervisorQuality IS NULL OR Sign_SupervisorQuality = '' OR Sign_SupervisorQuality = 'Pending'
          OR Sign_ProductionEngineer IS NULL OR Sign_ProductionEngineer = '' OR Sign_ProductionEngineer = 'Pending'
          OR Sign_HOFProduction IS NULL OR Sign_HOFProduction = '' OR Sign_HOFProduction = 'Pending'
        )
    `);

    for (const row of rows) {
      await transaction.request()
        .input('MachineShop', sql.NVarChar(50), machineShop)
        .input('lineCode', sql.NVarChar(50), lineCode)
        .input('PartTraceabilityMachining', sql.NVarChar(100), partTraceabilityMachining)
        .input('ReportDate', sql.Date, reportDate)
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
        .input('Sign_ProductionEngineer', sql.NVarChar(100), peSignature)
        .input('Sign_HOFProduction', sql.NVarChar(100), hofSignature)
        .input('assignedQc', sql.NVarChar(100), assignedQc)
        .input('assignedPe', sql.NVarChar(100), assignedPe)
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
    if (transaction) {
      try { await transaction.rollback(); } catch (e) {}
    }
    res.status(500).json({ error: 'Failed to save Daily Production Report' });
  }
};

const getQcReports = async (req, res) => {
  try {
    const shopId = req.query.shopId;
    const request = new sql.Request();
    let shopFilter = '';
    if (shopId) {
      request.input('machineShop', sql.NVarChar(50), String(shopId));
      shopFilter = ' AND MachineShop = @machineShop';
    }
    const result = await request.query(`
      SELECT MIN(Id) AS id, MachineShop AS machineShop, lineCode, MAX(PartNameNo) AS partName, FORMAT(ReportDate, 'yyyy-MM-dd') AS reportDate, Shift AS shift, MAX(ShiftInchargeName) AS shiftInchargeName, MAX(Sign_SupervisorQuality) AS verifiedByQcSignature, MAX(Sign_ProductionEngineer) AS peSignature, MAX(Sign_HOFProduction) AS hofSignature, 'Pending' AS status
      FROM DailyProductionReport
      WHERE (Sign_SupervisorQuality IS NULL OR Sign_SupervisorQuality = '' OR Sign_SupervisorQuality = 'Pending')${shopFilter}
      GROUP BY MachineShop, lineCode, ReportDate, Shift
      ORDER BY ReportDate DESC, MIN(Id) DESC
    `);
    return res.status(200).json(result.recordset);
  } catch (err) {
    return res.status(500).json({ message: 'DB error' });
  }
};

const getPeReports = async (req, res) => {
  try {
    const shopId = req.query.shopId;
    const request = new sql.Request();
    let shopFilter = '';
    if (shopId) {
      request.input('machineShop', sql.NVarChar(50), String(shopId));
      shopFilter = ' AND MachineShop = @machineShop';
    }
    const result = await request.query(`
      SELECT MIN(Id) AS id, MachineShop AS machineShop, lineCode, MAX(PartNameNo) AS partName, FORMAT(ReportDate, 'yyyy-MM-dd') AS reportDate, Shift AS shift, MAX(ShiftInchargeName) AS shiftInchargeName, MAX(Sign_SupervisorQuality) AS verifiedByQcSignature, MAX(Sign_ProductionEngineer) AS peSignature, MAX(Sign_HOFProduction) AS hofSignature, 'Pending' AS status
      FROM DailyProductionReport
      WHERE (Sign_ProductionEngineer IS NULL OR Sign_ProductionEngineer = '' OR Sign_ProductionEngineer = 'Pending')${shopFilter}
      GROUP BY MachineShop, lineCode, ReportDate, Shift
      ORDER BY ReportDate DESC, MIN(Id) DESC
    `);
    return res.status(200).json(result.recordset);
  } catch (err) {
    return res.status(500).json({ message: 'DB error' });
  }
};

const getHofReports = async (req, res) => {
  try {
    const shopId = req.query.shopId;
    const request = new sql.Request();
    let shopFilter = '';
    if (shopId) {
      request.input('machineShop', sql.NVarChar(50), String(shopId));
      shopFilter = ' AND MachineShop = @machineShop';
    }
    const result = await request.query(`
      SELECT MIN(Id) AS id, MachineShop AS machineShop, lineCode, MAX(PartNameNo) AS partName, FORMAT(ReportDate, 'yyyy-MM-dd') AS reportDate, Shift AS shift, MAX(ShiftInchargeName) AS shiftInchargeName, MAX(Sign_SupervisorQuality) AS verifiedByQcSignature, MAX(Sign_ProductionEngineer) AS peSignature, MAX(Sign_HOFProduction) AS hofSignature, 'Pending' AS status
      FROM DailyProductionReport
      WHERE (Sign_HOFProduction IS NULL OR Sign_HOFProduction = '' OR Sign_HOFProduction = 'Pending')${shopFilter}
      GROUP BY MachineShop, lineCode, ReportDate, Shift
      ORDER BY ReportDate DESC, MIN(Id) DESC
    `);
    return res.status(200).json(result.recordset);
  } catch (err) {
    return res.status(500).json({ message: 'DB error' });
  }
};

const signQcApproval = async (req, res) => {
  try {
    const { lineCode, date, shift, signature, qcUsername } = req.body;
    const signVal = signature || qcUsername || 'Approved';
    const request = new sql.Request();
    request.input('lineCode', sql.NVarChar(50), lineCode);
    request.input('reportDate', sql.NVarChar(50), String(date).split('T')[0]);
    request.input('signature', sql.NVarChar(100), signVal);
    let shiftFilter = '';
    if (shift) {
      request.input('shift', sql.NVarChar(10), shift);
      shiftFilter = ' AND Shift = @shift';
    }
    const result = await request.query(`UPDATE DailyProductionReport SET Sign_SupervisorQuality = @signature WHERE lineCode = @lineCode AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate) AND (Sign_SupervisorQuality IS NULL OR Sign_SupervisorQuality = '' OR Sign_SupervisorQuality = 'Pending')${shiftFilter}`);
    if (!result.rowsAffected[0]) return res.status(404).json({ message: 'No pending records found to approve' });
    return res.status(200).json({ success: true, message: 'Approved by QC successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to approve report' });
  }
};

const signPeApproval = async (req, res) => {
  try {
    const { lineCode, date, shift, signature, peUsername } = req.body;
    const signVal = signature || peUsername || 'Approved';
    const request = new sql.Request();
    request.input('lineCode', sql.NVarChar(50), lineCode);
    request.input('reportDate', sql.NVarChar(50), String(date).split('T')[0]);
    request.input('signature', sql.NVarChar(100), signVal);
    let shiftFilter = '';
    if (shift) {
      request.input('shift', sql.NVarChar(10), shift);
      shiftFilter = ' AND Shift = @shift';
    }
    const result = await request.query(`UPDATE DailyProductionReport SET Sign_ProductionEngineer = @signature WHERE lineCode = @lineCode AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate) AND (Sign_ProductionEngineer IS NULL OR Sign_ProductionEngineer = '' OR Sign_ProductionEngineer = 'Pending')${shiftFilter}`);
    if (!result.rowsAffected[0]) return res.status(404).json({ message: 'No pending records found for PE approval' });
    return res.status(200).json({ success: true, message: 'Approved by PE successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to approve report' });
  }
};

const signHofApproval = async (req, res) => {
  try {
    const { lineCode, date, shift, signature, hofUsername } = req.body;
    const signVal = signature || hofUsername || 'Approved';
    const request = new sql.Request();
    request.input('lineCode', sql.NVarChar(50), lineCode);
    request.input('reportDate', sql.NVarChar(50), String(date).split('T')[0]);
    request.input('signature', sql.NVarChar(100), signVal);
    let shiftFilter = '';
    if (shift) {
      request.input('shift', sql.NVarChar(10), shift);
      shiftFilter = ' AND Shift = @shift';
    }
    const result = await request.query(`UPDATE DailyProductionReport SET Sign_HOFProduction = @signature WHERE lineCode = @lineCode AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate) AND (Sign_HOFProduction IS NULL OR Sign_HOFProduction = '' OR Sign_HOFProduction = 'Pending')${shiftFilter}`);
    if (!result.rowsAffected[0]) return res.status(404).json({ message: 'No pending records found for HOF approval' });
    return res.status(200).json({ success: true, message: 'Approved by HOF successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to approve report' });
  }
};

const getDailyProductionRecords = async (req, res) => {
  const { machineShop, lineCode, date, shift, machineNo } = req.query;
  try {
    let query = `
      SELECT Id, MachineShop, lineCode, PartTraceabilityMachining, FORMAT(ReportDate, 'yyyy-MM-dd') AS ReportDate, Shift, ShiftInchargeName, MachineNo, MachineName, PartNameNo, OperationDescription, OperatorName, Produced, Accepted, HoldNonConformance, ReasonForHold_Casting, ReasonForHold_CastingQty, ReasonForHold_Machining, ReasonForHold_MachiningQty, McStopTimeReason, CONVERT(VARCHAR(5), TimeFrom, 108) AS TimeFrom, CONVERT(VARCHAR(5), TimeTo, 108) AS TimeTo, Sign_SupervisorProduction, Sign_SupervisorQuality, Sign_ProductionEngineer, Sign_HOFProduction
      FROM DailyProductionReport WHERE 1=1
    `;
    const request = new sql.Request();
    if (machineShop) { request.input('machineShop', sql.NVarChar(50), String(machineShop)); query += ` AND MachineShop = @machineShop`; }
    if (lineCode) { request.input('lineCode', sql.NVarChar(50), lineCode); query += ` AND lineCode = @lineCode`; }
    if (date) { request.input('reportDate', sql.NVarChar(50), String(date).split('T')[0]); query += ` AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)`; }
    if (shift) { request.input('shift', sql.NVarChar(10), shift); query += ` AND Shift = @shift`; }
    if (machineNo) { request.input('machineNo', sql.NVarChar(50), String(machineNo)); query += ` AND MachineNo = @machineNo`; }
    query += ` ORDER BY Id ASC`;

    const result = await request.query(query);
    const rows = result.recordset;
    if (rows.length === 0) return res.status(200).json([]);

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
      time: { from: r.TimeFrom || "", to: r.TimeTo || "" },
    }));

    const partTokens = String(first.PartNameNo || "").split("/");
    const structuredRecord = {
      header: {
        machineShop: first.MachineShop,
        lineCode: first.lineCode,
        partName: partTokens[0] ? partTokens[0].trim() : "",
        partNo: partTokens[1] ? partTokens[1].trim() : "",
        date: first.ReportDate,
        shift: first.Shift || "I",
        shiftInchargeName: first.ShiftInchargeName || "",
        partTraceabilityMachining: first.PartTraceabilityMachining || "",
      },
      rows: structuredRows,
      signatures: {
        shiftSupervisorProduction: first.Sign_SupervisorProduction || "",
        shiftSupervisorQuality: first.Sign_SupervisorQuality || "",
        productionEngineer: first.Sign_ProductionEngineer || "",
        hofProduction: first.Sign_HOFProduction || "",
      },
      status: "Pending",
    };

    return res.status(200).json([structuredRecord]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch records' });
  }
};

// ============================================================
// 14. PDF REPORT GENERATOR (SUPPORTS RANGE OR SPECIFIC REPORT)
// ============================================================
const generateReport = async (req, res) => {
  try {
    const { fromDate, toDate, lineCode, date, shift, shopId } = req.query;

    const request = new sql.Request();
    let query = `
      SELECT Id, MachineShop, lineCode, PartTraceabilityMachining, FORMAT(ReportDate, 'yyyy-MM-dd') AS ReportDate, Shift, ShiftInchargeName, MachineNo, MachineName, PartNameNo, OperationDescription, OperatorName, Produced, Accepted, HoldNonConformance, ReasonForHold_Casting, ReasonForHold_CastingQty, ReasonForHold_Machining, ReasonForHold_MachiningQty, McStopTimeReason, CONVERT(VARCHAR(5), TimeFrom, 108) AS TimeFrom, CONVERT(VARCHAR(5), TimeTo, 108) AS TimeTo, Sign_SupervisorProduction, Sign_SupervisorQuality, Sign_ProductionEngineer, Sign_HOFProduction
      FROM DailyProductionReport
      WHERE 1=1
    `;

    if (lineCode && date) {
      request.input('lineCode', sql.NVarChar(50), lineCode);
      request.input('reportDate', sql.NVarChar(50), String(date).split('T')[0]);
      query += ` AND lineCode = @lineCode AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)`;
      if (shift) {
        request.input('shift', sql.NVarChar(10), shift);
        query += ` AND Shift = @shift`;
      }
    } else if (fromDate && toDate) {
      request.input('fromDate', sql.NVarChar(50), String(fromDate).split('T')[0]);
      request.input('toDate', sql.NVarChar(50), String(toDate).split('T')[0]);
      query += ` AND CONVERT(date, ReportDate) >= CONVERT(date, @fromDate) AND CONVERT(date, ReportDate) <= CONVERT(date, @toDate)`;
    } else {
      return res.status(400).send("Either (fromDate and toDate) or (lineCode and date) are required.");
    }

    if (shopId) {
      request.input('machineShop', sql.NVarChar(50), String(shopId));
      query += ` AND MachineShop = @machineShop`;
    }

    query += ` ORDER BY ReportDate ASC, lineCode ASC, Shift ASC, Id ASC`;

    const result = await request.query(query);
    const records = result.recordset;
    if (!records || records.length === 0) return res.status(404).send("No records found for the selected criteria.");

    // ========================================================
    // FETCH DYNAMIC QF HISTORY
    // ========================================================
    let qfHistory = [];
    try {
      const qfRes = await sql.query(`
        SELECT id, formName, qfValue, date
        FROM DailyProductionReportQFvalues
        ORDER BY date DESC, id DESC
      `);
      qfHistory = qfRes.recordset || [];
    } catch (qfErr) {
      console.error("Warning: Could not fetch DailyProductionReportQFvalues:", qfErr.message);
    }

    const getEffectiveQfValue = (recordDateStr) => {
      const fallback = "QF/07/MPD-10, Rev.No: 00 dt 01.07.2021";
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

    const groupedMap = new Map();
    records.forEach(r => {
      const groupKey = `${r.lineCode}_${r.ReportDate}_${r.Shift}`;
      if (!groupedMap.has(groupKey)) groupedMap.set(groupKey, []);
      groupedMap.get(groupKey).push(r);
    });

    const groups = Array.from(groupedMap.values());
    const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true, autoPageBreak: false });
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Daily_Production_Report.pdf`);
    doc.pipe(res);

    const startX = 20;
    const totalWidth = doc.page.width - 40;
    const pageBottom = doc.page.height - 20;
    const topMargin = 20;

    const headers = ["M/C No", "Part Name / No", "Operator", "Prod", "Acc", "Hold", "Casting Reason", "Machining Reason", "Time", "M/C Stop Reason"];
    const fractions = [0.08, 0.16, 0.10, 0.05, 0.05, 0.06, 0.12, 0.12, 0.08, 0.18];
    const colWidths = fractions.map((f) => f * totalWidth);
    const pad = 3;
    const fontSize = 6.5;

    const computeEntryHeight = (groupRecords) => {
      const headerH = 34;
      const tableHeaderH = 15;
      const sigH = 38;
      let rowsH = 0;

      doc.font("Helvetica").fontSize(fontSize);
      groupRecords.forEach((r) => {
        let rowH = 14;
        const timeVal = (r.TimeFrom || r.TimeTo) ? `${r.TimeFrom || ''}-${r.TimeTo || ''}` : '-';
        const castHold = r.ReasonForHold_Casting ? `${r.ReasonForHold_Casting} (${r.ReasonForHold_CastingQty || 0})` : '-';
        const machHold = r.ReasonForHold_Machining ? `${r.ReasonForHold_Machining} (${r.ReasonForHold_MachiningQty || 0})` : '-';

        const rowCells = [
          r.MachineNo || "-", r.PartNameNo || "-", r.OperatorName || "-",
          r.Produced != null ? String(r.Produced) : "-", r.Accepted != null ? String(r.Accepted) : "-",
          r.HoldNonConformance || "-", castHold, machHold, timeVal, r.McStopTimeReason || "-"
        ];

        rowCells.forEach((c, i) => {
          const h = doc.heightOfString(String(c), { width: colWidths[i] - pad * 2 }) + 4;
          if (h > rowH) rowH = h;
        });
        rowsH += rowH;
      });

      return headerH + 4 + tableHeaderH + rowsH + sigH + 10;
    };

    const drawEntry = (groupRecords, entryY) => {
      const first = groupRecords[0];
      const [yy, mm, dd] = String(first.ReportDate).split('-');
      const displayDate = `${dd}/${mm}/${yy}`;
      const effectiveQf = getEffectiveQfValue(first.ReportDate);

      const headerH = 34;
      doc.lineWidth(0.8).strokeColor('black');
      doc.rect(startX, entryY, 90, headerH).stroke();

      const logoPath = path.join(__dirname, 'logo.jpg');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, startX + 5, entryY + 4, { width: 80, height: 26, fit: [80, 26], align: 'center', valign: 'center' });
      } else {
        doc.font("Helvetica-Bold").fontSize(10).fillColor('black').text("SAKTHI\nAUTO", startX, entryY + 8, { width: 90, align: "center" });
      }

      const rightBoxW = 200;
      const titleW = totalWidth - 90 - rightBoxW;
      doc.rect(startX + 90, entryY, titleW, headerH).stroke();
      doc.font("Helvetica-Bold").fontSize(11).fillColor('black').text("DAILY PRODUCTION REPORT (MACHINE SHOP)", startX + 90, entryY + 12, { width: titleW, align: "center" });

      doc.rect(startX + totalWidth - rightBoxW, entryY, rightBoxW, headerH).stroke();
      doc.font("Helvetica-Bold").fontSize(7).fillColor('black').text(effectiveQf, startX + totalWidth - rightBoxW, entryY + 4, { width: rightBoxW, align: "center" });
      doc.font("Helvetica-Bold").fontSize(7.5).text(`LINE: ${first.lineCode} | SHIFT: ${first.Shift || 'I'}`, startX + totalWidth - rightBoxW, entryY + 14, { width: rightBoxW, align: "center" });
      doc.font("Helvetica").fontSize(7).text(`DATE: ${displayDate}`, startX + totalWidth - rightBoxW, entryY + 24, { width: rightBoxW, align: "center" });

      let currY = entryY + headerH + 3;

      doc.font("Helvetica-Bold").fontSize(fontSize);
      let curX = startX;
      headers.forEach((h, i) => {
        doc.rect(curX, currY, colWidths[i], 15).fillAndStroke('#f0f0f0', 'black');
        doc.fillColor('black').text(h, curX + pad, currY + 4, { width: colWidths[i] - pad * 2, align: "center" });
        curX += colWidths[i];
      });
      currY += 15;

      doc.font("Helvetica").fontSize(fontSize);
      doc.lineWidth(0.5).strokeColor('black');

      let opSig = '', qcSig = '', peSig = '', hofSig = '';

      groupRecords.forEach((r) => {
        const timeVal = (r.TimeFrom || r.TimeTo) ? `${r.TimeFrom || ''}-${r.TimeTo || ''}` : '-';
        const castHold = r.ReasonForHold_Casting ? `${r.ReasonForHold_Casting} (${r.ReasonForHold_CastingQty || 0})` : '-';
        const machHold = r.ReasonForHold_Machining ? `${r.ReasonForHold_Machining} (${r.ReasonForHold_MachiningQty || 0})` : '-';

        const rowCells = [
          r.MachineNo || "-", r.PartNameNo || "-", r.OperatorName || "-",
          r.Produced != null ? String(r.Produced) : "-", r.Accepted != null ? String(r.Accepted) : "-",
          r.HoldNonConformance || "-", castHold, machHold, timeVal, r.McStopTimeReason || "-"
        ];

        let rowH = 14;
        rowCells.forEach((c, i) => {
          const h = doc.heightOfString(String(c), { width: colWidths[i] - pad * 2 }) + 4;
          if (h > rowH) rowH = h;
        });

        let x = startX;
        rowCells.forEach((c, i) => {
          doc.rect(x, currY, colWidths[i], rowH).stroke();
          doc.fillColor('black').text(String(c), x + pad, currY + 3, { width: colWidths[i] - pad * 2, align: "center" });
          x += colWidths[i];
        });

        currY += rowH;

        if (!opSig && r.Sign_SupervisorProduction && !String(r.Sign_SupervisorProduction).includes('Pending')) opSig = r.Sign_SupervisorProduction;
        if (!qcSig && r.Sign_SupervisorQuality && !String(r.Sign_SupervisorQuality).includes('Pending')) qcSig = r.Sign_SupervisorQuality;
        if (!peSig && r.Sign_ProductionEngineer && !String(r.Sign_ProductionEngineer).includes('Pending')) peSig = r.Sign_ProductionEngineer;
        if (!hofSig && r.Sign_HOFProduction && !String(r.Sign_HOFProduction).includes('Pending')) hofSig = r.Sign_HOFProduction;
      });

      let sigY = currY + 4;
      const sigColWidth = totalWidth / 4;

      doc.lineWidth(0.5).strokeColor('black');
      doc.fillColor('black').font("Helvetica-Bold").fontSize(7).text("Shift Supervisor (Production)", startX, sigY, { width: sigColWidth - 10, align: "center" });
      doc.rect(startX + 8, sigY + 10, sigColWidth - 16, 20).stroke();
      doc.fillColor(opSig ? 'black' : 'red').font(opSig ? 'Helvetica-Bold' : 'Helvetica').fontSize(7).text(opSig ? String(opSig).toUpperCase() : "Pending", startX + 8, sigY + 16, { width: sigColWidth - 16, align: "center" });

      const qcX = startX + sigColWidth;
      doc.fillColor('black').font("Helvetica-Bold").fontSize(7).text("Shift Supervisor (Quality)", qcX, sigY, { width: sigColWidth - 10, align: "center" });
      doc.rect(qcX + 8, sigY + 10, sigColWidth - 16, 20).stroke();
      doc.fillColor(qcSig ? '#16a34a' : 'red').font('Helvetica-Bold').fontSize(7).text(qcSig ? `APPROVED` : "Pending", qcX + 8, sigY + 16, { width: sigColWidth - 16, align: "center" });

      const peX = startX + sigColWidth * 2;
      doc.fillColor('black').font("Helvetica-Bold").fontSize(7).text("Production Engineer", peX, sigY, { width: sigColWidth - 10, align: "center" });
      doc.rect(peX + 8, sigY + 10, sigColWidth - 16, 20).stroke();
      doc.fillColor(peSig ? '#16a34a' : 'red').font('Helvetica-Bold').fontSize(7).text(peSig ? `APPROVED` : "Pending", peX + 8, sigY + 16, { width: sigColWidth - 16, align: "center" });

      const hofX = startX + sigColWidth * 3;
      doc.fillColor('black').font("Helvetica-Bold").fontSize(7).text("HOF - Production", hofX, sigY, { width: sigColWidth - 10, align: "center" });
      doc.rect(hofX + 8, sigY + 10, sigColWidth - 16, 20).stroke();
      doc.fillColor(hofSig ? '#16a34a' : 'red').font('Helvetica-Bold').fontSize(7).text(hofSig ? `APPROVED` : "Pending", hofX + 8, sigY + 16, { width: sigColWidth - 16, align: "center" });

      return sigY + 34;
    };

    let currentY = topMargin;
    let isFirstOnPage = true;

    groups.forEach((groupRecords) => {
      const entryH = computeEntryHeight(groupRecords);
      if (!isFirstOnPage && (currentY + entryH > pageBottom)) {
        doc.addPage();
        currentY = topMargin;
        isFirstOnPage = true;
      }

      if (!isFirstOnPage) {
        doc.save().lineWidth(0.5).dash(3, { space: 3 }).strokeColor('#9ca3af').moveTo(startX, currentY - 4).lineTo(startX + totalWidth, currentY - 4).stroke().restore();
      }

      const endY = drawEntry(groupRecords, currentY);
      currentY = endY + 10;
      isFirstOnPage = false;
    });

    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: "PDF generation failed" });
    else res.end();
  }
};

// ============================================================
// PDF GENERATION - SINGLE DAY / ENTRY
// ============================================================
const generateDailyProductionDayReport = async (req, res) => {
  try {
    const { lineCode, date, shift, shopId } = req.query;

    if (!lineCode || !date) {
      return res.status(400).json({ error: "lineCode and date are required" });
    }

    const cleanDate = String(date).split('T')[0];
    const request = new sql.Request();
    request.input('lineCode', sql.NVarChar(50), lineCode);
    request.input('reportDate', sql.NVarChar(50), cleanDate);

    let query = `
      SELECT Id, MachineShop, lineCode, PartTraceabilityMachining, FORMAT(ReportDate, 'yyyy-MM-dd') AS ReportDate, Shift, ShiftInchargeName, MachineNo, MachineName, PartNameNo, OperationDescription, OperatorName, Produced, Accepted, HoldNonConformance, ReasonForHold_Casting, ReasonForHold_CastingQty, ReasonForHold_Machining, ReasonForHold_MachiningQty, McStopTimeReason, CONVERT(VARCHAR(5), TimeFrom, 108) AS TimeFrom, CONVERT(VARCHAR(5), TimeTo, 108) AS TimeTo, Sign_SupervisorProduction, Sign_SupervisorQuality, Sign_ProductionEngineer, Sign_HOFProduction
      FROM DailyProductionReport
      WHERE lineCode = @lineCode AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)
    `;

    if (shift) {
      request.input('shift', sql.NVarChar(10), shift);
      query += ` AND Shift = @shift`;
    }

    if (shopId) {
      request.input('machineShop', sql.NVarChar(50), String(shopId));
      query += ` AND MachineShop = @machineShop`;
    }

    query += ` ORDER BY Shift ASC, Id ASC`;

    const result = await request.query(query);
    const records = result.recordset;

    if (!records || records.length === 0) {
      return res.status(404).json({ error: "No records found for the selected date." });
    }

    // ========================================================
    // FETCH DYNAMIC QF HISTORY
    // ========================================================
    let qfHistory = [];
    try {
      const qfRes = await sql.query(`
        SELECT id, formName, qfValue, date
        FROM DailyProductionReportQFvalues
        ORDER BY date DESC, id DESC
      `);
      qfHistory = qfRes.recordset || [];
    } catch (qfErr) {
      console.error("Warning: Could not fetch DailyProductionReportQFvalues:", qfErr.message);
    }

    const getEffectiveQfValue = (recordDateStr) => {
      const fallback = "QF/07/MPD-10, Rev.No: 00 dt 01.07.2021";
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

    const groupedMap = new Map();
    records.forEach(r => {
      const groupKey = `${r.lineCode}_${r.ReportDate}_${r.Shift}`;
      if (!groupedMap.has(groupKey)) groupedMap.set(groupKey, []);
      groupedMap.get(groupKey).push(r);
    });

    const groups = Array.from(groupedMap.values());
    const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true, autoPageBreak: false });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=Daily_Production_${lineCode}_${cleanDate}.pdf`);
    doc.pipe(res);

    const startX = 20;
    const totalWidth = doc.page.width - 40;
    const pageBottom = doc.page.height - 20;
    const topMargin = 20;

    const headers = ["M/C No", "Part Name / No", "Operator", "Prod", "Acc", "Hold", "Casting Reason", "Machining Reason", "Time", "M/C Stop Reason"];
    const fractions = [0.08, 0.16, 0.10, 0.05, 0.05, 0.06, 0.12, 0.12, 0.08, 0.18];
    const colWidths = fractions.map((f) => f * totalWidth);
    const pad = 3;
    const fontSize = 6.5;

    const computeEntryHeight = (groupRecords) => {
      const headerH = 34;
      const tableHeaderH = 15;
      const sigH = 38;
      let rowsH = 0;

      doc.font("Helvetica").fontSize(fontSize);
      groupRecords.forEach((r) => {
        let rowH = 14;
        const timeVal = (r.TimeFrom || r.TimeTo) ? `${r.TimeFrom || ''}-${r.TimeTo || ''}` : '-';
        const castHold = r.ReasonForHold_Casting ? `${r.ReasonForHold_Casting} (${r.ReasonForHold_CastingQty || 0})` : '-';
        const machHold = r.ReasonForHold_Machining ? `${r.ReasonForHold_Machining} (${r.ReasonForHold_MachiningQty || 0})` : '-';

        const rowCells = [
          r.MachineNo || "-", r.PartNameNo || "-", r.OperatorName || "-",
          r.Produced != null ? String(r.Produced) : "-", r.Accepted != null ? String(r.Accepted) : "-",
          r.HoldNonConformance || "-", castHold, machHold, timeVal, r.McStopTimeReason || "-"
        ];

        rowCells.forEach((c, i) => {
          const h = doc.heightOfString(String(c), { width: colWidths[i] - pad * 2 }) + 4;
          if (h > rowH) rowH = h;
        });
        rowsH += rowH;
      });

      return headerH + 4 + tableHeaderH + rowsH + sigH + 10;
    };

    const drawEntry = (groupRecords, entryY) => {
      const first = groupRecords[0];
      const [yy, mm, dd] = String(first.ReportDate).split('-');
      const displayDate = `${dd}/${mm}/${yy}`;
      const effectiveQf = getEffectiveQfValue(first.ReportDate);

      const headerH = 34;
      doc.lineWidth(0.8).strokeColor('black');
      doc.rect(startX, entryY, 90, headerH).stroke();

      const logoPath = path.join(__dirname, 'logo.jpg');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, startX + 5, entryY + 4, { width: 80, height: 26, fit: [80, 26], align: 'center', valign: 'center' });
      } else {
        doc.font("Helvetica-Bold").fontSize(10).fillColor('black').text("SAKTHI\nAUTO", startX, entryY + 8, { width: 90, align: "center" });
      }

      const rightBoxW = 200;
      const titleW = totalWidth - 90 - rightBoxW;
      doc.rect(startX + 90, entryY, titleW, headerH).stroke();
      doc.font("Helvetica-Bold").fontSize(11).fillColor('black').text("DAILY PRODUCTION REPORT (MACHINE SHOP)", startX + 90, entryY + 12, { width: titleW, align: "center" });

      doc.rect(startX + totalWidth - rightBoxW, entryY, rightBoxW, headerH).stroke();
      doc.font("Helvetica-Bold").fontSize(7).fillColor('black').text(effectiveQf, startX + totalWidth - rightBoxW, entryY + 4, { width: rightBoxW, align: "center" });
      doc.font("Helvetica-Bold").fontSize(7.5).text(`LINE: ${first.lineCode} | SHIFT: ${first.Shift || 'I'}`, startX + totalWidth - rightBoxW, entryY + 14, { width: rightBoxW, align: "center" });
      doc.font("Helvetica").fontSize(7).text(`DATE: ${displayDate}`, startX + totalWidth - rightBoxW, entryY + 24, { width: rightBoxW, align: "center" });

      let currY = entryY + headerH + 3;

      doc.font("Helvetica-Bold").fontSize(fontSize);
      let curX = startX;
      headers.forEach((h, i) => {
        doc.rect(curX, currY, colWidths[i], 15).fillAndStroke('#f0f0f0', 'black');
        doc.fillColor('black').text(h, curX + pad, currY + 4, { width: colWidths[i] - pad * 2, align: "center" });
        curX += colWidths[i];
      });
      currY += 15;

      doc.font("Helvetica").fontSize(fontSize);
      doc.lineWidth(0.5).strokeColor('black');

      let opSig = '', qcSig = '', peSig = '', hofSig = '';

      groupRecords.forEach((r) => {
        const timeVal = (r.TimeFrom || r.TimeTo) ? `${r.TimeFrom || ''}-${r.TimeTo || ''}` : '-';
        const castHold = r.ReasonForHold_Casting ? `${r.ReasonForHold_Casting} (${r.ReasonForHold_CastingQty || 0})` : '-';
        const machHold = r.ReasonForHold_Machining ? `${r.ReasonForHold_Machining} (${r.ReasonForHold_MachiningQty || 0})` : '-';

        const rowCells = [
          r.MachineNo || "-", r.PartNameNo || "-", r.OperatorName || "-",
          r.Produced != null ? String(r.Produced) : "-", r.Accepted != null ? String(r.Accepted) : "-",
          r.HoldNonConformance || "-", castHold, machHold, timeVal, r.McStopTimeReason || "-"
        ];

        let rowH = 14;
        rowCells.forEach((c, i) => {
          const h = doc.heightOfString(String(c), { width: colWidths[i] - pad * 2 }) + 4;
          if (h > rowH) rowH = h;
        });

        let x = startX;
        rowCells.forEach((c, i) => {
          doc.rect(x, currY, colWidths[i], rowH).stroke();
          doc.fillColor('black').text(String(c), x + pad, currY + 3, { width: colWidths[i] - pad * 2, align: "center" });
          x += colWidths[i];
        });

        currY += rowH;

        if (!opSig && r.Sign_SupervisorProduction && !String(r.Sign_SupervisorProduction).includes('Pending')) opSig = r.Sign_SupervisorProduction;
        if (!qcSig && r.Sign_SupervisorQuality && !String(r.Sign_SupervisorQuality).includes('Pending')) qcSig = r.Sign_SupervisorQuality;
        if (!peSig && r.Sign_ProductionEngineer && !String(r.Sign_ProductionEngineer).includes('Pending')) peSig = r.Sign_ProductionEngineer;
        if (!hofSig && r.Sign_HOFProduction && !String(r.Sign_HOFProduction).includes('Pending')) hofSig = r.Sign_HOFProduction;
      });

      let sigY = currY + 4;
      const sigColWidth = totalWidth / 4;

      doc.lineWidth(0.5).strokeColor('black');
      doc.fillColor('black').font("Helvetica-Bold").fontSize(7).text("Shift Supervisor (Production)", startX, sigY, { width: sigColWidth - 10, align: "center" });
      doc.rect(startX + 8, sigY + 10, sigColWidth - 16, 20).stroke();
      doc.fillColor(opSig ? 'black' : 'red').font(opSig ? 'Helvetica-Bold' : 'Helvetica').fontSize(7).text(opSig ? String(opSig).toUpperCase() : "Pending", startX + 8, sigY + 16, { width: sigColWidth - 16, align: "center" });

      const qcX = startX + sigColWidth;
      doc.fillColor('black').font("Helvetica-Bold").fontSize(7).text("Shift Supervisor (Quality)", qcX, sigY, { width: sigColWidth - 10, align: "center" });
      doc.rect(qcX + 8, sigY + 10, sigColWidth - 16, 20).stroke();
      doc.fillColor(qcSig ? '#16a34a' : 'red').font('Helvetica-Bold').fontSize(7).text(qcSig ? `APPROVED` : "Pending", qcX + 8, sigY + 16, { width: sigColWidth - 16, align: "center" });

      const peX = startX + sigColWidth * 2;
      doc.fillColor('black').font("Helvetica-Bold").fontSize(7).text("Production Engineer", peX, sigY, { width: sigColWidth - 10, align: "center" });
      doc.rect(peX + 8, sigY + 10, sigColWidth - 16, 20).stroke();
      doc.fillColor(peSig ? '#16a34a' : 'red').font('Helvetica-Bold').fontSize(7).text(peSig ? `APPROVED` : "Pending", peX + 8, sigY + 16, { width: sigColWidth - 16, align: "center" });

      const hofX = startX + sigColWidth * 3;
      doc.fillColor('black').font("Helvetica-Bold").fontSize(7).text("HOF - Production", hofX, sigY, { width: sigColWidth - 10, align: "center" });
      doc.rect(hofX + 8, sigY + 10, sigColWidth - 16, 20).stroke();
      doc.fillColor(hofSig ? '#16a34a' : 'red').font('Helvetica-Bold').fontSize(7).text(hofSig ? `APPROVED` : "Pending", hofX + 8, sigY + 16, { width: sigColWidth - 16, align: "center" });

      return sigY + 34;
    };

    let currentY = topMargin;
    let isFirstOnPage = true;

    groups.forEach((groupRecords) => {
      const entryH = computeEntryHeight(groupRecords);
      if (!isFirstOnPage && (currentY + entryH > pageBottom)) {
        doc.addPage();
        currentY = topMargin;
        isFirstOnPage = true;
      }

      if (!isFirstOnPage) {
        doc.save().lineWidth(0.5).dash(3, { space: 3 }).strokeColor('#9ca3af').moveTo(startX, currentY - 4).lineTo(startX + totalWidth, currentY - 4).stroke().restore();
      }

      const endY = drawEntry(groupRecords, currentY);
      currentY = endY + 10;
      isFirstOnPage = false;
    });

    doc.end();
  } catch (err) {
    console.error("Daily Production Day PDF error:", err);
    if (!res.headersSent) res.status(500).json({ error: "PDF generation failed" });
    else res.end();
  }
};

module.exports = {
  getMachineShopDetails,
  saveDailyProductionReport,
  getDailyProductionRecords,
  getQcReports,
  getPeReports,
  getHofReports,
  signQcApproval,
  signPeApproval,
  signHofApproval,
  generateReport,
  generateDailyProductionDayReport, 
  getPartTraceability,
  getIncharges,
  getPeIncharges,
  getHofIncharges
};