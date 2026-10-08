const sql = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ============================================================
// HELPERS
// ============================================================
const isPendingValue = (v) =>
  !v || String(v).trim() === "" || String(v).trim().toLowerCase() === "pending";

const safeParse = (raw, fallback) => {
  if (raw === null || raw === undefined || raw === "") return fallback;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
};

// Keep only rows that have something in them and renumber Sl.No
const cleanSpecs = (specs) =>
  (Array.isArray(specs) ? specs : [])
    .map((s) => ({
      controlName: String(s?.controlName || "").trim(),
      specification: String(s?.specification || "").trim(),
    }))
    .filter((s) => s.controlName || s.specification)
    .map((s, i) => ({ slNo: i + 1, ...s }));

// ============================================================
// 1. GET MASTER CONTROL SPECIFICATIONS (BY PART NAME ONLY)
// ============================================================
const getControlSpecifications = async (req, res) => {
  const { partName } = req.query;

  if (!partName) {
    return res.status(400).json({ error: "partName is required" });
  }

  try {
    const request = new sql.Request();
    request.input("partName", sql.NVarChar(255), String(partName).trim());

    const result = await request.query(`
      SELECT TOP 1 PartNo, ControlSpecifications, UpdatedBy, UpdatedAt
      FROM dbo.JobSetupControlMaster
      WHERE PartName = @partName
    `);

    if (!result.recordset.length) {
      return res.status(200).json({ partName, partNo: "", specifications: [] });
    }

    const row = result.recordset[0];
    return res.status(200).json({
      partName,
      partNo: row.PartNo || "",
      specifications: safeParse(row.ControlSpecifications, []),
      updatedBy: row.UpdatedBy || "",
      updatedAt: row.UpdatedAt,
    });
  } catch (err) {
    console.error("Get specifications error:", err);
    return res.status(500).json({ error: "Failed to fetch control specifications" });
  }
};

// ============================================================
// 2. LIST ALL PARTS THAT HAVE MASTER SPECIFICATIONS CONFIGURED
// ============================================================
const listMasterSpecifications = async (req, res) => {
  try {
    const result = await new sql.Request().query(`
      SELECT PartName, PartNo, ControlSpecifications, UpdatedBy, UpdatedAt
      FROM dbo.JobSetupControlMaster
      ORDER BY PartName ASC
    `);

    const list = result.recordset.map((r) => ({
      partName: r.PartName,
      partNo: r.PartNo || "",
      controlCount: safeParse(r.ControlSpecifications, []).length,
      updatedBy: r.UpdatedBy || "",
      updatedAt: r.UpdatedAt,
    }));

    return res.status(200).json(list);
  } catch (err) {
    console.error("List master specs error:", err);
    return res.status(500).json({ error: "Failed to list master specifications" });
  }
};

// ============================================================
// 3. SAVE / UPDATE MASTER CONTROL SPECIFICATIONS (BY PART NAME ONLY)
// ============================================================
const saveControlSpecifications = async (req, res) => {
  const { partName, partNo, specifications, username } = req.body;

  if (!partName || !String(partName).trim()) {
    return res.status(400).json({ error: "partName is required" });
  }

  const cleaned = cleanSpecs(specifications);
  if (cleaned.length === 0) {
    return res.status(400).json({ error: "At least one control / specification row is required" });
  }

  let transaction;
  try {
    transaction = new sql.Transaction();
    await transaction.begin();

    const checkReq = transaction.request();
    checkReq.input("partName", sql.NVarChar(255), String(partName).trim());
    const checkRes = await checkReq.query(`
      SELECT Id FROM dbo.JobSetupControlMaster WITH (UPDLOCK, HOLDLOCK)
      WHERE PartName = @partName
    `);

    const request = transaction.request();
    request.input("partName", sql.NVarChar(255), String(partName).trim());
    request.input("partNo", sql.NVarChar(100), partNo || "");
    request.input("controlSpecifications", sql.NVarChar(sql.MAX), JSON.stringify(cleaned));
    request.input("updatedBy", sql.NVarChar(100), username || "");

    if (checkRes.recordset.length > 0) {
      request.input("id", sql.Int, checkRes.recordset[0].Id);
      await request.query(`
        UPDATE dbo.JobSetupControlMaster SET
          PartNo = @partNo,
          ControlSpecifications = @controlSpecifications,
          UpdatedBy = @updatedBy,
          UpdatedAt = GETDATE()
        WHERE Id = @id
      `);
    } else {
      await request.query(`
        INSERT INTO dbo.JobSetupControlMaster (PartName, PartNo, ControlSpecifications, UpdatedBy)
        VALUES (@partName, @partNo, @controlSpecifications, @updatedBy)
      `);
    }

    await transaction.commit();
    return res.status(200).json({
      success: true,
      count: cleaned.length,
      message: "Control specifications saved successfully",
    });
  } catch (err) {
    if (transaction) try { await transaction.rollback(); } catch (e) {}
    console.error("Save specs error:", err);
    return res.status(500).json({ error: "Failed to save control specifications" });
  }
};

