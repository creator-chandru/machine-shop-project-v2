const sql = require('../db');
const PDFDocument = require("pdfkit");
const fs = require('fs');
const path = require('path');

// ============================================================
// GET ALL MACHINE SHOP 3 DETAILS
// ============================================================
const getMachineShop3Details = async (req, res) => {
  try {
    const result = await sql.query(`
      SELECT
        id,
        lineCode,
        partName,
        partNo,
        machineNo,
        machineType
      FROM MachineShop3Details
      ORDER BY
        lineCode,
        partName,
        partNo,
        machineNo
    `);

    res.status(200).json(result.recordset);
  } catch (err) {
    console.error('Error fetching Machine Shop 3 details:', err);
    res.status(500).json({ error: 'Failed to fetch Machine Shop 3 details' });
  }
};

// ============================================================
// GET MACHINE SHOP 3 DETAILS FOR ONE LINE CODE
// ============================================================
const getMachineShop3LineDetails = async (req, res) => {
  const { lineCode } = req.params;
  try {
    const result = await sql
      .request()
      .input('lineCode', sql.NVarChar(50), lineCode)
      .query(`
        SELECT
          id,
          lineCode,
          partName,
          partNo,
          machineNo,
          machineType
        FROM MachineShop3Details
        WHERE lineCode = @lineCode
        ORDER BY
          partName,
          partNo,
          machineNo
      `);

    res.status(200).json(result.recordset);
  } catch (err) {
    console.error('Error fetching line details:', err);
    res.status(500).json({ error: 'Failed to fetch line details' });
  }
};

