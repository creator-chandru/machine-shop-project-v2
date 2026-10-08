const sql = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// 1. GET REUSABLE MASTER CONTROL SPECIFICATIONS
const getControlSpecifications = async (req, res) => {
  const { partName, operationNo, shopId } = req.query;

  if (!partName || !operationNo) {
    return res.status(400).json({ error: "partName and operationNo are required" });
  }

  try {
    const request = new sql.Request();
    request.input("partName", sql.NVarChar(255), String(partName).trim());
    request.input("operationNo", sql.NVarChar(100), String(operationNo).trim());
    request.input("shopId", sql.VarChar(50), String(shopId || "3"));

    const result = await request.query(`
      SELECT TOP 1 OperationDescription, ControlSpecifications
      FROM dbo.JobSetupVerification
      WHERE PartName = @partName 
        AND OperationNo = @operationNo 
        AND (IsMasterTemplate = 1 OR ControlSpecifications IS NOT NULL)
      ORDER BY IsMasterTemplate DESC, Id DESC
    `);

    if (result.recordset.length > 0 && result.recordset[0].ControlSpecifications) {
      const raw = result.recordset[0].ControlSpecifications;
      const specs = typeof raw === "string" ? JSON.parse(raw) : raw;
      return res.status(200).json({
        operationDescription: result.recordset[0].OperationDescription || "",
        specifications: specs,
      });
    }

    return res.status(200).json({ operationDescription: "", specifications: [] });
  } catch (err) {
    console.error("Get specifications error:", err);
    return res.status(500).json({ error: "Failed to fetch control specifications" });
  }
};

// 2. SAVE OR UPDATE MASTER CONTROL SPECIFICATIONS
const saveControlSpecifications = async (req, res) => {
  const { machineShop, partName, partNo, operationNo, operationDescription, specifications } = req.body;

  if (!partName || !operationNo) {
    return res.status(400).json({ error: "partName and operationNo are required" });
  }

  let transaction;
  try {
    transaction = new sql.Transaction();
    await transaction.begin();

    const checkReq = transaction.request();
    checkReq.input("partName", sql.NVarChar(255), partName);
    checkReq.input("operationNo", sql.NVarChar(100), operationNo);

    const checkRes = await checkReq.query(`
      SELECT Id FROM dbo.JobSetupVerification 
      WHERE PartName = @partName AND OperationNo = @operationNo AND IsMasterTemplate = 1
    `);

    const request = transaction.request();
    request.input("machineShop", sql.VarChar(50), String(machineShop || "3"));
    request.input("partName", sql.NVarChar(255), partName);
    request.input("partNo", sql.NVarChar(100), partNo || "");
    request.input("operationNo", sql.NVarChar(100), operationNo);
    request.input("operationDescription", sql.NVarChar(1000), operationDescription || "");
    request.input("controlSpecifications", sql.NVarChar(sql.MAX), JSON.stringify(specifications || []));

    if (checkRes.recordset.length > 0) {
      request.input("id", sql.Int, checkRes.recordset[0].Id);
      await request.query(`
        UPDATE dbo.JobSetupVerification SET
          OperationDescription = @operationDescription,
          ControlSpecifications = @controlSpecifications,
          UpdatedAt = GETDATE()
        WHERE Id = @id
      `);
    } else {
      await request.query(`
        INSERT INTO dbo.JobSetupVerification (
          MachineShop, PartName, PartNo, OperationNo, OperationDescription,
          ControlSpecifications, IsMasterTemplate, Status
        ) VALUES (
          @machineShop, @partName, @partNo, @operationNo, @operationDescription,
          @controlSpecifications, 1, 'MasterTemplate'
        )
      `);
    }

    await transaction.commit();
    return res.status(200).json({ success: true, message: "Control specifications saved successfully" });
  } catch (err) {
    if (transaction) try { await transaction.rollback(); } catch (e) {}
    console.error("Save specs error:", err);
    return res.status(500).json({ error: "Failed to save control specifications" });
  }
};