// ============================================================
// 4. GET EXISTING FILLED RECORD FOR PART NAME + DATE
// ============================================================
const getJobSetupRecord = async (req, res) => {
  const { partName, date, shopId } = req.query;

  if (!partName || !date) {
    return res.status(400).json({ error: "partName and date are required" });
  }

  try {
    const request = new sql.Request();
    request.input("partName", sql.NVarChar(255), String(partName).trim());
    request.input("reportDate", sql.NVarChar(50), String(date).split("T")[0]);

    let query = `
      SELECT TOP 1 *, CONVERT(varchar(10), ReportDate, 23) AS ReportDateStr
      FROM dbo.JobSetupVerification
      WHERE IsMasterTemplate = 0
        AND PartName = @partName
        AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)
    `;
    if (shopId) {
      request.input("machineShop", sql.VarChar(50), String(shopId));
      query += ` AND MachineShop = @machineShop`;
    }
    query += ` ORDER BY Id DESC`;

    const result = await request.query(query);
    return res.status(200).json({ record: result.recordset[0] || null });
  } catch (err) {
    console.error("Get job setup record error:", err);
    return res.status(500).json({ error: "Failed to fetch job setup record" });
  }
};

// ============================================================
// 5. SAVE JOB SETUP VERIFICATION (CREATE ONLY - LOCKED AFTERWARDS)
// ============================================================
const saveJobSetupVerification = async (req, res) => {
  const {
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
    assignedHofInspection,
    assignedHof,
  } = req.body;

  if (!partName || !date) {
    return res.status(400).json({ error: "partName and date are required" });
  }
  if (!Array.isArray(actualInspectionData) || actualInspectionData.length === 0) {
    return res.status(400).json({ error: "No control specifications to record. Configure the part first." });
  }
  if (!assignedQc || !assignedHofInspection || !assignedHof) {
    return res.status(400).json({ error: "QC, HOF-INSPN and HOF must be assigned" });
  }
  if (isPendingValue(signatures?.shiftIncharge)) {
    return res.status(400).json({ error: "Shift Incharge must sign before submitting" });
  }

  let transaction;
  try {
    transaction = new sql.Transaction();
    await transaction.begin();

    const reportDate = String(date).split("T")[0];
    const shopVal = String(machineShop || "3");

    // Locked record check: a part name + date combination can only be filled once
    const existReq = transaction.request();
    existReq.input("machineShop", sql.VarChar(50), shopVal);
    existReq.input("partName", sql.NVarChar(255), String(partName).trim());
    existReq.input("reportDate", sql.NVarChar(50), reportDate);
    const existing = await existReq.query(`
      SELECT TOP 1 Id FROM dbo.JobSetupVerification WITH (UPDLOCK, HOLDLOCK)
      WHERE IsMasterTemplate = 0
        AND MachineShop = @machineShop
        AND PartName = @partName
        AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)
    `);

    if (existing.recordset.length > 0) {
      await transaction.rollback();
      return res.status(409).json({
        error: "A record already exists for this Part Name and Date. It cannot be modified.",
        id: existing.recordset[0].Id,
      });
    }

    const request = transaction.request();
    request.input("machineShop", sql.VarChar(50), shopVal);
    request.input("partName", sql.NVarChar(255), String(partName).trim());
    request.input("partNo", sql.NVarChar(100), partNo || "");
    request.input("operationNo", sql.NVarChar(100), operationNo || "");
    request.input("operationDescription", sql.NVarChar(1000), operationDescription || "");

    request.input("reportDate", sql.Date, reportDate);
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

    // Shift Incharge signs directly; the other three go out for approval
    request.input("signInspector", sql.NVarChar(100), "Pending");
    request.input("signShiftIncharge", sql.NVarChar(100), signatures.shiftIncharge);
    request.input("signHofInspection", sql.NVarChar(100), "Pending");
    request.input("signHofProduction", sql.NVarChar(100), "Pending");
    request.input("assignedQc", sql.NVarChar(100), assignedQc);
    request.input("assignedHofInspection", sql.NVarChar(100), assignedHofInspection);
    request.input("assignedHofProduction", sql.NVarChar(100), assignedHof);
    request.input("status", sql.NVarChar(50), "Submitted");

    const insertResult = await request.query(`
      INSERT INTO dbo.JobSetupVerification (
        MachineShop, PartName, PartNo, OperationNo, OperationDescription,
        ReportDate, Shift, SetterName, ReasonForSetup,
        SettingStartedAt, InspectionTimeStage, SettingFinishedAt, SettingTime, InspectionTimeMetrology, TotalTime,
        RunningItem, RunningMachineNo, RunningFixtureNo, RunningOperationChange, RunningSignificantBreakdown, RunningMcNo, RunningDetail,
        ChangeToItem, ChangeToMachineNo, ChangeToFixtureNo, ChangeToOperationChange, ChangeToSignificantBreakdown,
        ControlSpecifications, ActualInspectionData, IsMasterTemplate,
        Sign_Inspector, Sign_ShiftIncharge, Sign_HofInspection, Sign_HofProduction,
        AssignedQc, AssignedHofInspection, AssignedHofProduction, Status
      ) VALUES (
        @machineShop, @partName, @partNo, @operationNo, @operationDescription,
        @reportDate, @shift, @setterName, @reasonForSetup,
        @settingStartedAt, @inspectionTimeStage, @settingFinishedAt, @settingTime, @inspectionTimeMetrology, @totalTime,
        @runningItem, @runningMachineNo, @runningFixtureNo, @runningOperationChange, @runningSignificantBreakdown, @runningMcNo, @runningDetail,
        @changeToItem, @changeToMachineNo, @changeToFixtureNo, @changeToOperationChange, @changeToSignificantBreakdown,
        @controlSpecifications, @actualInspectionData, 0,
        @signInspector, @signShiftIncharge, @signHofInspection, @signHofProduction,
        @assignedQc, @assignedHofInspection, @assignedHofProduction, @status
      );
      SELECT SCOPE_IDENTITY() AS NewId;
    `);

    const savedId = insertResult.recordset[0].NewId;
    await transaction.commit();
    return res.status(200).json({ success: true, id: savedId, message: "Job Setup Verification saved successfully" });
  } catch (err) {
    if (transaction) try { await transaction.rollback(); } catch (e) {}
    console.error("Save verification error:", err);
    return res.status(500).json({ error: "Failed to save Job Setup Verification" });
  }
};