// ============================================================
// SAVE PRE-OPERATION CHECKLIST (With Safe Re-submission)
// ============================================================
const savePreOperationChecklist = async (req, res) => {
  const {
    header,
    values,
    signatures,
    parameters,
    specifications
  } = req.body;

  let transaction;

  try {
    transaction = new sql.Transaction();
    await transaction.begin();

    const machineShop = header.machineShop;
    const lineCode = header.lineCode;
    const partName = header.partName;
    const partNo = header.partNo;
    const month = header.month || '';
    const machineNo = header.machineNo;
    const opNo = header.opNo || '';
    const checklistDate = header.date ? String(header.date).split('T')[0] : null;

    const operatorSignature = signatures?.Operator || '';
    const shiftInchargeSignature = signatures?.["Shift Incharge"] || '';

    // Remove existing rows for this compound key to prevent duplication
    await transaction.request()
      .input('machineShop', sql.Int, parseInt(machineShop, 10))
      .input('lineCode', sql.NVarChar(50), lineCode)
      .input('machineNo', sql.NVarChar(50), machineNo)
      .input('checklistDate', sql.Date, checklistDate)
      .query(`
        DELETE FROM PreOperationChecklist
        WHERE machineShop = @machineShop
          AND lineCode = @lineCode
          AND machineNo = @machineNo
          AND CONVERT(date, checklistDate) = CONVERT(date, @checklistDate)
      `);

    for (const param of parameters) {
      const specVal = specifications?.[param.slNo] !== undefined 
        ? specifications[param.slNo] 
        : (param.specification || '');

      if (param.hasSubRows) {
        for (const subRow of param.subRows) {
          const val = values?.[param.slNo]?.[subRow] || '';

          await transaction.request()
            .input('machineShop', sql.Int, parseInt(machineShop, 10))
            .input('lineCode', sql.NVarChar(50), lineCode)
            .input('partName', sql.NVarChar(200), partName)
            .input('partNo', sql.NVarChar(100), partNo)
            .input('month', sql.NVarChar(20), month)
            .input('machineNo', sql.NVarChar(50), machineNo)
            .input('opNo', sql.NVarChar(50), opNo)
            .input('checklistDate', sql.Date, checklistDate)
            .input('slNo', sql.Int, param.slNo)
            .input('specification', sql.NVarChar(200), specVal)
            .input('subRow', sql.NVarChar(10), subRow)
            .input('value', sql.NVarChar(100), val)
            .input('operatorSignature', sql.NVarChar(100), operatorSignature)
            .input('shiftInchargeSignature', sql.NVarChar(100), shiftInchargeSignature)
            .query(`
              INSERT INTO PreOperationChecklist
              (
                machineShop, lineCode, partName, partNo, month, machineNo, opNo,
                checklistDate, slNo, specification, subRow, value,
                operatorSignature, shiftInchargeSignature
              )
              VALUES
              (
                @machineShop, @lineCode, @partName, @partNo, @month, @machineNo, @opNo,
                @checklistDate, @slNo, @specification, @subRow, @value,
                @operatorSignature, @shiftInchargeSignature
              )
            `);
        }
      } else {
        const val = values?.[param.slNo] || '';

        await transaction.request()
          .input('machineShop', sql.Int, parseInt(machineShop, 10))
          .input('lineCode', sql.NVarChar(50), lineCode)
          .input('partName', sql.NVarChar(200), partName)
          .input('partNo', sql.NVarChar(100), partNo)
          .input('month', sql.NVarChar(20), month)
          .input('machineNo', sql.NVarChar(50), machineNo)
          .input('opNo', sql.NVarChar(50), opNo)
          .input('checklistDate', sql.Date, checklistDate)
          .input('slNo', sql.Int, param.slNo)
          .input('specification', sql.NVarChar(200), specVal)
          .input('value', sql.NVarChar(100), val)
          .input('operatorSignature', sql.NVarChar(100), operatorSignature)
          .input('shiftInchargeSignature', sql.NVarChar(100), shiftInchargeSignature)
          .query(`
            INSERT INTO PreOperationChecklist
            (
              machineShop, lineCode, partName, partNo, month, machineNo, opNo,
              checklistDate, slNo, specification, value,
              operatorSignature, shiftInchargeSignature
            )
            VALUES
            (
              @machineShop, @lineCode, @partName, @partNo, @month, @machineNo, @opNo,
              @checklistDate, @slNo, @specification, @value,
              @operatorSignature, @shiftInchargeSignature
            )
          `);
      }
    }

    await transaction.commit();
    res.status(201).json({ message: 'Checklist saved successfully' });
  } catch (err) {
    console.error('Error saving checklist:', err);
    if (transaction) {
      try { await transaction.rollback(); } catch (e) {}
    }
    res.status(500).json({ error: 'Failed to save checklist' });
  }
};

// ============================================================
// GET EXISTING PRE-OPERATION CHECKLIST RECORD
// ============================================================
const getPreOperationRecord = async (req, res) => {
  const { machineShop, lineCode, machineNo, date } = req.query;

  if (!lineCode || !machineNo || !date) {
    return res.status(400).json({ error: 'lineCode, machineNo, and date are required' });
  }

  try {
    const cleanDate = String(date).split('T')[0];
    const request = new sql.Request();
    request.input('lineCode', sql.NVarChar(50), lineCode);
    request.input('machineNo', sql.NVarChar(50), machineNo);
    request.input('checklistDate', sql.NVarChar(50), cleanDate);

    let shopFilter = '';
    if (machineShop) {
      request.input('machineShop', sql.Int, parseInt(machineShop, 10));
      shopFilter = ' AND machineShop = @machineShop';
    }

    const query = `
      SELECT
        id, machineShop, lineCode, partName, partNo, machineNo, opNo,
        FORMAT(checklistDate, 'yyyy-MM-dd') AS checklistDate,
        slNo, specification, subRow, value,
        operatorSignature, shiftInchargeSignature
      FROM PreOperationChecklist
      WHERE lineCode = @lineCode
        AND machineNo = @machineNo
        AND CONVERT(date, checklistDate) = CONVERT(date, @checklistDate)
        ${shopFilter}
      ORDER BY slNo ASC, id ASC
    `;

    const result = await request.query(query);
    const records = result.recordset;

    if (!records || records.length === 0) {
      return res.status(200).json(null);
    }

    const first = records[0];
    const values = {};
    const specifications = {};

    records.forEach((r) => {
      if (r.specification !== null && r.specification !== undefined) {
        specifications[r.slNo] = r.specification;
      }
      if (r.subRow) {
        if (!values[r.slNo]) values[r.slNo] = {};
        values[r.slNo][r.subRow] = r.value || '';
      } else {
        values[r.slNo] = r.value || '';
      }
    });

    const structuredRecord = {
      header: {
        machineShop: first.machineShop,
        lineCode: first.lineCode,
        partName: first.partName || '',
        partNo: first.partNo || '',
        machineNo: first.machineNo,
        opNo: first.opNo || '',
        date: first.checklistDate
      },
      values,
      specifications,
      signatures: {
        Operator: first.operatorSignature || '',
        "Shift Incharge": first.shiftInchargeSignature || ''
      }
    };

    return res.status(200).json(structuredRecord);
  } catch (err) {
    console.error('Error fetching pre-operation record:', err);
    return res.status(500).json({ error: 'Failed to fetch pre-operation record' });
  }
};

