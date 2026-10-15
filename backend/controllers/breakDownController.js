const sql = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ============================================================
// 1. SAVE / SUBMIT BREAKDOWN INTIMATION REPORT
// ============================================================
const saveBreakdownIntimationReport = async (req, res) => {
  const {
    basicInfo,
    natureOfFailure,
    observation,
    correctiveAction,
    workCompleted,
    performanceReport,
    timeLoss,
    workers,
    spares,
    shopId,
  } = req.body;

  let transaction;
  try {
    transaction = new sql.Transaction();
    await transaction.begin();

    const machineShopId = parseInt(shopId || basicInfo?.machineShop || 3, 10);
    const lineCode = basicInfo?.lineNo || basicInfo?.lineCode || '';
    const reportDate = basicInfo?.date ? String(basicInfo.date).split('T')[0] : null;
    const workCompletedDate = workCompleted?.date ? String(workCompleted.date).split('T')[0] : null;
    const perfDate = performanceReport?.date ? String(performanceReport.date).split('T')[0] : null;

    const inchargeSig = natureOfFailure?.inchargeSignature || '';
    const peWorkSig = workCompleted?.signature || 'Pending';
    const pePerfSig = performanceReport?.signature || 'Pending';

    const isFullyApproved =
      peWorkSig &&
      peWorkSig !== 'Pending' &&
      pePerfSig &&
      pePerfSig !== 'Pending';

    const status = isFullyApproved ? 'Completed' : 'Submitted';

    const insertResult = await transaction
      .request()
      .input('machineShop', sql.Int, machineShopId)
      .input('lineCode', sql.NVarChar(100), lineCode)
      .input('plantName', sql.NVarChar(100), basicInfo?.plantName || '')
      .input('machineNo', sql.NVarChar(100), basicInfo?.machineNo || '')
      .input('reportDate', sql.Date, reportDate)
      .input('shift', sql.NVarChar(20), basicInfo?.shift || 'I')
      .input('reportTime', sql.NVarChar(50), basicInfo?.time || '')
      .input('categoryMechanical', sql.Bit, basicInfo?.category?.mechanical ? 1 : 0)
      .input('categoryElectrical', sql.Bit, basicInfo?.category?.electrical ? 1 : 0)

      .input('failureDescription', sql.NVarChar(sql.MAX), natureOfFailure?.description || '')
      .input('inchargeSignature', sql.NVarChar(200), inchargeSig)

      .input('observationStartTime', sql.NVarChar(50), observation?.workStartTime || '')
      .input('observationDescription', sql.NVarChar(sql.MAX), observation?.description || '')

      .input('correctiveActionType', sql.NVarChar(50), correctiveAction?.actionType || 'Electrical')
      .input('correctiveActionDescription', sql.NVarChar(sql.MAX), correctiveAction?.description || '')

      .input('workCompletedDate', sql.Date, workCompletedDate)
      .input('workCompletedTime', sql.NVarChar(50), workCompleted?.time || '')
      .input('assignedPeWork', sql.NVarChar(100), workCompleted?.assignedPe || '')
      .input('workCompletedSignature', sql.NVarChar(200), peWorkSig)

      .input('performanceReportDate', sql.Date, perfDate)
      .input('performanceReportTime', sql.NVarChar(50), performanceReport?.time || '')
      .input('assignedPePerformance', sql.NVarChar(100), performanceReport?.assignedPe || '')
      .input('performanceReportSignature', sql.NVarChar(200), pePerfSig)

      .input('timeLossDetailsOt', sql.NVarChar(sql.MAX), timeLoss?.detailsOfOt || '')
      .input('timeLossData', sql.NVarChar(sql.MAX), timeLoss ? JSON.stringify(timeLoss) : '')
      .input('workersData', sql.NVarChar(sql.MAX), workers ? JSON.stringify(workers) : '')
      .input('sparesData', sql.NVarChar(sql.MAX), spares ? JSON.stringify(spares) : '')
      .input('status', sql.NVarChar(50), status)
      .query(`
        INSERT INTO BreakdownIntimationReport (
          machineShop, lineCode, plantName, machineNo,
          reportDate, shift, reportTime, categoryMechanical, categoryElectrical,
          failureDescription, inchargeSignature,
          observationStartTime, observationDescription,
          correctiveActionType, correctiveActionDescription,
          workCompletedDate, workCompletedTime, assignedPeWork, workCompletedSignature,
          performanceReportDate, performanceReportTime, assignedPePerformance, performanceReportSignature,
          timeLossDetailsOt, timeLossData, workersData, sparesData, status
        )
        OUTPUT INSERTED.id
        VALUES (
          @machineShop, @lineCode, @plantName, @machineNo,
          @reportDate, @shift, @reportTime, @categoryMechanical, @categoryElectrical,
          @failureDescription, @inchargeSignature,
          @observationStartTime, @observationDescription,
          @correctiveActionType, @correctiveActionDescription,
          @workCompletedDate, @workCompletedTime, @assignedPeWork, @workCompletedSignature,
          @performanceReportDate, @performanceReportTime, @assignedPePerformance, @performanceReportSignature,
          @timeLossDetailsOt, @timeLossData, @workersData, @sparesData, @status
        )
      `);

    await transaction.commit();
    const newId = insertResult.recordset[0].id;

    return res.status(201).json({
      message: 'Breakdown Intimation / Service Report saved successfully!',
      reportId: newId,
    });
  } catch (err) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) {}
    }
    console.error('Error saving Breakdown Intimation Report:', err);
    return res.status(500).json({ error: 'Failed to save Breakdown Intimation Report' });
  }
};