// ============================================================
// 6. GET SINGLE VERIFICATION RECORD BY ID
// ============================================================
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

// ============================================================
// 7. HOF-INSPECTION USERS (NEW ROLE) FOR DROPDOWN
// ============================================================
const getHofInspectionUsers = async (req, res) => {
  try {
    const r = await sql.query`
      SELECT username AS name, username, employeeId
      FROM dbo.MachineShopUsers
      WHERE LOWER(role) IN ('hofinspection', 'hofinspn', 'hofinspector', 'hofinsp')
      ORDER BY username ASC
    `;

    const list = r.recordset.length > 0
      ? r.recordset
      : [{ name: "hofinspection", username: "hofinspection", employeeId: "hofinspection" }];

    return res.status(200).json({ hofInspectionList: list });
  } catch (err) {
    console.error("Error fetching HOF Inspection users:", err);
    return res.status(500).json({ error: "Failed to fetch HOF Inspection list" });
  }
};

// ============================================================
// 8. PENDING LISTS (QC / HOF-INSPN / HOF-PRODN)
// ============================================================
const makePendingHandler = (signCol, assignedCol, label) => async (req, res) => {
  try {
    const { name } = req.params;
    const shopId = req.query.shopId;

    const request = new sql.Request();
    request.input("assignedName", sql.NVarChar(100), String(name || "").trim());

    let shopFilter = "";
    if (shopId) {
      request.input("machineShop", sql.VarChar(50), String(shopId));
      shopFilter = " AND MachineShop = @machineShop";
    }

    const result = await request.query(`
      SELECT
        Id AS id,
        MachineShop AS machineShop,
        PartName AS partName,
        PartNo AS partNo,
        OperationNo AS operationNo,
        CONVERT(varchar(10), ReportDate, 23) AS reportDate,
        Shift AS shift,
        SetterName AS shiftInchargeName,
        Sign_Inspector AS verifiedByQcSignature,
        Sign_HofInspection AS hofInspectionSignature,
        Sign_HofProduction AS hofProductionSignature,
        'Pending' AS status
      FROM dbo.JobSetupVerification
      WHERE IsMasterTemplate = 0
        AND ReportDate IS NOT NULL
        AND (${signCol} IS NULL OR ${signCol} = '' OR ${signCol} = 'Pending')
        AND LOWER(ISNULL(${assignedCol}, '')) = LOWER(@assignedName)
        ${shopFilter}
      ORDER BY ReportDate DESC, Id DESC
    `);

    return res.status(200).json(result.recordset);
  } catch (err) {
    console.error(`${label} Job Setup Dashboard Fetch Error:`, err);
    return res.status(500).json({ message: "DB error" });
  }
};

