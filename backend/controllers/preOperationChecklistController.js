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
// PDF REPORT GENERATOR FOR PRE-OPERATION CHECKLIST
// ============================================================
const generatePreOperationReport = async (req, res) => {
  const { lineCode, machineNo, date, shopId } = req.query;

  if (!lineCode || !machineNo || !date) {
    return res.status(400).send("lineCode, machineNo, and date are required.");
  }

  try {
    const cleanDate = String(date).split('T')[0];
    const request = new sql.Request();
    request.input('lineCode', sql.NVarChar(50), lineCode);
    request.input('machineNo', sql.NVarChar(50), machineNo);
    request.input('checklistDate', sql.NVarChar(50), cleanDate);

    let query = `
      SELECT
        id, machineShop, lineCode, partName, partNo, machineNo, opNo,
        FORMAT(checklistDate, 'yyyy-MM-dd') AS checklistDate,
        slNo, specification, subRow, value,
        operatorSignature, shiftInchargeSignature
      FROM PreOperationChecklist
      WHERE lineCode = @lineCode
        AND machineNo = @machineNo
        AND CONVERT(date, checklistDate) = CONVERT(date, @checklistDate)
    `;

    if (shopId) {
      request.input('machineShop', sql.Int, parseInt(shopId, 10));
      query += ` AND machineShop = @machineShop`;
    }

    query += ` ORDER BY slNo ASC, id ASC`;

    const result = await request.query(query);
    const records = result.recordset;

    if (!records || records.length === 0) {
      return res.status(404).send("No records found for the selected parameters.");
    }

    const first = records[0];
    const [yy, mm, dd] = String(first.checklistDate).split('-');
    const displayDate = `${dd}/${mm}/${yy}`;

    const doc = new PDFDocument({ margin: 25, size: "A4", layout: "portrait", bufferPages: true, autoPageBreak: false });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=PreOperation_Checklist_${lineCode}_${machineNo}_${cleanDate}.pdf`);
    doc.pipe(res);

    const startX = 25;
    const headerY = 25;
    const totalWidth = doc.page.width - 50;
    const pageBottom = doc.page.height - 25;

    // Header Blocks with expanded height (46pt) to prevent any text overlap
    const headerH = 46;
    doc.lineWidth(1).strokeColor('black');
    doc.rect(startX, headerY, 95, headerH).stroke();

    const logoPath = path.join(__dirname, 'logo.jpg');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, startX + 8, headerY + 8, { width: 78, height: 30 });
    } else {
      doc.font("Helvetica-Bold").fontSize(10).fillColor('black').text("SAKTHI\nAUTO", startX, headerY + 14, { width: 95, align: "center" });
    }

    const midWidth = totalWidth - 260;
    doc.rect(startX + 95, headerY, midWidth, headerH).stroke();
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor('black')
       .text("CHECK LIST FOR PRE OPERATION AND PROCESS PARAMETERS", startX + 100, headerY + 8, { width: midWidth - 10, align: "center" });
    doc.font("Helvetica").fontSize(7.5).fillColor('black')
       .text(`LINE: ${lineCode}   |   M/C NO: ${machineNo}   |   OP: ${first.opNo || '-'}`, startX + 100, headerY + 28, { width: midWidth - 10, align: "center" });

    const rightWidth = 165;
    doc.rect(startX + totalWidth - rightWidth, headerY, rightWidth, headerH).stroke();
    doc.font("Helvetica-Bold").fontSize(7).fillColor('black')
       .text(`PART: ${String(first.partName || '-').substring(0, 32)}`, startX + totalWidth - rightWidth + 5, headerY + 6, { width: rightWidth - 10 });
    doc.font("Helvetica").fontSize(7).fillColor('black')
       .text(`PART NO: ${first.partNo || '-'}`, startX + totalWidth - rightWidth + 5, headerY + 18, { width: rightWidth - 10 });
    doc.font("Helvetica").fontSize(7).fillColor('black')
       .text(`DATE: ${displayDate}`, startX + totalWidth - rightWidth + 5, headerY + 30, { width: rightWidth - 10 });

    // Table Columns
    const headers = ["Sl", "Parameters", "Specification", "Unit", "Method", "Condition", "Value"];
    const fractions = [0.06, 0.32, 0.23, 0.09, 0.14, 0.08, 0.08];
    const colWidths = fractions.map(f => f * totalWidth);
    const pad = 3;
    const fontSize = 7;

    const drawHeader = (currY) => {
      doc.font("Helvetica-Bold").fontSize(fontSize);
      let x = startX;
      headers.forEach((h, i) => {
        doc.rect(x, currY, colWidths[i], 16).fillAndStroke('#f0f0f0', 'black');
        doc.fillColor('black').text(h, x + pad, currY + 4, { width: colWidths[i] - pad * 2, align: "center" });
        x += colWidths[i];
      });
      return currY + 16;
    };

    let y = drawHeader(headerY + headerH + 6);

    const labels = {
      1: { name: "System pressure", unit: "KGF/CM2", method: "PRESSURE GAUGE" },
      2: { name: "Clamping pressure", unit: "KGF/CM2", method: "PRESSURE GAUGE" },
      3: { name: "Orientation pressure", unit: "KGF/CM2", method: "PRESSURE GAUGE" },
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

    doc.font("Helvetica").fontSize(fontSize);
    doc.lineWidth(0.5).strokeColor('black');

    records.forEach((r) => {
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

      // Dynamic text height calculation to prevent multi-line collision
      let rowH = 16;
      rowCells.forEach((c, i) => {
        const textH = doc.heightOfString(String(c), { width: colWidths[i] - pad * 2 }) + 6;
        if (textH > rowH) rowH = textH;
      });

      if (y + rowH > pageBottom - 60) {
        doc.addPage();
        y = drawHeader(25);
        doc.font("Helvetica").fontSize(fontSize);
      }

      let x = startX;
      rowCells.forEach((c, i) => {
        doc.rect(x, y, colWidths[i], rowH).stroke();
        doc.fillColor('black').text(String(c), x + pad, y + 4, {
          width: colWidths[i] - pad * 2,
          align: i === 1 || i === 2 ? "left" : "center"
        });
        x += colWidths[i];
      });

      y += rowH;
    });

    // Signatures Block
    let sigY = y + 16;
    if (sigY + 50 > pageBottom) {
      doc.addPage();
      sigY = 30;
    }

    const sigColWidth = totalWidth / 2;

    // Operator Signature
    doc.lineWidth(0.5).strokeColor('black');
    doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("Operator Signature", startX, sigY, { width: sigColWidth - 10, align: "center" });
    doc.rect(startX + 10, sigY + 12, sigColWidth - 20, 28).stroke();
    const opSig = first.operatorSignature;
    if (opSig) {
      doc.lineWidth(1.5).strokeColor('#16a34a').moveTo(startX + 20, sigY + 26).lineTo(startX + 24, sigY + 31).lineTo(startX + 30, sigY + 20).stroke();
      doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(8).text(`APPROVED (${String(opSig).toUpperCase()})`, startX + 34, sigY + 22);
    } else {
      doc.fillColor('red').font('Helvetica').fontSize(8).text("Pending", startX + 10, sigY + 22, { width: sigColWidth - 20, align: "center" });
    }

    // Shift Incharge Signature
    const inchargeX = startX + sigColWidth;
    doc.lineWidth(0.5).strokeColor('black');
    doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("Shift Incharge Signature", inchargeX, sigY, { width: sigColWidth - 10, align: "center" });
    doc.rect(inchargeX + 10, sigY + 12, sigColWidth - 20, 28).stroke();
    const incSig = first.shiftInchargeSignature;
    if (incSig) {
      doc.lineWidth(1.5).strokeColor('#16a34a').moveTo(inchargeX + 20, sigY + 26).lineTo(inchargeX + 24, sigY + 31).lineTo(inchargeX + 30, sigY + 20).stroke();
      doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(8).text(`APPROVED (${String(incSig).toUpperCase()})`, inchargeX + 34, sigY + 22);
    } else {
      doc.fillColor('red').font('Helvetica').fontSize(8).text("Pending", inchargeX + 10, sigY + 22, { width: sigColWidth - 20, align: "center" });
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
  getMachineShop3Details,
  getMachineShop3LineDetails,
  savePreOperationChecklist,
  getLatestMachineParams,
  getPreOperationRecord,
  generatePreOperationReport
};