// ============================================================
// 2. GET BREAKDOWN REPORTS (FILTERING)
// ============================================================
const getBreakdownIntimationReports = async (req, res) => {
  const { lineCode, machineNo, date, shift, shopId } = req.query;

  try {
    let query = `SELECT * FROM BreakdownIntimationReport WHERE 1=1`;
    const request = new sql.Request();

    if (shopId) {
      request.input('machineShop', sql.Int, parseInt(shopId, 10));
      query += ` AND machineShop = @machineShop`;
    }
    if (lineCode) {
      request.input('lineCode', sql.NVarChar(100), lineCode);
      query += ` AND lineCode = @lineCode`;
    }
    if (machineNo) {
      request.input('machineNo', sql.NVarChar(100), machineNo);
      query += ` AND machineNo = @machineNo`;
    }
    if (date) {
      request.input('reportDate', sql.Date, String(date).split('T')[0]);
      query += ` AND reportDate = @reportDate`;
    }
    if (shift) {
      request.input('shift', sql.NVarChar(20), shift);
      query += ` AND shift = @shift`;
    }

    query += ` ORDER BY id DESC`;

    const result = await request.query(query);
    const records = result.recordset.map((r) => ({
      ...r,
      timeLoss: r.timeLossData ? JSON.parse(r.timeLossData) : null,
      workers: r.workersData ? JSON.parse(r.workersData) : [],
      spares: r.sparesData ? JSON.parse(r.sparesData) : [],
    }));

    return res.status(200).json(records);
  } catch (err) {
    console.error('Error fetching Breakdown Reports:', err);
    return res.status(500).json({ error: 'Failed to fetch Breakdown Reports' });
  }
};

// ============================================================
// 3. GET PE PENDING BREAKDOWN REPORTS
// ============================================================
const getPePendingBreakdownReports = async (req, res) => {
  try {
    const { name } = req.params;
    const { shopId } = req.query;
    const request = new sql.Request();
    request.input('peName', sql.NVarChar(100), String(name || '').trim());

    let shopFilter = '';
    if (shopId) {
      request.input('machineShop', sql.Int, parseInt(shopId, 10));
      shopFilter = ' AND machineShop = @machineShop';
    }

    const result = await request.query(`
      SELECT 
        id,
        machineShop,
        lineCode,
        plantName,
        machineNo,
        FORMAT(reportDate, 'yyyy-MM-dd') AS reportDate,
        shift,
        inchargeSignature AS shiftInchargeName,
        assignedPeWork,
        assignedPePerformance,
        workCompletedSignature,
        performanceReportSignature,
        status
      FROM BreakdownIntimationReport
      WHERE (workCompletedSignature IS NULL OR workCompletedSignature = '' OR workCompletedSignature = 'Pending'
             OR performanceReportSignature IS NULL OR performanceReportSignature = '' OR performanceReportSignature = 'Pending')
        AND (assignedPeWork = @peName OR assignedPePerformance = @peName OR @peName = '')
        ${shopFilter}
      ORDER BY reportDate DESC, id DESC
    `);

    return res.status(200).json(result.recordset);
  } catch (err) {
    console.error('PE Breakdown Pending Fetch Error:', err);
    return res.status(500).json({ message: 'DB error' });
  }
};