const getQcPending = makePendingHandler("Sign_Inspector", "AssignedQc", "QC");
const getHofInspectionPending = makePendingHandler("Sign_HofInspection", "AssignedHofInspection", "HOF-INSPN");
const getHofProductionPending = makePendingHandler("Sign_HofProduction", "AssignedHofProduction", "HOF-PRODN");

// ============================================================
// 9. SIGN ENDPOINTS (QC = Inspector, HOF-INSPN, HOF-PRODN)
// ============================================================
const doneExpr = (col) => `(ISNULL(${col}, '') NOT IN ('', 'Pending'))`;

const makeSignHandler = ({ signCol, assignedCol, otherCols, label }) => async (req, res) => {
  try {
    const { id, signature, username, qcUsername, hofUsername } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Missing record id" });
    }

    const signer = String(username || qcUsername || hofUsername || signature || "").trim();
    if (!signer) {
      return res.status(400).json({ message: "Missing signer username" });
    }
    const signVal = signature || signer;

    const request = new sql.Request();
    request.input("id", sql.Int, id);
    request.input("signature", sql.NVarChar(100), signVal);
    request.input("signer", sql.NVarChar(100), signer);

    const allOthersDone = otherCols.map(doneExpr).join(" AND ");

    const result = await request.query(`
      UPDATE dbo.JobSetupVerification
      SET ${signCol} = @signature,
          Status = CASE WHEN ${allOthersDone} THEN 'Completed' ELSE 'Submitted' END,
          UpdatedAt = GETDATE()
      WHERE Id = @id
        AND IsMasterTemplate = 0
        AND (${signCol} IS NULL OR ${signCol} = '' OR ${signCol} = 'Pending')
        AND LOWER(ISNULL(${assignedCol}, '')) = LOWER(@signer)
    `);

    if (!result.rowsAffected[0]) {
      return res.status(404).json({ message: `No pending record found for ${label} approval` });
    }

    return res.status(200).json({ success: true, message: `Job Setup Verification approved by ${label} successfully!` });
  } catch (err) {
    console.error(`Sign ${label} Error:`, err);
    return res.status(500).json({ message: "Failed to approve report" });
  }
};

const signQcApproval = makeSignHandler({
  signCol: "Sign_Inspector",
  assignedCol: "AssignedQc",
  otherCols: ["Sign_ShiftIncharge", "Sign_HofInspection", "Sign_HofProduction"],
  label: "QC",
});

const signHofInspectionApproval = makeSignHandler({
  signCol: "Sign_HofInspection",
  assignedCol: "AssignedHofInspection",
  otherCols: ["Sign_Inspector", "Sign_ShiftIncharge", "Sign_HofProduction"],
  label: "HOF-INSPN",
});

