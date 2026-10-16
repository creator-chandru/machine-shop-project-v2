const sql = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ============================================================
// GET ALL PRODUCT ENGINEERS
// ============================================================

const getProductEngineers = async (req, res) => {
  try {
    const result = await new sql.Request().query(`
      SELECT
        id,
        username,
        employeeId
      FROM MachineShopUsers
      WHERE LOWER(LTRIM(RTRIM(role))) = 'productengineer'
      ORDER BY username ASC
    `);

    return res.status(200).json(result.recordset);
  } catch (err) {
    console.error("Error fetching Product Engineers:", err);

    return res.status(500).json({
      error: "Failed to fetch Product Engineers",
    });
  }
};

// ============================================================
// SAVE LEVEL 1 MAINTENANCE CHECKLIST
// ============================================================

const saveLevel1Checklist = async (req, res) => {
  const { header, values, signatures, parameters } = req.body;

  if (!header) {
    return res.status(400).json({
      error: "Header information is required.",
    });
  }

  const machineShop = parseInt(header.machineShop || 3, 10);
  const lineCode = header.lineCode;
  const partName = header.partName || "";
  const partNo = header.partNo || "";
  const machineNo = header.machineNo;
  const opNo = header.opNo || "";

  const checklistDate = header.date
    ? String(header.date).split("T")[0]
    : null;

  const productEngineer = String(
    header.productEngineer || ""
  ).trim();

  const shiftInchargeSignature =
    signatures?.["Shift Incharge"] || "";

  if (
    !Number.isInteger(machineShop) ||
    !lineCode ||
    !machineNo ||
    !checklistDate
  ) {
    return res.status(400).json({
      error: "Machine Shop, Line Code, Machine No, and Date are required.",
    });
  }

  if (!productEngineer) {
    return res.status(400).json({
      error: "Please select a Product Engineer.",
    });
  }

  if (!shiftInchargeSignature) {
    return res.status(400).json({
      error: "Shift Incharge approval is required.",
    });
  }

  if (!Array.isArray(parameters) || parameters.length === 0) {
    return res.status(400).json({
      error: "Checklist parameters are required.",
    });
  }

  let transaction;

  try {
    transaction = new sql.Transaction();
    await transaction.begin();

    // Verify that the selected user is a Product Engineer.

    const peResult = await transaction
      .request()
      .input("username", sql.NVarChar(100), productEngineer)
      .query(`
        SELECT TOP 1 username
        FROM MachineShopUsers
        WHERE username = @username
          AND LOWER(LTRIM(RTRIM(role))) = 'productengineer'
      `);

    if (peResult.recordset.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        error: "Selected Product Engineer is invalid.",
      });
    }

    const verifiedPE = peResult.recordset[0].username;

    // Check whether this record has already been approved.

    const existingResult = await transaction
      .request()
      .input("machineShop", sql.Int, machineShop)
      .input("lineCode", sql.NVarChar(50), lineCode)
      .input("machineNo", sql.NVarChar(50), machineNo)
      .input("checklistDate", sql.Date, checklistDate)
      .query(`
        SELECT DISTINCT peSignature
        FROM Level1MaintenanceChecksheet WITH (UPDLOCK, HOLDLOCK)
        WHERE machineShop = @machineShop
          AND lineCode = @lineCode
          AND machineNo = @machineNo
          AND CONVERT(date, checklistDate) = @checklistDate
      `);

    const alreadyApproved = existingResult.recordset.some((record) =>
      /^Approved\s*\(/i.test(
        String(record.peSignature || "").trim()
      )
    );

    if (alreadyApproved) {
      await transaction.rollback();

      return res.status(409).json({
        error:
          "This checklist has already been approved by the Product Engineer and cannot be overwritten.",
      });
    }

    const peSignature = `Pending [${verifiedPE}]`;

    // Delete existing pending rows before resubmission.

    await transaction
      .request()
      .input("machineShop", sql.Int, machineShop)
      .input("lineCode", sql.NVarChar(50), lineCode)
      .input("machineNo", sql.NVarChar(50), machineNo)
      .input("checklistDate", sql.Date, checklistDate)
      .query(`
        DELETE FROM Level1MaintenanceChecksheet
        WHERE machineShop = @machineShop
          AND lineCode = @lineCode
          AND machineNo = @machineNo
          AND CONVERT(date, checklistDate) = @checklistDate
      `);

    // Insert the checklist rows.

    for (const param of parameters) {
      const value = values?.[param.slNo] || "";

      await transaction
        .request()
        .input("machineShop", sql.Int, machineShop)
        .input("lineCode", sql.NVarChar(50), lineCode)
        .input("partName", sql.NVarChar(200), partName)
        .input("partNo", sql.NVarChar(100), partNo)
        .input("machineNo", sql.NVarChar(50), machineNo)
        .input("opNo", sql.NVarChar(50), opNo)
        .input("checklistDate", sql.Date, checklistDate)
        .input("slNo", sql.Int, param.slNo)
        .input("parameterName", sql.NVarChar(250), param.label)
        .input("specification", sql.NVarChar(500), param.specification)
        .input("checkMethod", sql.NVarChar(100), param.checkMethod)
        .input("value", sql.NVarChar(100), value)
        .input(
          "shiftInchargeSignature",
          sql.NVarChar(100),
          shiftInchargeSignature
        )
        .input("peSignature", sql.NVarChar(100), peSignature)
        .query(`
          INSERT INTO Level1MaintenanceChecksheet
          (
            machineShop,
            lineCode,
            partName,
            partNo,
            machineNo,
            opNo,
            checklistDate,
            slNo,
            parameterName,
            specification,
            checkMethod,
            value,
            shiftInchargeSignature,
            peSignature
          )
          VALUES
          (
            @machineShop,
            @lineCode,
            @partName,
            @partNo,
            @machineNo,
            @opNo,
            @checklistDate,
            @slNo,
            @parameterName,
            @specification,
            @checkMethod,
            @value,
            @shiftInchargeSignature,
            @peSignature
          )
        `);
    }

    await transaction.commit();

    return res.status(201).json({
      message: "Level 1 Maintenance checklist saved successfully.",
      assignedPE: verifiedPE,
      peSignature,
    });
  } catch (err) {
    console.error("Error saving Level 1 checklist:", err);

    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Transaction rollback failed:", rollbackError);
      }
    }

    return res.status(500).json({
      error: "Failed to save Level 1 checklist.",
    });
  }
};