// ============================================================
// 4. SIGN PE APPROVAL
// ============================================================
const signPeBreakdownReport = async (req, res) => {
  try {
    const { id, lineCode, date, signature, peUsername } = req.body;
    const signVal = signature || peUsername || 'Approved';

    const request = new sql.Request();
    request.input('signature', sql.NVarChar(200), signVal);

    let query = `
      UPDATE BreakdownIntimationReport
      SET 
        workCompletedSignature = @signature,
        performanceReportSignature = @signature,
        status = 'Completed'
      WHERE 1=1
    `;

    if (id) {
      request.input('id', sql.Int, id);
      query += ` AND id = @id`;
    } else if (lineCode && date) {
      request.input('lineCode', sql.NVarChar(100), lineCode);
      request.input('reportDate', sql.Date, String(date).split('T')[0]);
      query += ` AND lineCode = @lineCode AND reportDate = @reportDate`;
    }

    const result = await request.query(query);
    if (!result.rowsAffected[0]) {
      return res.status(404).json({ message: 'No pending record found to approve' });
    }

    return res.status(200).json({ success: true, message: 'Breakdown Report approved by PE successfully!' });
  } catch (err) {
    console.error('Sign PE Breakdown Error:', err);
    return res.status(500).json({ message: 'Failed to approve Breakdown Report' });
  }
};