const signHofProductionApproval = makeSignHandler({
  signCol: "Sign_HofProduction",
  assignedCol: "AssignedHofProduction",
  otherCols: ["Sign_Inspector", "Sign_ShiftIncharge", "Sign_HofInspection"],
  label: "HOF-PRODN",
});

// ============================================================
// 10. PDF REPORT GENERATOR (PART NAME + DATE)
// ============================================================
const generatePdfReport = async (req, res) => {
  try {
    const { partName, date, shopId } = req.query;

    if (!partName || !date) {
      return res.status(400).send("partName and date are required.");
    }

    const request = new sql.Request();
    request.input("partName", sql.NVarChar(255), String(partName).trim());
    request.input("reportDate", sql.NVarChar(50), String(date).split("T")[0]);

    let query = `
      SELECT TOP 1 *, CONVERT(varchar(10), ReportDate, 23) AS ReportDateStr
      FROM dbo.JobSetupVerification
      WHERE PartName = @partName
        AND IsMasterTemplate = 0
        AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)
    `;

    if (shopId) {
      request.input("machineShop", sql.VarChar(50), String(shopId));
      query += ` AND MachineShop = @machineShop`;
    }

    query += ` ORDER BY Id DESC`;

    const result = await request.query(query);
    const record = result.recordset.length > 0 ? result.recordset[0] : null;

    if (!record) {
      return res.status(404).send("No inspection record found to generate PDF.");
    }

    let displayDate = "-";
    if (record.ReportDateStr) {
      const [yy, mm, dd] = String(record.ReportDateStr).split("-");
      displayDate = `${dd}/${mm}/${yy}`;
    }

    const safeName = String(partName).replace(/[^\w.-]+/g, "_");

    const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=Job_Setup_Verification_${safeName}.pdf`);
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
    doc.font("Helvetica-Bold").fontSize(8).text(`Date: ${displayDate} | Shift: ${record.Shift || "1st"}`, startX + totalWidth - 140, 26, { width: 140, align: "center" });
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

    const actualRows = safeParse(record.ActualInspectionData, []);
    actualRows.forEach((r, idx) => {
      if (tableY + 16 > doc.page.height - 70) {
        doc.addPage();
        tableY = drawHeader(20);
      }

      doc.lineWidth(0.5).strokeColor("black");
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
        doc.text(v, x + 2, tableY + 4, { width: colWidths[i] - 4, height: 10, lineBreak: false, ellipsis: true, align: i === 1 || i === 2 ? "left" : "center" });
        x += colWidths[i];
      });

      tableY += 16;
    });

    // Signatures
    let sigY = Math.max(tableY + 10, doc.page.height - 50);
    const sigColW = totalWidth / 4;

    doc.lineWidth(0.5).strokeColor("black");
    doc.rect(startX, sigY, totalWidth, 30).stroke();
    doc.font("Helvetica-Bold").fontSize(7).fillColor("black");

    const sigText = (label, val) => `${label}: ${isPendingValue(val) ? "Pending" : val}`;

    doc.text(sigText("INSPECTOR", record.Sign_Inspector), startX + 5, sigY + 10, { width: sigColW, align: "center" });
    doc.text(sigText("SHIFT INCHARGE", record.Sign_ShiftIncharge), startX + sigColW, sigY + 10, { width: sigColW, align: "center" });
    doc.text(sigText("HOF-INSPN", record.Sign_HofInspection), startX + sigColW * 2, sigY + 10, { width: sigColW, align: "center" });
    doc.text(sigText("HOF-PRODN", record.Sign_HofProduction), startX + sigColW * 3, sigY + 10, { width: sigColW, align: "center" });

    doc.end();
  } catch (err) {
    console.error("PDF generator error:", err);
    if (!res.headersSent) res.status(500).json({ error: "PDF generation failed" });
    else res.end();
  }
};

module.exports = {
  getControlSpecifications,
  listMasterSpecifications,
  saveControlSpecifications,
  getJobSetupRecord,
  saveJobSetupVerification,
  getJobSetupVerificationById,
  getHofInspectionUsers,
  getQcPending,
  getHofInspectionPending,
  getHofProductionPending,
  signQcApproval,
  signHofInspectionApproval,
  signHofProductionApproval,
  generatePdfReport,
};