// 3. SAVE ACTUAL JOB SETUP VERIFICATION RECORD
const saveJobSetupVerification = async (req, res) => {
  const {
    id,
    machineShop,
    partName,
    partNo,
    operationNo,
    operationDescription,
    date,
    shift,
    setterName,
    reasonForSetup,
    settingStartedAt,
    inspectionTimeStage,
    settingFinishedAt,
    settingTime,
    inspectionTimeMetrology,
    totalTime,
    runningItem,
    runningMachineNo,
    runningFixtureNo,
    runningOperationChange,
    runningSignificantBreakdown,
    runningMcNo,
    runningDetail,
    changeToItem,
    changeToMachineNo,
    changeToFixtureNo,
    changeToOperationChange,
    changeToSignificantBreakdown,
    controlSpecifications,
    actualInspectionData,
    signatures,
    assignedQc,
    assignedPe,
    assignedHof,
  } = req.body;

  let transaction;
  try {
    transaction = new sql.Transaction();
    await transaction.begin();

    const request = transaction.request();
    request.input("machineShop", sql.VarChar(50), String(machineShop || "3"));
    request.input("partName", sql.NVarChar(255), partName || "");
    request.input("partNo", sql.NVarChar(100), partNo || "");
    request.input("operationNo", sql.NVarChar(100), operationNo || "");
    request.input("operationDescription", sql.NVarChar(1000), operationDescription || "");

    request.input("reportDate", sql.Date, date ? String(date).split("T")[0] : null);
    request.input("shift", sql.NVarChar(50), shift || "1st");
    request.input("setterName", sql.NVarChar(255), setterName || "");
    request.input("reasonForSetup", sql.NVarChar(1000), reasonForSetup || "");

    request.input("settingStartedAt", sql.NVarChar(100), settingStartedAt || "");
    request.input("inspectionTimeStage", sql.NVarChar(100), inspectionTimeStage || "");
    request.input("settingFinishedAt", sql.NVarChar(100), settingFinishedAt || "");
    request.input("settingTime", sql.NVarChar(50), settingTime || "");
    request.input("inspectionTimeMetrology", sql.NVarChar(100), inspectionTimeMetrology || "");
    request.input("totalTime", sql.NVarChar(50), totalTime || "");

    request.input("runningItem", sql.NVarChar(255), runningItem || "");
    request.input("runningMachineNo", sql.NVarChar(100), runningMachineNo || "");
    request.input("runningFixtureNo", sql.NVarChar(100), runningFixtureNo || "");
    request.input("runningOperationChange", sql.NVarChar(255), runningOperationChange || "");
    request.input("runningSignificantBreakdown", sql.NVarChar(255), runningSignificantBreakdown || "");
    request.input("runningMcNo", sql.NVarChar(100), runningMcNo || "");
    request.input("runningDetail", sql.NVarChar(1000), runningDetail || "");

    request.input("changeToItem", sql.NVarChar(255), changeToItem || "");
    request.input("changeToMachineNo", sql.NVarChar(100), changeToMachineNo || "");
    request.input("changeToFixtureNo", sql.NVarChar(100), changeToFixtureNo || "");
    request.input("changeToOperationChange", sql.NVarChar(255), changeToOperationChange || "");
    request.input("changeToSignificantBreakdown", sql.NVarChar(255), changeToSignificantBreakdown || "");

    request.input("controlSpecifications", sql.NVarChar(sql.MAX), JSON.stringify(controlSpecifications || []));
    request.input("actualInspectionData", sql.NVarChar(sql.MAX), JSON.stringify(actualInspectionData || []));

    request.input("signInspector", sql.NVarChar(100), signatures?.inspector || "");
    request.input("signShiftIncharge", sql.NVarChar(100), signatures?.shiftIncharge || "");
    request.input("signHofInspection", sql.NVarChar(100), signatures?.hofInspection || "");
    request.input("signHofProduction", sql.NVarChar(100), signatures?.hofProduction || "");
    request.input("assignedQc", sql.NVarChar(100), assignedQc || "");
    request.input("assignedPe", sql.NVarChar(100), assignedPe || "");
    request.input("assignedHof", sql.NVarChar(100), assignedHof || "");

    const statusVal = (signatures?.hofInspection && signatures?.hofProduction) ? "Completed" : "Submitted";
    request.input("status", sql.NVarChar(50), statusVal);

    let savedId = id;
    if (id) {
      request.input("id", sql.Int, id);
      await request.query(`
        UPDATE dbo.JobSetupVerification SET
          MachineShop = @machineShop, PartName = @partName, PartNo = @partNo, OperationNo = @operationNo, OperationDescription = @operationDescription,
          ReportDate = @reportDate, Shift = @shift, SetterName = @setterName, ReasonForSetup = @reasonForSetup,
          SettingStartedAt = @settingStartedAt, InspectionTimeStage = @inspectionTimeStage, SettingFinishedAt = @settingFinishedAt,
          SettingTime = @settingTime, InspectionTimeMetrology = @inspectionTimeMetrology, TotalTime = @totalTime,
          RunningItem = @runningItem, RunningMachineNo = @runningMachineNo, RunningFixtureNo = @runningFixtureNo,
          RunningOperationChange = @runningOperationChange, RunningSignificantBreakdown = @runningSignificantBreakdown,
          RunningMcNo = @runningMcNo, RunningDetail = @runningDetail,
          ChangeToItem = @changeToItem, ChangeToMachineNo = @changeToMachineNo, ChangeToFixtureNo = @changeToFixtureNo,
          ChangeToOperationChange = @changeToOperationChange, ChangeToSignificantBreakdown = @changeToSignificantBreakdown,
          ControlSpecifications = @controlSpecifications, ActualInspectionData = @actualInspectionData,
          Sign_Inspector = @signInspector, Sign_ShiftIncharge = @signShiftIncharge,
          Sign_HofInspection = @signHofInspection, Sign_HofProduction = @signHofProduction,
          Status = @status, UpdatedAt = GETDATE()
        WHERE Id = @id
      `);
    } else {
      const insertResult = await request.query(`
        INSERT INTO dbo.JobSetupVerification (
          MachineShop, PartName, PartNo, OperationNo, OperationDescription,
          ReportDate, Shift, SetterName, ReasonForSetup,
          SettingStartedAt, InspectionTimeStage, SettingFinishedAt, SettingTime, InspectionTimeMetrology, TotalTime,
          RunningItem, RunningMachineNo, RunningFixtureNo, RunningOperationChange, RunningSignificantBreakdown, RunningMcNo, RunningDetail,
          ChangeToItem, ChangeToMachineNo, ChangeToFixtureNo, ChangeToOperationChange, ChangeToSignificantBreakdown,
          ControlSpecifications, ActualInspectionData, IsMasterTemplate,
          Sign_Inspector, Sign_ShiftIncharge, Sign_HofInspection, Sign_HofProduction, Status
        ) VALUES (
          @machineShop, @partName, @partNo, @operationNo, @operationDescription,
          @reportDate, @shift, @setterName, @reasonForSetup,
          @settingStartedAt, @inspectionTimeStage, @settingFinishedAt, @settingTime, @inspectionTimeMetrology, @totalTime,
          @runningItem, @runningMachineNo, @runningFixtureNo, @runningOperationChange, @runningSignificantBreakdown, @runningMcNo, @runningDetail,
          @changeToItem, @changeToMachineNo, @changeToFixtureNo, @changeToOperationChange, @changeToSignificantBreakdown,
          @controlSpecifications, @actualInspectionData, 0,
          @signInspector, @signShiftIncharge, @signHofInspection, @signHofProduction, @status
        );
        SELECT SCOPE_IDENTITY() AS NewId;
      `);
      savedId = insertResult.recordset[0].NewId;
    }

    await transaction.commit();
    return res.status(200).json({ success: true, id: savedId, message: "Job Setup Verification saved successfully" });
  } catch (err) {
    if (transaction) try { await transaction.rollback(); } catch (e) {}
    console.error("Save verification error:", err);
    return res.status(500).json({ error: "Failed to save Job Setup Verification" });
  }
};