// ============================================================
// 5. GENERATE PDF REPORT (EXACT FORM LAYOUT MATCHING PHYSICAL SHEET)
// ============================================================
const generateBreakdownPdfReport = async (req, res) => {
  try {
    const { fromDate, toDate, shopId, lineCode, date } = req.query;

    const request = new sql.Request();
    let query = `
      SELECT 
        id, machineShop, lineCode, plantName, machineNo,
        FORMAT(reportDate, 'yyyy-MM-dd') AS reportDate,
        shift, reportTime, categoryMechanical, categoryElectrical,
        failureDescription, inchargeSignature,
        observationStartTime, observationDescription,
        correctiveActionType, correctiveActionDescription,
        FORMAT(workCompletedDate, 'yyyy-MM-dd') AS workCompletedDate,
        workCompletedTime, assignedPeWork, workCompletedSignature,
        FORMAT(performanceReportDate, 'yyyy-MM-dd') AS performanceReportDate,
        performanceReportTime, assignedPePerformance, performanceReportSignature,
        timeLossDetailsOt, timeLossData, workersData, sparesData
      FROM BreakdownIntimationReport
      WHERE 1=1
    `;

    if (fromDate && toDate) {
      const cleanFrom = String(fromDate).split('T')[0];
      const cleanTo = String(toDate).split('T')[0];
      request.input('fromDate', sql.Date, cleanFrom);
      request.input('toDate', sql.Date, cleanTo);
      query += ` AND reportDate >= @fromDate AND reportDate <= @toDate`;
    } else if (date) {
      const cleanDate = String(date).split('T')[0];
      request.input('reportDate', sql.Date, cleanDate);
      query += ` AND reportDate = @reportDate`;
    } else {
      return res.status(400).send("fromDate and toDate (or date) are required.");
    }

    if (lineCode) {
      request.input('lineCode', sql.NVarChar(100), lineCode);
      query += ` AND lineCode = @lineCode`;
    }

    if (shopId) {
      request.input('machineShop', sql.Int, parseInt(shopId, 10));
      query += ` AND machineShop = @machineShop`;
    }

    query += ` ORDER BY reportDate ASC, lineCode ASC, shift ASC, id ASC`;

    const result = await request.query(query);
    const records = result.recordset;

    if (!records || records.length === 0) {
      return res.status(404).send("No records found for the selected parameters.");
    }

    // --- ADDED: Fetch QF History for Breakdown Intimation Report ---[cite: 3]
    let qfHistory = [];
    try {
      const qfRes = await sql.query(`
        SELECT id, formName, qfValue, date 
        FROM BreakdownIntimationQFvalues 
        ORDER BY date DESC, id DESC
      `);
      qfHistory = qfRes.recordset || [];
    } catch (qfErr) {
      console.error("Warning: Could not fetch BreakdownIntimationQFvalues:", qfErr.message);
    }

    const getEffectiveQfValue = (recordDateStr) => {
      const fallback = "QF/07/MRO-10, Rev. No.:01 dt 01.04.2022";
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
    // -------------------------------------------------------------

    // A4 Portrait layout to replicate the physical hard copy
    const doc = new PDFDocument({ margin: 25, size: "A4", layout: "portrait", bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Breakdown_Report_${fromDate || date}_to_${toDate || date}.pdf`
    );
    doc.pipe(res);

    const startX = 25;
    const pageWidth = doc.page.width - 50; // ~545pt
    const pad = 3;

    records.forEach((r, idx) => {
      if (idx > 0) doc.addPage();

      let currY = 25;
      const effectiveQf = getEffectiveQfValue(r.reportDate); // <-- Get dynamic QF value for record date

      // ----------------------------------------------------
      // TOP HEADER: Company Logo / Title
      // ----------------------------------------------------
      doc.font("Helvetica-Bold").fontSize(15).fillColor("black").text("SAKTHI", startX, currY);
      doc.fontSize(13).text("AUTO", startX, currY + 15);

      const titleBoxW = 280;
      const titleBoxX = startX + (pageWidth - titleBoxW) / 2;
      doc.lineWidth(1).strokeColor("black").roundedRect(titleBoxX, currY + 10, titleBoxW, 20, 4).stroke();
      doc.font("Helvetica-Bold").fontSize(9).text("BREAKDOWN INTIMATION / SERVICE REPORT", titleBoxX, currY + 16, { width: titleBoxW, align: "center" });

      currY += 38;

      // ----------------------------------------------------
      // 1. BASIC INFORMATION & CATEGORY OF COMPLAINT
      // ----------------------------------------------------
      const infoBoxH = 60;
      doc.lineWidth(0.8).rect(startX, currY, pageWidth, infoBoxH).stroke();

      const [yy, mm, dd] = String(r.reportDate || '').split('-');
      const displayDate = dd && mm && yy ? `${dd}/${mm}/${yy}` : (r.reportDate || '-');

      doc.font("Helvetica-Bold").fontSize(8);
      // Left Column
      doc.text("Plant Name :", startX + 6, currY + 6);
      doc.font("Helvetica").text(r.plantName || "-", startX + 65, currY + 6);

      doc.font("Helvetica-Bold").text("Line No :", startX + 6, currY + 20);
      doc.font("Helvetica").text(r.lineCode || "-", startX + 65, currY + 20);

      doc.font("Helvetica-Bold").text("Machine No :", startX + 6, currY + 34);
      doc.font("Helvetica").text(r.machineNo || "-", startX + 65, currY + 34);

      // Right Column
      const col2X = startX + 310;
      doc.font("Helvetica-Bold").text("Date :", col2X, currY + 6);
      doc.font("Helvetica").text(displayDate, col2X + 38, currY + 6);

      doc.font("Helvetica-Bold").text("Shift :", col2X, currY + 20);
      doc.font("Helvetica").text(r.shift || "-", col2X + 38, currY + 20);

      doc.font("Helvetica-Bold").text("Time :", col2X, currY + 34);
      doc.font("Helvetica").text(r.reportTime || "-", col2X + 38, currY + 34);

      // Category of Complaint Checkboxes
      doc.font("Helvetica-Bold").text("Category of Complaint :", startX + 6, currY + 47);
      
      const mechBoxX = startX + 115;
      doc.rect(mechBoxX, currY + 47, 7, 7).stroke();
      if (r.categoryMechanical) doc.font("Helvetica-Bold").fontSize(7).text("✓", mechBoxX + 1, currY + 47);
      doc.font("Helvetica").fontSize(8).text("Mechanical", mechBoxX + 12, currY + 47);

      const elecBoxX = mechBoxX + 85;
      doc.rect(elecBoxX, currY + 47, 7, 7).stroke();
      if (r.categoryElectrical) doc.font("Helvetica-Bold").fontSize(7).text("✓", elecBoxX + 1, currY + 47);
      doc.font("Helvetica").fontSize(8).text("Electrical", elecBoxX + 12, currY + 47);

      currY += infoBoxH + 4;

      // ----------------------------------------------------
      // 2. NATURE OF FAILURE & INCHARGE SIGNATURE
      // ----------------------------------------------------
      const nofH = 46;
      doc.lineWidth(0.8).rect(startX, currY, pageWidth, nofH).stroke();
      doc.font("Helvetica-Bold").fontSize(8).text("Nature of Failure :", startX + 6, currY + 4);
      doc.font("Helvetica").fontSize(8).text(r.failureDescription || "-", startX + 16, currY + 16, { width: pageWidth - 200, height: 26 });

      const inchargeApproved = r.inchargeSignature && !String(r.inchargeSignature).toLowerCase().includes("pending");
      doc.font("Helvetica-Bold").fontSize(7.5).text("Incharge Signature :", pageWidth - 145, currY + 14);
      doc.rect(pageWidth - 55, currY + 10, 75, 18).stroke();
      if (inchargeApproved) {
        doc.fillColor("#16a34a").font("Helvetica-Bold").fontSize(6.5).text(`✓ ${String(r.inchargeSignature).toUpperCase()}`, pageWidth - 55, currY + 15, { width: 75, align: "center" }).fillColor("black");
      } else {
        doc.fillColor("red").font("Helvetica").fontSize(7).text("Pending", pageWidth - 55, currY + 15, { width: 75, align: "center" }).fillColor("black");
      }

      currY += nofH + 4;

      // ----------------------------------------------------
      // 3. MAINTENANCE TEAM OBSERVATION
      // ----------------------------------------------------
      const obsH = 46;
      doc.lineWidth(0.8).rect(startX, currY, pageWidth, obsH).stroke();
      doc.font("Helvetica-Bold").fontSize(8).text("Maintenance Team Observation :", startX + 6, currY + 4);
      doc.font("Helvetica-Bold").text(`Work Start Time :  ${r.observationStartTime || '-'}`, pageWidth - 150, currY + 4);
      doc.font("Helvetica").fontSize(8).text(r.observationDescription || "-", startX + 16, currY + 16, { width: pageWidth - 32, height: 26 });

      currY += obsH + 4;

      // ----------------------------------------------------
      // 4. CORRECTIVE ACTION
      // ----------------------------------------------------
      const caH = 54;
      doc.lineWidth(0.8).rect(startX, currY, pageWidth, caH).stroke();
      doc.font("Helvetica-Bold").fontSize(8).text("Corrective action :", startX + 6, currY + 4);

      // Category Selector Box in Table Header
      const actionTypes = ["Electrical", "Mechanical", "Service"];
      const actBtnW = 60;
      let actBtnX = startX + 220;
      actionTypes.forEach((act) => {
        const isSelected = String(r.correctiveActionType || "").toLowerCase() === act.toLowerCase();
        doc.rect(actBtnX, currY + 3, actBtnW, 14).stroke();
        if (isSelected) {
          doc.rect(actBtnX, currY + 3, actBtnW, 14).fillAndStroke("#e5e7eb", "black");
          doc.fillColor("black").font("Helvetica-Bold").fontSize(7.5).text(act, actBtnX, currY + 6, { width: actBtnW, align: "center" });
        } else {
          doc.font("Helvetica").fontSize(7.5).text(act, actBtnX, currY + 6, { width: actBtnW, align: "center" });
        }
        actBtnX += actBtnW;
      });

      doc.font("Helvetica").fontSize(8).text(r.correctiveActionDescription || "-", startX + 16, currY + 22, { width: pageWidth - 32, height: 28 });

      currY += caH + 4;

      // ----------------------------------------------------
      // 5. WORK COMPLETED STATUS & MACHINE PERFORMANCE REPORT
      // ----------------------------------------------------
      const dualH = 46;
      const halfW = (pageWidth - 4) / 2;

      // Work Completed Box
      doc.lineWidth(0.8).rect(startX, currY, halfW, dualH).stroke();
      doc.font("Helvetica-Bold").fontSize(8).text("Work Completed status :", startX + 6, currY + 4);
      doc.font("Helvetica").fontSize(7.5).text(`Date : ${r.workCompletedDate || '-'}`, startX + 10, currY + 16);
      doc.text(`Time : ${r.workCompletedTime || '-'}`, startX + 10, currY + 28);

      const workPeApproved = r.workCompletedSignature && !String(r.workCompletedSignature).toLowerCase().includes("pending");
      doc.font("Helvetica-Bold").fontSize(7).text("PE Sign :", startX + halfW - 110, currY + 22);
      doc.rect(startX + halfW - 75, currY + 18, 70, 16).stroke();
      if (workPeApproved) {
        doc.fillColor("#16a34a").font("Helvetica-Bold").fontSize(6.5).text(`✓ ${String(r.workCompletedSignature).toUpperCase()}`, startX + halfW - 75, currY + 22, { width: 70, align: "center" }).fillColor("black");
      } else {
        doc.fillColor("red").font("Helvetica").fontSize(6.5).text("Pending", startX + halfW - 75, currY + 22, { width: 70, align: "center" }).fillColor("black");
      }

      // Machine Performance Box
      const rightBoxX = startX + halfW + 4;
      doc.lineWidth(0.8).rect(rightBoxX, currY, halfW, dualH).stroke();
      doc.font("Helvetica-Bold").fontSize(8).text("Machine Performance Report :", rightBoxX + 6, currY + 4);
      doc.font("Helvetica").fontSize(7.5).text(`Date : ${r.performanceReportDate || '-'}`, rightBoxX + 10, currY + 16);
      doc.text(`Time : ${r.performanceReportTime || '-'}`, rightBoxX + 10, currY + 28);

      const perfPeApproved = r.performanceReportSignature && !String(r.performanceReportSignature).toLowerCase().includes("pending");
      doc.font("Helvetica-Bold").fontSize(7).text("PE Sign :", rightBoxX + halfW - 110, currY + 22);
      doc.rect(rightBoxX + halfW - 75, currY + 18, 70, 16).stroke();
      if (perfPeApproved) {
        doc.fillColor("#16a34a").font("Helvetica-Bold").fontSize(6.5).text(`✓ ${String(r.performanceReportSignature).toUpperCase()}`, rightBoxX + halfW - 75, currY + 22, { width: 70, align: "center" }).fillColor("black");
      } else {
        doc.fillColor("red").font("Helvetica").fontSize(6.5).text("Pending", rightBoxX + halfW - 75, currY + 22, { width: 70, align: "center" }).fillColor("black");
      }

      currY += dualH + 4;

      // ----------------------------------------------------
      // 6. TIME LOSS IN MINUTES TABLE
      // ----------------------------------------------------
      doc.font("Helvetica-Bold").fontSize(8).text("Time Loss in Minutes :", startX, currY);
      currY += 10;

      let tlParsed = { from: {}, to: {}, timeLoss: {}, detailsOfOt: "" };
      try { tlParsed = r.timeLossData ? JSON.parse(r.timeLossData) : tlParsed; } catch (_) {}

      const tlCols = ["TD", "WM", "SS", "SP", "OT", "AT", "TT"];
      const metricColW = 85;
      const dataColW = (pageWidth - metricColW) / tlCols.length;
      const cellH = 13;

      // Table Header Row
      doc.rect(startX, currY, metricColW, cellH).fillAndStroke("#f3f4f6", "black");
      doc.fillColor("black").font("Helvetica-Bold").fontSize(7.5).text("", startX, currY + 3);

      tlCols.forEach((col, i) => {
        const xPos = startX + metricColW + i * dataColW;
        doc.rect(xPos, currY, dataColW, cellH).fillAndStroke("#f3f4f6", "black");
        doc.fillColor("black").font("Helvetica-Bold").fontSize(7.5).text(col, xPos, currY + 3, { width: dataColW, align: "center" });
      });
      currY += cellH;

      // From Row
      doc.rect(startX, currY, metricColW, cellH).stroke();
      doc.font("Helvetica-Bold").fontSize(7.5).text("From", startX + pad, currY + 3);
      tlCols.forEach((col, i) => {
        const xPos = startX + metricColW + i * dataColW;
        doc.rect(xPos, currY, dataColW, cellH).stroke();
        doc.font("Helvetica").fontSize(7.5).text(tlParsed.from?.[col.toLowerCase()] || "-", xPos, currY + 3, { width: dataColW, align: "center" });
      });
      currY += cellH;

      // To Row
      doc.rect(startX, currY, metricColW, cellH).stroke();
      doc.font("Helvetica-Bold").fontSize(7.5).text("To", startX + pad, currY + 3);
      tlCols.forEach((col, i) => {
        const xPos = startX + metricColW + i * dataColW;
        doc.rect(xPos, currY, dataColW, cellH).stroke();
        doc.font("Helvetica").fontSize(7.5).text(tlParsed.to?.[col.toLowerCase()] || "-", xPos, currY + 3, { width: dataColW, align: "center" });
      });
      currY += cellH;

      // Time Loss Row
      doc.rect(startX, currY, metricColW, cellH).stroke();
      doc.font("Helvetica-Bold").fontSize(7.5).text("Time Loss (Mins)", startX + pad, currY + 3);
      tlCols.forEach((col, i) => {
        const xPos = startX + metricColW + i * dataColW;
        doc.rect(xPos, currY, dataColW, cellH).stroke();
        doc.font("Helvetica-Bold").fontSize(7.5).text(String(tlParsed.timeLoss?.[col.toLowerCase()] || "-"), xPos, currY + 3, { width: dataColW, align: "center" });
      });
      currY += cellH;

      // Details of OT Line
      doc.font("Helvetica-Bold").fontSize(7.5).text("Details of OT :", startX, currY + 3);
      doc.font("Helvetica").text(r.timeLossDetailsOt || tlParsed.detailsOfOt || "-", startX + 65, currY + 3);
      currY += 13;

      // ----------------------------------------------------
      // 7. WORK ATTENDED BY TABLE
      // ----------------------------------------------------
      doc.font("Helvetica-Bold").fontSize(8).text("Work attended by :", startX, currY);
      currY += 10;

      let workersParsed = [];
      try { workersParsed = r.workersData ? JSON.parse(r.workersData) : []; } catch (_) {}
      if (!Array.isArray(workersParsed) || workersParsed.length === 0) {
        workersParsed = [{ empNo: "-", employeeName: "-", from: "-", to: "-", time: "-" }];
      }

      const wCols = [
        { title: "EMP. NO.", width: 80, align: "center" },
        { title: "EMPLOYEE NAME", width: 225, align: "left" },
        { title: "FROM", width: 80, align: "center" },
        { title: "TO", width: 80, align: "center" },
        { title: "TIME", width: 80, align: "center" }
      ];

      // Work Header
      let curWX = startX;
      wCols.forEach((c) => {
        doc.rect(curWX, currY, c.width, cellH).fillAndStroke("#f3f4f6", "black");
        doc.fillColor("black").font("Helvetica-Bold").fontSize(7.5).text(c.title, curWX, currY + 3, { width: c.width, align: "center" });
        curWX += c.width;
      });
      currY += cellH;

      // Work Rows
      workersParsed.slice(0, 3).forEach((w) => {
        curWX = startX;
        const vals = [w.empNo || "-", w.employeeName || "-", w.from || "-", w.to || "-", w.time || "-"];
        wCols.forEach((c, i) => {
          doc.rect(curWX, currY, c.width, cellH).stroke();
          doc.font("Helvetica").fontSize(7.5).text(vals[i], curWX + (c.align === "left" ? 6 : 0), currY + 3, { width: c.width - (c.align === "left" ? 12 : 0), align: c.align });
          curWX += c.width;
        });
        currY += cellH;
      });

      currY += 4;

      // ----------------------------------------------------
      // 8. SPARES CONSUMED TABLE
      // ----------------------------------------------------
      doc.font("Helvetica-Bold").fontSize(8).text("Spares Consumed :", startX, currY);
      currY += 10;

      let sparesParsed = [];
      try { sparesParsed = r.sparesData ? JSON.parse(r.sparesData) : []; } catch (_) {}
      if (!Array.isArray(sparesParsed) || sparesParsed.length === 0) {
        sparesParsed = [{ slNo: "1", itemCode: "-", description: "-", quantity: "-" }];
      }

      const sCols = [
        { title: "SL. NO.", width: 55, align: "center" },
        { title: "ITEM CODE", width: 130, align: "center" },
        { title: "DESCRIPTION", width: 270, align: "left" },
        { title: "QUANTITY", width: 90, align: "center" }
      ];

      // Spares Header
      let curSX = startX;
      sCols.forEach((c) => {
        doc.rect(curSX, currY, c.width, cellH).fillAndStroke("#f3f4f6", "black");
        doc.fillColor("black").font("Helvetica-Bold").fontSize(7.5).text(c.title, curSX, currY + 3, { width: c.width, align: "center" });
        curSX += c.width;
      });
      currY += cellH;

      // Spares Rows
      sparesParsed.slice(0, 3).forEach((s, sIdx) => {
        curSX = startX;
        const vals = [String(s.slNo || sIdx + 1), s.itemCode || "-", s.description || "-", String(s.quantity || "-")];
        sCols.forEach((c, i) => {
          doc.rect(curSX, currY, c.width, cellH).stroke();
          doc.font("Helvetica").fontSize(7.5).text(vals[i], curSX + (c.align === "left" ? 6 : 0), currY + 3, { width: c.width - (c.align === "left" ? 12 : 0), align: c.align });
          curSX += c.width;
        });
        currY += cellH;
      });

      currY += 4;

      // ----------------------------------------------------
      // 9. LEGEND FOR ABBREVIATIONS & FOOTER
      // ----------------------------------------------------
      const legH = 46;
      doc.lineWidth(0.8).rect(startX, currY, pageWidth, legH).stroke();
      doc.font("Helvetica-Bold").fontSize(7).text("LEGEND FOR ABBREVIATIONS :", startX + 6, currY + 4);

      doc.font("Helvetica").fontSize(6.5);
      doc.text("TD  - TRANSITION DELAY", startX + 12, currY + 16);
      doc.text("WM - MANPOWER SHORTAGE", startX + 12, currY + 26);
      doc.text("SS   - DELAY IN STORES SERVICES", startX + 12, currY + 36);

      doc.text("SP  - DOWN FOR SPARES", startX + 190, currY + 16);
      doc.text("OT  - OTHERS", startX + 190, currY + 26);

      doc.text("AT  - ACTUAL TIME (WORKED)", startX + 350, currY + 16);
      doc.text("TT  - TOTAL DOWN TIME", startX + 350, currY + 26);

      // Render dynamic QF Value in PDF Footer
      doc.font("Helvetica").fontSize(6.5).fillColor("#4b5563").text(effectiveQf, startX, currY + legH + 4);
    });

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
  saveBreakdownIntimationReport,
  getBreakdownIntimationReports,
  getPePendingBreakdownReports,
  signPeBreakdownReport,
  generateBreakdownPdfReport,
};