// ============================================================
// GET LATEST PRE-OPERATION PARAMETERS (SPECIFICATIONS ONLY)
// ============================================================
const getLatestMachineParams = async (req, res) => {
  const { shopId } = req.params;
  const { lineCode, machineNo } = req.query;

  try {
    const request = new sql.Request();
    
    const result = await request
      .input('shopId', sql.Int, shopId)
      .input('lineCode', sql.NVarChar(50), lineCode)
      .input('machineNo', sql.NVarChar(50), machineNo)
      .query(`
        SELECT slNo, specification
        FROM PreOperationChecklist
        WHERE machineShop = @shopId 
          AND lineCode = @lineCode 
          AND machineNo = @machineNo
          AND slNo IN (1, 2, 3, 4)
          AND id IN (
              SELECT MAX(id)
              FROM PreOperationChecklist
              WHERE machineShop = @shopId 
                AND lineCode = @lineCode 
                AND machineNo = @machineNo
              GROUP BY slNo
          )
      `);

    res.status(200).json(result.recordset);
  } catch (err) {
    console.error('Error fetching latest params:', err);
    res.status(500).json({ error: 'Failed to fetch latest parameters' });
  }
};

// ============================================================
// PDF REPORT GENERATOR FOR PRE-OPERATION CHECKLIST (2 PER PAGE)
// ============================================================
const generatePreOperationReport = async (req, res) => {
  const { fromDate, toDate, shopId } = req.query;

  if (!fromDate || !toDate) {
    return res.status(400).send("fromDate and toDate are required.");
  }

  try {
    const cleanFromDate = String(fromDate).split('T')[0];
    const cleanToDate = String(toDate).split('T')[0];
    const targetShopId = parseInt(shopId || 3, 10);

    // 🔥 1. FETCH FULL QF VALUE HISTORY FROM DATABASE
    let qfHistory = [];
    try {
      const qfRes = await sql.query`
        SELECT qfValue, date 
        FROM PreOperationQFvalues 
        WHERE formName = 'pre-operation-checklist' 
        ORDER BY date DESC, id DESC
      `;
      qfHistory = qfRes.recordset;
    } catch (e) {
      console.error("PreOperationQFvalues table error or not found.");
    }

    const request = new sql.Request();
    request.input('fromDate', sql.NVarChar(50), cleanFromDate);
    request.input('toDate', sql.NVarChar(50), cleanToDate);
    request.input('machineShop', sql.Int, targetShopId);

    const query = `
      SELECT
        id, machineShop, lineCode, partName, partNo, machineNo, opNo,
        FORMAT(checklistDate, 'yyyy-MM-dd') AS checklistDate,
        slNo, specification, subRow, value,
        operatorSignature, shiftInchargeSignature
      FROM PreOperationChecklist
      WHERE machineShop = @machineShop
        AND CONVERT(date, checklistDate) >= CONVERT(date, @fromDate)
        AND CONVERT(date, checklistDate) <= CONVERT(date, @toDate)
      ORDER BY checklistDate ASC, lineCode ASC, machineNo ASC, slNo ASC, id ASC
    `;

    const result = await request.query(query);
    const records = result.recordset;

    if (!records || records.length === 0) {
      return res.status(404).send("No records found for the selected date range.");
    }

    const groupedMap = new Map();
    records.forEach((r) => {
      const groupKey = `${r.lineCode}_${r.machineNo}_${r.checklistDate}`;
      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, []);
      }
      groupedMap.get(groupKey).push(r);
    });

    const groups = Array.from(groupedMap.values());

    const doc = new PDFDocument({ margin: 20, size: "A4", layout: "portrait", bufferPages: true, autoPageBreak: false });
    
    // Add an error event listener to the document to prevent crashing the server
    doc.on('error', (err) => {
      console.error("PDFKit error occurred:", err);
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=PreOperation_Checklist_Report_${cleanFromDate}_to_${cleanToDate}.pdf`);
    doc.pipe(res);

    const startX = 20;
    const totalWidth = doc.page.width - 40; 

    const labels = {
      1: { name: "System pressure", unit: "kg/cm²", method: "PRESSURE GAUGE" },
      2: { name: "Clamping pressure", unit: "kg/cm²", method: "PRESSURE GAUGE" },
      3: { name: "Orientation pressure", unit: "kg/cm²", method: "PRESSURE GAUGE" },
      4: { name: "PROGRAM NO", unit: "-", method: "VISUAL" },
      5: { name: "Hydraulic oil level", unit: "-", method: "LEVEL INDICATOR" },
      6: { name: "Coolant oil level", unit: "-", method: "LEVEL INDICATOR" },
      7: { name: "Lub oil Level", unit: "-", method: "LEVEL INDICATOR" },
      8: { name: "Coolant oil ratio", unit: "-", method: "REFRACTO METER" },
      9: { name: "Air pressure Level", unit: "-", method: "PRESSURE GAUGE" },
      10: { name: "Fixture Condition", unit: "-", method: "VISUAL" },
      11: { name: "Andon Tower Lamp Condition", unit: "-", method: "VISUAL" },
      12: { name: "Double Hand switches, Limit switches, Sensors", unit: "-", method: "Operate" }
    };

    const tableHeaders = ["Sl", "Parameters", "Specification", "Unit", "Method", "Condition", "Value"];
    const fractions = [0.06, 0.32, 0.23, 0.09, 0.14, 0.08, 0.08];
    const colWidths = fractions.map(f => f * totalWidth);
    const pad = 2.5;
    const fontSize = 6.5;

    const formatSigText = (sig) => {
      if (!sig) return "";
      const trimmed = String(sig).trim();
      if (trimmed.toUpperCase() === "APPROVED") return "APPROVED";
      return `APPROVED (${trimmed.toUpperCase()})`;
    };

    // Helper to draw one full entry block at a given Y offset
    const drawEntryBlock = (groupRecords, blockStartY) => {
      const first = groupRecords[0];
      const [yy, mm, dd] = String(first.checklistDate).split('-');
      const displayDate = `${dd}/${mm}/${yy}`;

      // 🔥 2. FIND CORRECT QF VALUE FOR THIS SPECIFIC PAGE DATE
      let currentPageQfValue = "QF/07/MPD-13, Rev.No: 12 dt 31.01.2025"; // Fallback
      const currentReportDate = new Date(first.checklistDate);
      currentReportDate.setHours(0, 0, 0, 0);

      for (let qf of qfHistory) {
          if (!qf.date) continue;
          const qfDate = new Date(qf.date);
          qfDate.setHours(0, 0, 0, 0);
          if (qfDate <= currentReportDate) {
              currentPageQfValue = qf.qfValue;
              break; 
          }
      }

      // 1. Header Box
      const headerH = 34;
      doc.lineWidth(0.8).strokeColor('black');
      doc.rect(startX, blockStartY, 80, headerH).stroke();

      const logoPath = path.join(__dirname, 'logo.jpg');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, startX + 5, blockStartY + 4, { width: 70, height: 25 });
      } else {
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor('black').text("SAKTHI\nAUTO", startX, blockStartY + 7, { width: 80, align: "center" });
      }

      const midWidth = totalWidth - 235;
      doc.rect(startX + 80, blockStartY, midWidth, headerH).stroke();
      doc.font("Helvetica-Bold").fontSize(8).fillColor('black')
         .text("CHECK LIST FOR PRE OPERATION AND PROCESS PARAMETERS", startX + 85, blockStartY + 5, { width: midWidth - 10, align: "center" });
      doc.font("Helvetica").fontSize(6.5).fillColor('black')
         .text(`LINE: ${first.lineCode}   |   M/C NO: ${first.machineNo}   |   OP: ${first.opNo || '-'}`, startX + 85, blockStartY + 20, { width: midWidth - 10, align: "center" });

      const rightWidth = 155;
      doc.rect(startX + totalWidth - rightWidth, blockStartY, rightWidth, headerH).stroke();
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor('black')
         .text(`PART: ${String(first.partName || '-').substring(0, 30)}`, startX + totalWidth - rightWidth + 4, blockStartY + 4, { width: rightWidth - 8 });
      doc.font("Helvetica").fontSize(6.5).fillColor('black')
         .text(`PART NO: ${first.partNo || '-'}`, startX + totalWidth - rightWidth + 4, blockStartY + 14, { width: rightWidth - 8 });
      doc.font("Helvetica").fontSize(6.5).fillColor('black')
         .text(`DATE: ${displayDate}`, startX + totalWidth - rightWidth + 4, blockStartY + 24, { width: rightWidth - 8 });

      // 2. Table Header
      let currentY = blockStartY + headerH + 3; // explicitly scoped currentY definition
      doc.font("Helvetica-Bold").fontSize(fontSize);
      let colX = startX;
      tableHeaders.forEach((h, i) => {
        doc.rect(colX, currentY, colWidths[i], 13).fillAndStroke('#f0f0f0', 'black');
        doc.fillColor('black').text(h, colX + pad, currentY + 3, { width: colWidths[i] - pad * 2, align: "center" });
        colX += colWidths[i];
      });
      currentY += 13;

      // 3. Table Rows
      doc.font("Helvetica").fontSize(fontSize);
      doc.lineWidth(0.5).strokeColor('black');

      groupRecords.forEach((r) => {
        const paramInfo = labels[r.slNo] || { name: `Param ${r.slNo}`, unit: "-", method: "-" };
        const rowCells = [
          String(r.slNo),
          paramInfo.name,
          r.specification || "-",
          paramInfo.unit,
          paramInfo.method,
          r.subRow || "-",
          r.value || "-"
        ];

        let rowH = 12.5;
        rowCells.forEach((c, i) => {
          const textH = doc.heightOfString(String(c), { width: colWidths[i] - pad * 2 }) + 3;
          if (textH > rowH) rowH = textH;
        });

        let rowX = startX;
        rowCells.forEach((c, i) => {
          doc.rect(rowX, currentY, colWidths[i], rowH).stroke();
          doc.fillColor('black').text(String(c), rowX + pad, currentY + 2.5, {
            width: colWidths[i] - pad * 2,
            align: i === 1 || i === 2 ? "left" : "center"
          });
          rowX += colWidths[i];
        });

        currentY += rowH;
      });

      // 4. Compact Signatures Block
      const sigY = currentY + 4;
      const sigColWidth = totalWidth / 2;

      // Operator Signature
      doc.lineWidth(0.5).strokeColor('black');
      doc.fillColor('black').font("Helvetica-Bold").fontSize(7).text("Operator Signature", startX, sigY, { width: sigColWidth - 10, align: "center" });
      doc.rect(startX + 10, sigY + 10, sigColWidth - 20, 20).stroke();
      const opSig = first.operatorSignature;
      if (opSig) {
        doc.lineWidth(1.2).strokeColor('#16a34a').moveTo(startX + 18, sigY + 20).lineTo(startX + 21, sigY + 24).lineTo(startX + 26, sigY + 15).stroke();
        doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(7).text(formatSigText(opSig), startX + 30, sigY + 16);
      } else {
        doc.fillColor('red').font('Helvetica').fontSize(7).text("Pending", startX + 10, sigY + 16, { width: sigColWidth - 20, align: "center" });
      }

      // Shift Incharge Signature
      const inchargeX = startX + sigColWidth;
      doc.lineWidth(0.5).strokeColor('black');
      doc.fillColor('black').font("Helvetica-Bold").fontSize(7).text("Shift Incharge Signature", inchargeX, sigY, { width: sigColWidth - 10, align: "center" });
      doc.rect(inchargeX + 10, sigY + 10, sigColWidth - 20, 20).stroke();
      const incSig = first.shiftInchargeSignature;
      if (incSig) {
        doc.lineWidth(1.2).strokeColor('#16a34a').moveTo(inchargeX + 18, sigY + 20).lineTo(inchargeX + 21, sigY + 24).lineTo(inchargeX + 26, sigY + 15).stroke();
        doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(7).text(formatSigText(incSig), inchargeX + 30, sigY + 16);
      } else {
        doc.fillColor('red').font('Helvetica').fontSize(7).text("Pending", inchargeX + 10, sigY + 16, { width: sigColWidth - 20, align: "center" });
      }
      let qfY = sigY + 30;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#374151')
        .text(currentPageQfValue, startX, qfY + 4, { align: 'left' });

      return qfY + 16; 
    };

    // Loop through groups and render 2 per page
    groups.forEach((groupRecords, index) => {
      const positionOnPage = index % 2; // 0 = top, 1 = bottom

      if (index > 0 && positionOnPage === 0) {
        doc.addPage();
      }

      const topStartY = 16;
      const bottomStartY = 422;

      if (positionOnPage === 0) {
        drawEntryBlock(groupRecords, topStartY);

        // Draw a neat subtle dashed divider line between top and bottom if there are more records
        if (index + 1 < groups.length) {
          doc.save()
             .lineWidth(0.5)
             .dash(3, { space: 3 })
             .strokeColor('#9ca3af')
             .moveTo(startX, 412)
             .lineTo(startX + totalWidth, 412)
             .stroke()
             .restore();
        }
      } else {
        drawEntryBlock(groupRecords, bottomStartY);
      }
    });

    doc.end();
  } catch (err) {
    console.error("PDF generation error:", err);
    // Safe fallback to prevent the ERR_STREAM_WRITE_AFTER_END server crash
    if (!res.headersSent) {
      res.status(500).json({ message: "PDF generation failed", error: err.message });
    }
  }
};

// ============================================================
// GET QF HISTORY FOR DYNAMIC FRONTEND DISPLAY
// ============================================================
const getPreOperationQfHistory = async (req, res) => {
  try {
    const qfRes = await sql.query`
      SELECT qfValue, date 
      FROM PreOperationQFvalues 
      WHERE formName = 'pre-operation-checklist' 
      ORDER BY date DESC, id DESC
    `;
    res.status(200).json(qfRes.recordset);
  } catch (err) {
    console.error("Error fetching QF history:", err);
    res.status(500).json({ error: "Failed to fetch QF history" });
  }
};

module.exports = {
  getMachineShop3Details,
  getMachineShop3LineDetails,
  savePreOperationChecklist,
  getLatestMachineParams,
  getPreOperationRecord,
  generatePreOperationReport,
  getPreOperationQfHistory // ✅ Export the new function
};