// 4. GET SINGLE VERIFICATION RECORD BY ID
const getJobSetupVerificationById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await sql.query`SELECT * FROM dbo.JobSetupVerification WHERE Id = ${id}`;
    if (!result.recordset.length) return res.status(404).json({ error: "Record not found" });
    return res.status(200).json(result.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// 5. PDF REPORT GENERATOR
const generatePdfReport = async (req, res) => {
  try {
    const { partName, operationNo, date, shift, shopId } = req.query;

    if (!partName || !operationNo) {
      return res.status(400).send("partName and operationNo are required.");
    }

    const request = new sql.Request();
    request.input("partName", sql.NVarChar(255), partName);
    request.input("operationNo", sql.NVarChar(100), operationNo);

    let query = `
      SELECT TOP 1 * FROM dbo.JobSetupVerification
      WHERE PartName = @partName AND OperationNo = @operationNo AND IsMasterTemplate = 0
    `;

    if (date) {
      request.input("reportDate", sql.NVarChar(50), String(date).split("T")[0]);
      query += ` AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)`;
    }
    if (shift) {
      request.input("shift", sql.NVarChar(50), shift);
      query += ` AND Shift = @shift`;
    }

    query += ` ORDER BY Id DESC`;

    const result = await request.query(query);
    const record = result.recordset.length > 0 ? result.recordset[0] : null;

    if (!record) {
      return res.status(404).send("No inspection record found to generate PDF.");
    }

    const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=Job_Setup_Verification_${partName}.pdf`);
    doc.pipe(res);

    const totalWidth = doc.page.width - 40;
    const startX = 20;

    // Header Block
    doc.lineWidth(1).strokeColor("black");
    doc.rect(startX, 20, 100, 35).stroke();

    const logoPath = path.join(__dirname, "logo.jpg");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, startX + 10, 25, { width: 80, height: 25 });
    } else {
      doc.font("Helvetica-Bold").fontSize(11).fillColor("black").text("SAKTHI\nAUTO", startX, 28, { width: 100, align: "center" });
    }

    doc.rect(startX + 100, 20, totalWidth - 240, 35).stroke();
    doc.font("Helvetica-Bold").fontSize(13).text("RECORD OF JOB SETUP VERIFICATION", startX + 100, 32, { width: totalWidth - 240, align: "center" });

    doc.rect(startX + totalWidth - 140, 20, 140, 35).stroke();
    doc.font("Helvetica-Bold").fontSize(8).text(`Date: ${record.ReportDate ? new Date(record.ReportDate).toLocaleDateString("en-GB") : "-"} | Shift: ${record.Shift || "1st"}`, startX + totalWidth - 140, 26, { width: 140, align: "center" });
    doc.font("Helvetica").fontSize(7).text("QF/07/MPD-03, Rev.No: 03", startX + totalWidth - 140, 40, { width: 140, align: "center" });

    // Sub-header details
    doc.rect(startX, 58, totalWidth, 40).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("black");
    doc.text(`Part Name: ${record.PartName || "-"}`, startX + 5, 63);
    doc.text(`Operation No: ${record.OperationNo || "-"}`, startX + 5, 74);
    doc.text(`Description: ${record.OperationDescription || "-"}`, startX + 5, 85, { width: 450 });

    doc.text(`Setter Name: ${record.SetterName || "-"}`, startX + 500, 63);
    doc.text(`Setting Time: ${record.SettingTime || "-"}`, startX + 500, 74);
    doc.text(`Total Time: ${record.TotalTime || "-"}`, startX + 500, 85);

    // Actual Values Table
    let tableY = 104;
    const colWidths = [30, 160, 200, 40, 40, 40, 40, 40, 40, 50, totalWidth - 680];
    const headers = ["Sl.No", "Control", "Specification", "LH 1", "RH 1", "LH 2", "RH 2", "LH 3", "RH 3", "Status", "Remarks"];

    const drawHeader = (y) => {
      doc.rect(startX, y, totalWidth, 18).fillAndStroke("#f0f0f0", "black");
      let x = startX;
      doc.fillColor("black").font("Helvetica-Bold").fontSize(7);
      headers.forEach((h, i) => {
        doc.text(h, x + 2, y + 5, { width: colWidths[i] - 4, align: "center" });
        x += colWidths[i];
      });
      return y + 18;
    };

    tableY = drawHeader(tableY);

    const actualRows = record.ActualInspectionData ? JSON.parse(record.ActualInspectionData) : [];
    actualRows.forEach((r, idx) => {
      if (tableY + 16 > doc.page.height - 70) {
        doc.addPage();
        tableY = drawHeader(20);
      }

      doc.rect(startX, tableY, totalWidth, 16).stroke();
      let x = startX;
      doc.fillColor("black").font("Helvetica").fontSize(6.5);

      const values = [
        String(r.slNo || idx + 1),
        r.controlName || "-",
        r.specification || "-",
        r.LH1 || "-",
        r.RH1 || "-",
        r.LH2 || "-",
        r.RH2 || "-",
        r.LH3 || "-",
        r.RH3 || "-",
        r.status || "OK",
        r.remarks || "-",
      ];

      values.forEach((v, i) => {
        doc.text(v, x + 2, tableY + 4, { width: colWidths[i] - 4, align: i === 1 || i === 2 ? "left" : "center" });
        x += colWidths[i];
      });

      tableY += 16;
    });

    // Signatures
    let sigY = Math.max(tableY + 10, doc.page.height - 50);
    const sigColW = totalWidth / 4;

    doc.rect(startX, sigY, totalWidth, 30).stroke();
    doc.font("Helvetica-Bold").fontSize(7);

    doc.text(`INSPECTOR: ${record.Sign_Inspector || "Pending"}`, startX + 5, sigY + 10, { width: sigColW, align: "center" });
    doc.text(`SHIFT INCHARGE: ${record.Sign_ShiftIncharge || "Pending"}`, startX + sigColW, sigY + 10, { width: sigColW, align: "center" });
    doc.text(`HOF-INSPN: ${record.Sign_HofInspection || "Pending"}`, startX + sigColW * 2, sigY + 10, { width: sigColW, align: "center" });
    doc.text(`HOF-PRODN: ${record.Sign_HofProduction || "Pending"}`, startX + sigColW * 3, sigY + 10, { width: sigColW, align: "center" });

    doc.end();
  } catch (err) {
    console.error("PDF generator error:", err);
    if (!res.headersSent) res.status(500).json({ error: "PDF generation failed" });
    else res.end();
  }
};

module.exports = {
  getControlSpecifications,
  saveControlSpecifications,
  saveJobSetupVerification,
  getJobSetupVerificationById,
  generatePdfReport
};