// ============================================================
// GET EXISTING RECORD
// ============================================================

const getLevel1Record = async (req, res) => {
  const { machineShop, lineCode, machineNo, date } = req.query;

  if (!lineCode || !machineNo || !date) {
    return res.status(400).json({
      error: "lineCode, machineNo, and date are required",
    });
  }

  try {
    const cleanDate = String(date).split("T")[0];

    const request = new sql.Request();

    request.input("lineCode", sql.NVarChar(50), lineCode);
    request.input("machineNo", sql.NVarChar(50), machineNo);
    request.input("checklistDate", sql.Date, cleanDate);

    let shopFilter = "";

    if (machineShop) {
      request.input(
        "machineShop",
        sql.Int,
        parseInt(machineShop, 10)
      );

      shopFilter = " AND machineShop = @machineShop";
    }

    const result = await request.query(`
      SELECT
        id,
        machineShop,
        lineCode,
        partName,
        partNo,
        machineNo,
        opNo,
        FORMAT(checklistDate, 'yyyy-MM-dd') AS checklistDate,
        slNo,
        parameterName,
        specification,
        checkMethod,
        value,
        shiftInchargeSignature,
        peSignature
      FROM Level1MaintenanceChecksheet
      WHERE lineCode = @lineCode
        AND machineNo = @machineNo
        AND CONVERT(date, checklistDate) = @checklistDate
        ${shopFilter}
      ORDER BY slNo ASC
    `);

    const records = result.recordset;

    if (!records || records.length === 0) {
      return res.status(200).json(null);
    }

    const first = records[0];
    const values = {};

    records.forEach((record) => {
      values[record.slNo] = record.value || "";
    });

    const peSignature = first.peSignature || "";

    let productEngineer = "";

    const pendingMatch = peSignature.match(
      /^Pending\s*\[(.*?)\]$/i
    );

    const approvedMatch = peSignature.match(
      /^Approved\s*\((.*?)\)$/i
    );

    if (pendingMatch) {
      productEngineer = pendingMatch[1].trim();
    } else if (approvedMatch) {
      productEngineer = approvedMatch[1].trim();
    }

    return res.status(200).json({
      header: {
        machineShop: first.machineShop,
        lineCode: first.lineCode,
        partName: first.partName || "",
        partNo: first.partNo || "",
        machineNo: first.machineNo,
        opNo: first.opNo || "",
        date: first.checklistDate,
        productEngineer,
      },

      values,

      signatures: {
        "Shift Incharge": first.shiftInchargeSignature || "",
        PE: peSignature,
      },
    });
  } catch (err) {
    console.error("Error fetching Level 1 record:", err);

    return res.status(500).json({
      error: "Failed to fetch Level 1 record",
    });
  }
};

// ============================================================
// PRODUCT ENGINEER PENDING REPORTS
// ============================================================

const getPendingLevel1Reports = async (req, res) => {
  const { shopId, peUsername } = req.query;

  if (!peUsername) {
    return res.status(400).json({
      error: "Product Engineer username is required.",
    });
  }

  try {
    const request = new sql.Request();

    request.input(
      "machineShop",
      sql.Int,
      parseInt(shopId || 3, 10)
    );

    request.input(
      "peSignature",
      sql.NVarChar(100),
      `Pending [${peUsername}]`
    );

    const result = await request.query(`
      SELECT DISTINCT
        machineShop,
        lineCode,
        machineNo,
        FORMAT(checklistDate, 'yyyy-MM-dd') AS checklistDate,
        partName,
        partNo,
        opNo,
        shiftInchargeSignature,
        peSignature
      FROM Level1MaintenanceChecksheet
      WHERE machineShop = @machineShop
        AND peSignature = @peSignature
      ORDER BY checklistDate DESC
    `);

    return res.status(200).json(result.recordset);
  } catch (err) {
    console.error("Error fetching pending Level 1 reports:", err);

    return res.status(500).json({
      error: "Failed to fetch pending reports",
    });
  }
};

// ============================================================
// PRODUCT ENGINEER APPROVAL
// ============================================================

const signLevel1PE = async (req, res) => {
  const {
    lineCode,
    machineNo,
    date,
    signature,
    machineShop,
  } = req.body;

  if (!lineCode || !machineNo || !date || !signature) {
    return res.status(400).json({
      error:
        "Line Code, Machine No, Date, and Product Engineer signature are required.",
    });
  }

  try {
    const request = new sql.Request();

    request.input("lineCode", sql.NVarChar(50), lineCode);
    request.input("machineNo", sql.NVarChar(50), machineNo);

    request.input(
      "checklistDate",
      sql.Date,
      String(date).split("T")[0]
    );

    request.input(
      "machineShop",
      sql.Int,
      parseInt(machineShop || 3, 10)
    );

    request.input(
      "pendingSignature",
      sql.NVarChar(100),
      `Pending [${signature}]`
    );

    request.input(
      "approvedSignature",
      sql.NVarChar(100),
      `Approved (${signature})`
    );

    const result = await request.query(`
      UPDATE Level1MaintenanceChecksheet
      SET peSignature = @approvedSignature
      WHERE lineCode = @lineCode
        AND machineNo = @machineNo
        AND machineShop = @machineShop
        AND CONVERT(date, checklistDate) = @checklistDate
        AND peSignature = @pendingSignature
    `);

    if (!result.rowsAffected || result.rowsAffected[0] === 0) {
      return res.status(404).json({
        error:
          "No pending Level 1 Maintenance report assigned to this Product Engineer was found.",
      });
    }

    return res.status(200).json({
      message: "Level 1 Maintenance checklist approved successfully.",
      peSignature: `Approved (${signature})`,
    });
  } catch (err) {
    console.error("Error signing Level 1 checklist:", err);

    return res.status(500).json({
      error: "Failed to approve Level 1 Maintenance checklist.",
    });
  }
};

// ============================================================
// PDF REPORT GENERATOR
// TWO REPORTS PER PAGE
// ============================================================

const generateLevel1Report = async (req, res) => {
  const {
    fromDate,
    toDate,
    shopId,
    lineCode,
    machineNo,
    date,
  } = req.query;

  try {
    const targetShopId = parseInt(shopId || 3, 10);

    const request = new sql.Request();

    request.input("machineShop", sql.Int, targetShopId);

    let whereClause = "WHERE machineShop = @machineShop";

    if (fromDate && toDate) {
      request.input(
        "fromDate",
        sql.NVarChar(50),
        String(fromDate).split("T")[0]
      );

      request.input(
        "toDate",
        sql.NVarChar(50),
        String(toDate).split("T")[0]
      );

      whereClause += `
        AND CONVERT(date, checklistDate) >= CONVERT(date, @fromDate)
        AND CONVERT(date, checklistDate) <= CONVERT(date, @toDate)
      `;
    } else if (date && lineCode && machineNo) {
      request.input("lineCode", sql.NVarChar(50), lineCode);
      request.input("machineNo", sql.NVarChar(50), machineNo);

      request.input(
        "checklistDate",
        sql.NVarChar(50),
        String(date).split("T")[0]
      );

      whereClause += `
        AND lineCode = @lineCode
        AND machineNo = @machineNo
        AND CONVERT(date, checklistDate) = CONVERT(date, @checklistDate)
      `;
    }

    const result = await request.query(`
      SELECT
        id,
        machineShop,
        lineCode,
        partName,
        partNo,
        machineNo,
        opNo,
        FORMAT(checklistDate, 'yyyy-MM-dd') AS checklistDate,
        slNo,
        parameterName,
        specification,
        checkMethod,
        value,
        shiftInchargeSignature,
        peSignature
      FROM Level1MaintenanceChecksheet
      ${whereClause}
      ORDER BY
        checklistDate ASC,
        lineCode ASC,
        machineNo ASC,
        slNo ASC,
        id ASC
    `);

    const records = result.recordset;

    if (!records || records.length === 0) {
      return res.status(404).send(
        "No records found for the selected criteria."
      );
    }

    // ========================================================
    // FETCH DYNAMIC QF HISTORY FOR LEVEL 1
    // ========================================================
    let qfHistory = [];
    try {
      const qfRes = await sql.query(`
        SELECT id, formName, qfValue, date
        FROM Level1MaintenanceQFvalues
        ORDER BY date DESC, id DESC
      `);
      qfHistory = qfRes.recordset || [];
    } catch (qfErr) {
      console.error("Warning: Could not fetch Level1MaintenanceQFvalues:", qfErr.message);
    }

    const getEffectiveQfValue = (recordDateStr) => {
      const fallback = "QF/07/MPD-47, Rev.No: 01 dt 01.12.2025";
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

    // ========================================================
    // GROUP CHECKLIST RECORDS
    // ========================================================

    const groupedMap = new Map();

    records.forEach((record) => {
      const groupKey =
        `${record.lineCode}_${record.machineNo}_${record.checklistDate}`;

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, []);
      }

      groupedMap.get(groupKey).push(record);
    });

    const groups = Array.from(groupedMap.values());

    // ========================================================
    // PDF DOCUMENT
    // ========================================================

    const doc = new PDFDocument({
      margin: 20,
      size: "A4",
      layout: "portrait",
      bufferPages: true,
      autoPageBreak: false,
    });

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Level1_Maintenance_Report.pdf"
    );

    doc.pipe(res);

    const startX = 20;
    const totalWidth = doc.page.width - 40;

    const tableHeaders = [
      "Sl",
      "Checking Parameters",
      "Specification",
      "Check Method",
      "Value",
    ];

    const fractions = [0.08, 0.36, 0.30, 0.16, 0.10];

    const colWidths = fractions.map(
      (fraction) => fraction * totalWidth
    );

    const pad = 3;
    const fontSize = 6.5;

    // ========================================================
    // SIGNATURE FORMAT
    // ========================================================

    const formatSigText = (signature) => {
      if (!signature) {
        return "Pending";
      }

      const trimmed = String(signature).trim();

      if (/^Approved\s*\(/i.test(trimmed)) {
        return trimmed;
      }

      if (/^Pending\s*\[/i.test(trimmed)) {
        return trimmed;
      }

      if (trimmed.toUpperCase() === "APPROVED") {
        return "APPROVED";
      }

      return `APPROVED (${trimmed.toUpperCase()})`;
    };

    // ========================================================
    // DRAW ONE CHECKLIST
    // ========================================================

    const drawEntryBlock = (groupRecords, blockStartY) => {
      const first = groupRecords[0];

      const [yy, mm, dd] = String(
        first.checklistDate
      ).split("-");

      const displayDate = `${dd}/${mm}/${yy}`;
      const effectiveQf = getEffectiveQfValue(first.checklistDate);

      // ======================================================
      // HEADER
      // ======================================================

      const headerH = 34;

      doc.lineWidth(0.8).strokeColor("black");

      doc.rect(
        startX,
        blockStartY,
        80,
        headerH
      ).stroke();

      const logoPath = path.join(
        __dirname,
        "logo.jpg"
      );

      if (fs.existsSync(logoPath)) {
        doc.image(
          logoPath,
          startX + 5,
          blockStartY + 4,
          {
            width: 70,
            height: 25,
          }
        );
      } else {
        doc
          .font("Helvetica-Bold")
          .fontSize(8.5)
          .fillColor("black")
          .text(
            "SAKTHI\nAUTO",
            startX,
            blockStartY + 7,
            {
              width: 80,
              align: "center",
            }
          );
      }

      const midWidth = totalWidth - 235;

      doc.rect(
        startX + 80,
        blockStartY,
        midWidth,
        headerH
      ).stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("black")
        .text(
          "LEVEL 1 MAINTENANCE CHECK SHEET",
          startX + 85,
          blockStartY + 6,
          {
            width: midWidth - 10,
            align: "center",
          }
        );

      doc
        .font("Helvetica")
        .fontSize(6.5)
        .fillColor("black")
        .text(
          `LINE: ${first.lineCode}   |   M/C NO: ${first.machineNo}   |   OP: ${first.opNo || "-"}`,
          startX + 85,
          blockStartY + 20,
          {
            width: midWidth - 10,
            align: "center",
          }
        );

      const rightWidth = 155;

      doc.rect(
        startX + totalWidth - rightWidth,
        blockStartY,
        rightWidth,
        headerH
      ).stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(6.5)
        .fillColor("black")
        .text(
          `PART: ${String(first.partName || "-").substring(0, 30)}`,
          startX + totalWidth - rightWidth + 4,
          blockStartY + 4,
          {
            width: rightWidth - 8,
          }
        );

      doc
        .font("Helvetica")
        .fontSize(6.5)
        .fillColor("black")
        .text(
          `PART NO: ${first.partNo || "-"}`,
          startX + totalWidth - rightWidth + 4,
          blockStartY + 14,
          {
            width: rightWidth - 8,
          }
        );

      doc
        .font("Helvetica")
        .fontSize(6.5)
        .fillColor("black")
        .text(
          `DATE: ${displayDate}`,
          startX + totalWidth - rightWidth + 4,
          blockStartY + 24,
          {
            width: rightWidth - 8,
          }
        );

      // ======================================================
      // TABLE HEADER
      // ======================================================

      let currentY = blockStartY + headerH + 3;

      doc.font("Helvetica-Bold").fontSize(fontSize);

      let colX = startX;

      tableHeaders.forEach((heading, index) => {
        doc
          .rect(
            colX,
            currentY,
            colWidths[index],
            13
          )
          .fillAndStroke("#f0f0f0", "black");

        doc
          .fillColor("black")
          .text(
            heading,
            colX + pad,
            currentY + 3,
            {
              width: colWidths[index] - pad * 2,
              align: "center",
            }
          );

        colX += colWidths[index];
      });

      currentY += 13;

      // ======================================================
      // CHECKLIST ROWS
      // ======================================================

      doc
        .font("Helvetica")
        .fontSize(fontSize)
        .lineWidth(0.5)
        .strokeColor("black");

      groupRecords.forEach((record) => {
        const rowCells = [
          String(record.slNo),
          record.parameterName || "-",
          record.specification || "-",
          record.checkMethod || "-",
          record.value || "-",
        ];

        let rowH = 14;

        rowCells.forEach((cell, index) => {
          const textH =
            doc.heightOfString(String(cell), {
              width: colWidths[index] - pad * 2,
            }) + 4;

          if (textH > rowH) {
            rowH = textH;
          }
        });

        let rowX = startX;

        rowCells.forEach((cell, index) => {
          doc
            .rect(
              rowX,
              currentY,
              colWidths[index],
              rowH
            )
            .stroke();

          doc
            .fillColor("black")
            .text(
              String(cell),
              rowX + pad,
              currentY + 3,
              {
                width: colWidths[index] - pad * 2,
                align:
                  index === 1 || index === 2
                    ? "left"
                    : "center",
              }
            );

          rowX += colWidths[index];
        });

        currentY += rowH;
      });

      // ======================================================
      // SIGNATURES
      // ======================================================

      const sigY = currentY + 4;
      const sigColWidth = totalWidth / 2;

      // SHIFT INCHARGE

      doc
        .lineWidth(0.5)
        .strokeColor("black");

      doc
        .fillColor("black")
        .font("Helvetica-Bold")
        .fontSize(7)
        .text(
          "Shift Incharge Signature",
          startX,
          sigY,
          {
            width: sigColWidth - 10,
            align: "center",
          }
        );

      doc
        .rect(
          startX + 10,
          sigY + 10,
          sigColWidth - 20,
          20
        )
        .stroke();

      const incSig = first.shiftInchargeSignature;

      if (incSig) {
        doc
          .fillColor("#16a34a")
          .font("Helvetica-Bold")
          .fontSize(7)
          .text(
            formatSigText(incSig),
            startX + 10,
            sigY + 16,
            {
              width: sigColWidth - 20,
              align: "center",
            }
          );
      } else {
        doc
          .fillColor("red")
          .font("Helvetica")
          .fontSize(7)
          .text(
            "Pending",
            startX + 10,
            sigY + 16,
            {
              width: sigColWidth - 20,
              align: "center",
            }
          );
      }

      // PRODUCT ENGINEER

      const peX = startX + sigColWidth;

      doc
        .lineWidth(0.5)
        .strokeColor("black");

      doc
        .fillColor("black")
        .font("Helvetica-Bold")
        .fontSize(7)
        .text(
          "Product Engineer Signature",
          peX,
          sigY,
          {
            width: sigColWidth - 10,
            align: "center",
          }
        );

      doc
        .rect(
          peX + 10,
          sigY + 10,
          sigColWidth - 20,
          20
        )
        .stroke();

      const peSig = first.peSignature || "";

      const isApproved = /^Approved\s*\(/i.test(peSig);

      doc
        .fillColor(
          isApproved ? "#16a34a" : "#dc2626"
        )
        .font("Helvetica-Bold")
        .fontSize(7)
        .text(
          formatSigText(peSig),
          peX + 10,
          sigY + 16,
          {
            width: sigColWidth - 20,
            align: "center",
          }
        );

      // ======================================================
      // PRINT QF VALUE BELOW TABLE & SIGNATURES
      // ======================================================

      let qfY = sigY + 30;
      doc
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor("#374151")
        .text(effectiveQf, startX, qfY + 4, { align: "left" });

      return qfY + 16;
    };

    // ========================================================
    // TWO CHECKLISTS PER PAGE
    // ========================================================

    groups.forEach((groupRecords, index) => {
      const positionOnPage = index % 2;

      if (index > 0 && positionOnPage === 0) {
        doc.addPage();
      }

      if (positionOnPage === 0) {
        drawEntryBlock(groupRecords, 16);

        if (index + 1 < groups.length) {
          doc
            .save()
            .lineWidth(0.5)
            .dash(3, { space: 3 })
            .strokeColor("#9ca3af")
            .moveTo(startX, 412)
            .lineTo(startX + totalWidth, 412)
            .stroke()
            .restore();
        }
      } else {
        drawEntryBlock(groupRecords, 422);
      }
    });

    doc.end();
  } catch (err) {
    console.error("PDF generation error:", err);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "PDF generation failed",
      });
    }
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getProductEngineers,
  saveLevel1Checklist,
  getLevel1Record,
  getPendingLevel1Reports,
  signLevel1PE,
  generateLevel1Report,
};