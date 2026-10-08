const sql = require('../db');
const PDFDocument = require("pdfkit");
const fs = require('fs');
const path = require('path');

// ============================================================
// 0. GET PART SETS FROM M3PartSets
// ============================================================
const getPartSets = async (req, res) => {
  try {
    const result = await sql.query(`
      SELECT 
        Id,
        PartNo,
        PartName
      FROM M3PartSets
      ORDER BY Id ASC
    `);

    return res.status(200).json(result.recordset);
  } catch (err) {
    try {
      const fallbackResult = await sql.query(`SELECT * FROM M3PartSets ORDER BY 1 ASC`);
      const mapped = fallbackResult.recordset.map((r) => {
        const keys = Object.keys(r);
        return {
          Id: r.Id || r.id || r[keys[0]],
          PartNo: r.PartNo || r.partNo || r.idSet || r[keys[1]],
          PartName: r.PartName || r.partName || r.partSet || r[keys[2]]
        };
      });
      return res.status(200).json(mapped);
    } catch (fallbackErr) {
      console.error('Error fetching M3PartSets:', fallbackErr);
      return res.status(500).json({ error: 'Failed to fetch part sets from M3PartSets' });
    }
  }
};

// ============================================================
// 1. SAVE OR UPDATE 8D REPORT
// ============================================================
const saveEightDReport = async (req, res) => {
  const {
    header,
    teamMembers,
    problemScope,
    emergencyActions,
    problemDescription,
    processFlow,
    interimActions,
    fishbone,
    validationRows,
    fiveWhy,
    solution,
    correctiveActions,
    verification,
    signatures
  } = req.body;

  let transaction;
  try {
    transaction = new sql.Transaction();
    await transaction.begin();

    const machineShop = String(header?.machineShop || '3');
    const reportDate = header?.date ? String(header.date).split('T')[0] : null;
    const shift = header?.shift || '1ST';
    const customer = header?.customer || '';
    const partName = header?.partName || '';
    const partNo = header?.partNo || '';
    const category = header?.category || 'Quality';
    const problemFoundBy = header?.problemFoundBy || 'Production';
    const problemFoundByOther = header?.problemFoundByOther || '';
    const assignedQc = header?.assignedQc || '';
    const assignedPe = header?.assignedPe || '';
    const assignedHof = header?.assignedHof || '';

    // Check existing record by Date + Shift + PartNo
    const checkReq = transaction.request();
    checkReq.input('MachineShop', sql.NVarChar(50), machineShop);
    checkReq.input('PartNo', sql.NVarChar(100), partNo);
    checkReq.input('ReportDate', sql.Date, reportDate);
    checkReq.input('Shift', sql.NVarChar(10), shift);

    const checkRes = await checkReq.query(`
      SELECT Id FROM EightDProblemSolvingReport 
      WHERE MachineShop = @MachineShop 
        AND PartNo = @PartNo 
        AND CONVERT(date, ReportDate) = CONVERT(date, @ReportDate)
        AND Shift = @Shift
    `);

    const request = transaction.request();
    request.input('MachineShop', sql.NVarChar(50), machineShop);
    request.input('ReportDate', sql.Date, reportDate);
    request.input('Shift', sql.NVarChar(10), shift);
    request.input('Customer', sql.NVarChar(100), customer);
    request.input('PartName', sql.NVarChar(150), partName);
    request.input('PartNo', sql.NVarChar(100), partNo);
    request.input('Category', sql.NVarChar(50), category);
    request.input('ProblemFoundBy', sql.NVarChar(50), problemFoundBy);
    request.input('ProblemFoundByOther', sql.NVarChar(100), problemFoundByOther);
    request.input('assignedQc', sql.NVarChar(100), assignedQc);
    request.input('assignedPe', sql.NVarChar(100), assignedPe);
    request.input('assignedHof', sql.NVarChar(100), assignedHof);

    request.input('TeamMembers', sql.NVarChar(sql.MAX), JSON.stringify(teamMembers || []));
    request.input('ProblemScope', sql.NVarChar(50), problemScope || 'New');
    request.input('QualityAlert', sql.Bit, emergencyActions?.qualityAlert ? 1 : 0);
    request.input('Segregation_Customer_Qty', sql.NVarChar(50), emergencyActions?.segregationCustomerQty || '');
    request.input('Segregation_Customer_NotOk', sql.NVarChar(50), emergencyActions?.segregationCustomerNotOk || '');
    request.input('Segregation_FG_Qty', sql.NVarChar(50), emergencyActions?.segregationFGQty || '');
    request.input('Segregation_FG_NotOk', sql.NVarChar(50), emergencyActions?.segregationFGNotOk || '');
    request.input('Segregation_WIP_Qty', sql.NVarChar(50), emergencyActions?.segregationWIPQty || '');
    request.input('Segregation_WIP_NotOk', sql.NVarChar(50), emergencyActions?.segregationWIPNotOk || '');
    request.input('IsCustomerVisitRequired', sql.NVarChar(10), emergencyActions?.customerVisitRequired || 'No');
    request.input('ProblemDescription', sql.NVarChar(sql.MAX), problemDescription || '');
    request.input('ProcessFlowSketch', sql.NVarChar(sql.MAX), JSON.stringify(processFlow || []));

    request.input('InterimActions', sql.NVarChar(sql.MAX), JSON.stringify(interimActions || []));
    request.input('FishboneMan', sql.NVarChar(sql.MAX), JSON.stringify(fishbone?.man || []));
    request.input('FishboneMachine', sql.NVarChar(sql.MAX), JSON.stringify(fishbone?.machine || []));
    request.input('FishboneMethod', sql.NVarChar(sql.MAX), JSON.stringify(fishbone?.method || []));
    request.input('FishboneMaterial', sql.NVarChar(sql.MAX), JSON.stringify(fishbone?.material || []));
    request.input('FishboneProblem', sql.NVarChar(255), fishbone?.problem || '');

    request.input('ValidationRows', sql.NVarChar(sql.MAX), JSON.stringify(validationRows || []));
    request.input('FiveWhyOccurrence', sql.NVarChar(sql.MAX), JSON.stringify(fiveWhy?.occurrence || {}));
    request.input('FiveWhyDetection', sql.NVarChar(sql.MAX), JSON.stringify(fiveWhy?.detection || {}));
    request.input('FiveWhySystem', sql.NVarChar(sql.MAX), JSON.stringify(fiveWhy?.system || {}));
    request.input('PfmeaIncluded', sql.NVarChar(10), fiveWhy?.pfmeaIncluded || 'NO');
    request.input('PfmeaRpn', sql.NVarChar(50), fiveWhy?.pfmeaRpn || '');

    request.input('DevelopingSolution', sql.NVarChar(sql.MAX), solution?.developingSolution || '');
    request.input('TrialRunDetails', sql.NVarChar(sql.MAX), solution?.trialRun || '');
    request.input('TrialRunDate', sql.Date, solution?.trialRunDate ? solution.trialRunDate : null);
    request.input('TrialRunSequence', sql.NVarChar(100), solution?.trialRunSequence || '');

    request.input('CorrectiveActions', sql.NVarChar(sql.MAX), JSON.stringify(correctiveActions || []));
    request.input('VerificationQuestions', sql.NVarChar(sql.MAX), JSON.stringify(verification || {}));
    request.input('LessonsLearned', sql.NVarChar(sql.MAX), verification?.lessonsLearned || '');
    request.input('IssueResolved', sql.NVarChar(10), verification?.issueResolved || 'Yes');
    request.input('DateClosed', sql.Date, verification?.dateClosed ? verification.dateClosed : null);
    request.input('AssignedTo', sql.NVarChar(100), verification?.assignedTo || '');
    request.input('TrackingNo', sql.NVarChar(100), verification?.trackingNo || '');
    request.input('EffectivenessMonitoring', sql.NVarChar(sql.MAX), JSON.stringify(verification?.effectiveness || []));
    request.input('HorizontalDeployment', sql.NVarChar(sql.MAX), verification?.horizontalDeployment || '');

    const shiftInchargeSig = signatures?.shiftSupervisorProduction || signatures?.shiftIncharge || '';
    const teamLeaderSig = signatures?.teamLeader || shiftInchargeSig;
    const qualityHeadSig = signatures?.shiftSupervisorQuality || signatures?.qualityHead || '';
    const productionHeadSig = signatures?.hofProduction || signatures?.productionEngineer || signatures?.productionHead || '';

    request.input('Sign_TeamLeader', sql.NVarChar(100), teamLeaderSig);
    request.input('Sign_ProductionHead', sql.NVarChar(100), productionHeadSig);
    request.input('Sign_QualityHead', sql.NVarChar(100), qualityHeadSig);
    request.input('Sign_ShiftIncharge', sql.NVarChar(100), shiftInchargeSig);

    const isFullyApproved = Boolean(
      teamLeaderSig &&
      qualityHeadSig &&
      productionHeadSig &&
      !teamLeaderSig.includes('Pending') &&
      !qualityHeadSig.includes('Pending') &&
      !productionHeadSig.includes('Pending')
    );
    const reportStatus = isFullyApproved ? 'Completed' : 'Submitted';
    request.input('Status', sql.NVarChar(50), reportStatus);

    if (checkRes.recordset.length > 0) {
      request.input('Id', sql.Int, checkRes.recordset[0].Id);
      await request.query(`
        UPDATE EightDProblemSolvingReport SET
          Customer = @Customer, PartName = @PartName, PartNo = @PartNo,
          Category = @Category, ProblemFoundBy = @ProblemFoundBy, ProblemFoundByOther = @ProblemFoundByOther,
          TeamMembers = @TeamMembers, ProblemScope = @ProblemScope, QualityAlert = @QualityAlert,
          Segregation_Customer_Qty = @Segregation_Customer_Qty, Segregation_Customer_NotOk = @Segregation_Customer_NotOk,
          Segregation_FG_Qty = @Segregation_FG_Qty, Segregation_FG_NotOk = @Segregation_FG_NotOk,
          Segregation_WIP_Qty = @Segregation_WIP_Qty, Segregation_WIP_NotOk = @Segregation_WIP_NotOk,
          IsCustomerVisitRequired = @IsCustomerVisitRequired, ProblemDescription = @ProblemDescription,
          ProcessFlowSketch = @ProcessFlowSketch, InterimActions = @InterimActions,
          FishboneMan = @FishboneMan, FishboneMachine = @FishboneMachine, FishboneMethod = @FishboneMethod,
          FishboneMaterial = @FishboneMaterial, FishboneProblem = @FishboneProblem,
          ValidationRows = @ValidationRows, FiveWhyOccurrence = @FiveWhyOccurrence, FiveWhyDetection = @FiveWhyDetection,
          FiveWhySystem = @FiveWhySystem, PfmeaIncluded = @PfmeaIncluded, PfmeaRpn = @PfmeaRpn,
          DevelopingSolution = @DevelopingSolution, TrialRunDetails = @TrialRunDetails,
          TrialRunDate = @TrialRunDate, TrialRunSequence = @TrialRunSequence,
          CorrectiveActions = @CorrectiveActions, VerificationQuestions = @VerificationQuestions,
          LessonsLearned = @LessonsLearned, IssueResolved = @IssueResolved, DateClosed = @DateClosed,
          AssignedTo = @AssignedTo, TrackingNo = @TrackingNo, EffectivenessMonitoring = @EffectivenessMonitoring,
          HorizontalDeployment = @HorizontalDeployment,
          Sign_TeamLeader = @Sign_TeamLeader,
          Sign_ProductionHead = @Sign_ProductionHead,
          Sign_QualityHead = @Sign_QualityHead,
          Sign_ShiftIncharge = @Sign_ShiftIncharge,
          assignedQc = @assignedQc,
          assignedPe = @assignedPe,
          assignedHof = @assignedHof,
          Status = @Status,
          UpdatedAt = GETDATE()
        WHERE Id = @Id
      `);
    } else {
      await request.query(`
        INSERT INTO EightDProblemSolvingReport (
          MachineShop, ReportDate, Shift, Customer, PartName, PartNo, Category, ProblemFoundBy, ProblemFoundByOther,
          TeamMembers, ProblemScope, QualityAlert, Segregation_Customer_Qty, Segregation_Customer_NotOk,
          Segregation_FG_Qty, Segregation_FG_NotOk, Segregation_WIP_Qty, Segregation_WIP_NotOk,
          IsCustomerVisitRequired, ProblemDescription, ProcessFlowSketch, InterimActions,
          FishboneMan, FishboneMachine, FishboneMethod, FishboneMaterial, FishboneProblem,
          ValidationRows, FiveWhyOccurrence, FiveWhyDetection, FiveWhySystem, PfmeaIncluded, PfmeaRpn,
          DevelopingSolution, TrialRunDetails, TrialRunDate, TrialRunSequence,
          CorrectiveActions, VerificationQuestions, LessonsLearned, IssueResolved, DateClosed,
          AssignedTo, TrackingNo, EffectivenessMonitoring, HorizontalDeployment,
          Sign_TeamLeader, Sign_ProductionHead, Sign_QualityHead, Sign_ShiftIncharge,
          assignedQc, assignedPe, assignedHof, Status
        ) VALUES (
          @MachineShop, @ReportDate, @Shift, @Customer, @PartName, @PartNo, @Category, @ProblemFoundBy, @ProblemFoundByOther,
          @TeamMembers, @ProblemScope, @QualityAlert, @Segregation_Customer_Qty, @Segregation_Customer_NotOk,
          @Segregation_FG_Qty, @Segregation_FG_NotOk, @Segregation_WIP_Qty, @Segregation_WIP_NotOk,
          @IsCustomerVisitRequired, @ProblemDescription, @ProcessFlowSketch, @InterimActions,
          @FishboneMan, @FishboneMachine, @FishboneMethod, @FishboneMaterial, @FishboneProblem,
          @ValidationRows, @FiveWhyOccurrence, @FiveWhyDetection, @FiveWhySystem, @PfmeaIncluded, @PfmeaRpn,
          @DevelopingSolution, @TrialRunDetails, @TrialRunDate, @TrialRunSequence,
          @CorrectiveActions, @VerificationQuestions, @LessonsLearned, @IssueResolved, @DateClosed,
          @AssignedTo, @TrackingNo, @EffectivenessMonitoring, @HorizontalDeployment,
          @Sign_TeamLeader, @Sign_ProductionHead, @Sign_QualityHead, @Sign_ShiftIncharge,
          @assignedQc, @assignedPe, @assignedHof, @Status
        )
      `);
    }

    await transaction.commit();
    res.status(200).json({ success: true, message: '8D Problem Solving Report saved successfully' });
  } catch (err) {
    if (transaction) try { await transaction.rollback(); } catch (e) {}
    console.error('Save 8D Report Error:', err);
    res.status(500).json({ error: 'Failed to save 8D Report' });
  }
};

// ============================================================
// 2. GET 8D REPORTS
// ============================================================
const getEightDReports = async (req, res) => {
  const { machineShop, customer, partNo, date, shift } = req.query;
  try {
    let query = `SELECT * FROM EightDProblemSolvingReport WHERE 1=1`;
    const request = new sql.Request();

    if (machineShop) {
      request.input('machineShop', sql.NVarChar(50), String(machineShop));
      query += ` AND MachineShop = @machineShop`;
    }
    if (customer) {
      request.input('customer', sql.NVarChar(100), customer);
      query += ` AND Customer = @customer`;
    }
    if (partNo) {
      request.input('partNo', sql.NVarChar(100), partNo);
      query += ` AND PartNo = @partNo`;
    }
    if (date) {
      request.input('reportDate', sql.NVarChar(50), String(date).split('T')[0]);
      query += ` AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)`;
    }
    if (shift) {
      request.input('shift', sql.NVarChar(10), shift);
      query += ` AND Shift = @shift`;
    }

    query += ` ORDER BY Id DESC`;
    const result = await request.query(query);

    const parseFishbone = (raw) => {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return parsed.map((item, idx) =>
          typeof item === "string" ? { text: item, side: idx % 2 === 0 ? "left" : "right" } : item
        );
      } catch (e) {
        return [];
      }
    };

    const formatted = result.recordset.map((r) => ({
      id: r.Id,
      header: {
        machineShop: r.MachineShop,
        date: r.ReportDate ? new Date(r.ReportDate).toISOString().split('T')[0] : '',
        shift: r.Shift || '1ST',
        customer: r.Customer || '',
        partName: r.PartName || '',
        partNo: r.PartNo || '',
        category: r.Category || 'Quality',
        problemFoundBy: r.ProblemFoundBy || 'Production',
        problemFoundByOther: r.ProblemFoundByOther || '',
        assignedQc: r.assignedQc || '',
        assignedPe: r.assignedPe || '',
        assignedHof: r.assignedHof || '',
      },
      teamMembers: r.TeamMembers ? JSON.parse(r.TeamMembers) : [],
      problemScope: r.ProblemScope || 'New',
      emergencyActions: {
        qualityAlert: Boolean(r.QualityAlert),
        segregationCustomerQty: r.Segregation_Customer_Qty || '',
        segregationCustomerNotOk: r.Segregation_Customer_NotOk || '',
        segregationFGQty: r.Segregation_FG_Qty || '',
        segregationFGNotOk: r.Segregation_FG_NotOk || '',
        segregationWIPQty: r.Segregation_WIP_Qty || '',
        segregationWIPNotOk: r.Segregation_WIP_NotOk || '',
        customerVisitRequired: r.IsCustomerVisitRequired || 'No',
      },
      problemDescription: r.ProblemDescription || '',
      processFlow: r.ProcessFlowSketch ? JSON.parse(r.ProcessFlowSketch) : [],
      interimActions: r.InterimActions ? JSON.parse(r.InterimActions) : [],
      fishbone: {
        man: parseFishbone(r.FishboneMan),
        machine: parseFishbone(r.FishboneMachine),
        method: parseFishbone(r.FishboneMethod),
        material: parseFishbone(r.FishboneMaterial),
        problem: r.FishboneProblem || '',
      },
      validationRows: r.ValidationRows ? JSON.parse(r.ValidationRows) : [],
      fiveWhy: {
        occurrence: r.FiveWhyOccurrence ? JSON.parse(r.FiveWhyOccurrence) : {},
        detection: r.FiveWhyDetection ? JSON.parse(r.FiveWhyDetection) : {},
        system: r.FiveWhySystem ? JSON.parse(r.FiveWhySystem) : {},
        pfmeaIncluded: r.PfmeaIncluded || 'NO',
        pfmeaRpn: r.PfmeaRpn || '',
      },
      solution: {
        developingSolution: r.DevelopingSolution || '',
        trialRun: r.TrialRunDetails || '',
        trialRunDate: r.TrialRunDate ? new Date(r.TrialRunDate).toISOString().split('T')[0] : '',
        trialRunSequence: r.TrialRunSequence || '',
      },
      correctiveActions: r.CorrectiveActions ? JSON.parse(r.CorrectiveActions) : [],
      verification: r.VerificationQuestions ? JSON.parse(r.VerificationQuestions) : {},
      signatures: {
        shiftSupervisorProduction: r.Sign_ShiftIncharge || r.Sign_TeamLeader || '',
        shiftSupervisorQuality: r.Sign_QualityHead || '',
        productionEngineer: r.Sign_ProductionHead || '',
        hofProduction: r.Sign_ProductionHead || '',
        teamLeader: r.Sign_TeamLeader || r.Sign_ShiftIncharge || '',
        productionHead: r.Sign_ProductionHead || '',
        qualityHead: r.Sign_QualityHead || '',
      },
      status: r.Status || 'Draft',
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error('Get 8D Reports Error:', err);
    res.status(500).json({ error: 'Failed to fetch 8D records' });
  }
};

// ============================================================
// 3. GET SINGLE REPORT BY ID
// ============================================================
const getEightDReportById = async (req, res) => {
  const { id } = req.params;
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) {
    return res.status(400).json({ error: 'Invalid report ID' });
  }

  try {
    const request = new sql.Request();
    request.input('id', sql.Int, numericId);
    const result = await request.query(`SELECT * FROM EightDProblemSolvingReport WHERE Id = @id`);
    if (!result.recordset.length) return res.status(404).json({ message: 'Record not found' });
    res.status(200).json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// 4. SIGN APPROVAL
// ============================================================
const signEightDApproval = async (req, res) => {
  const { id, role, signature } = req.body;
  try {
    let col = 'Sign_ShiftIncharge';
    if (role === 'qc') col = 'Sign_QualityHead';
    if (role === 'pe' || role === 'hof') col = 'Sign_ProductionHead';

    const reqq = new sql.Request();
    reqq.input('sig', sql.NVarChar(100), signature);
    reqq.input('id', sql.Int, parseInt(id, 10));

    await reqq.query(`UPDATE EightDProblemSolvingReport SET ${col} = @sig, UpdatedAt = GETDATE() WHERE Id = @id`);
    res.status(200).json({ success: true, message: 'Signed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ============================================================
// 5. PDF GENERATOR - STRICT 2-PAGE LANDSCAPE FORMAT
// ============================================================
const generateEightDPdf = async (req, res) => {
  const { shopId, date, shift, partNo, customer } = req.query;
  try {
    if (!date || !partNo) {
      return res.status(400).send("date and partNo are required to generate PDF.");
    }

    const cleanDate = String(date).split('T')[0];
    const request = new sql.Request();
    request.input('shopId', sql.NVarChar(50), String(shopId || 3));
    request.input('partNo', sql.NVarChar(100), String(partNo).trim());
    request.input('reportDate', sql.NVarChar(50), cleanDate);

    let query = `
      SELECT TOP 1 * FROM EightDProblemSolvingReport 
      WHERE MachineShop = @shopId 
        AND PartNo = @partNo 
        AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)
    `;

    if (shift) {
      request.input('shift', sql.NVarChar(10), shift);
      query += ` AND Shift = @shift`;
    }
    if (customer) {
      request.input('customer', sql.NVarChar(100), customer);
      query += ` AND Customer = @customer`;
    }

    query += ` ORDER BY Id DESC`;
    const result = await request.query(query);

    if (!result.recordset.length) {
      return res.status(404).send("No 8D record found for this date, shift, and part number combination.");
    }

    const r = result.recordset[0];

    // Initialize document with autoPageBreak: false to prevent accidental page spills
    const doc = new PDFDocument({ 
      margin: 15, 
      size: "A4", 
      layout: "landscape", 
      autoPageBreak: false 
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=8D_Report_${r.PartNo.replace(/[\/\\?%*:|"<>]/g, '_')}_${cleanDate}.pdf`);
    doc.pipe(res);

    const startX = 15;
    const fullWidth = doc.page.width - 30; // 811.89 pt
    const logoPath = path.join(__dirname, 'logo.jpg');

    // ============================================================
    // ======================== PAGE 1 ============================
    // ============================================================

    // 1. TOP HEADER (Height: 32)
    doc.lineWidth(1).strokeColor('#1f2937');
    doc.rect(startX, 15, 95, 32).stroke();
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, startX + 7, 18, { width: 80, height: 25 });
    } else {
      doc.font("Helvetica-Bold").fontSize(10).fillColor('#1f2937').text("SAKTHI\nAUTO", startX, 19, { width: 95, align: "center" });
    }

    doc.rect(startX + 95, 15, fullWidth - 305, 32).stroke();
    doc.font("Helvetica-Bold").fontSize(13).fillColor('#111827').text("8D Problem Solving Report (Machine Shop)", startX + 95, 24, { width: fullWidth - 305, align: "center" });

    // Top Right Info Box with Revision Code
    doc.rect(startX + fullWidth - 210, 15, 210, 32).stroke();
    doc.font("Helvetica-Bold").fontSize(6.8).fillColor('#374151');
    doc.text("QF/08/CAT-05, Rev.No: 02 dt 25.11.2024", startX + fullWidth - 205, 19, { width: 200, align: 'center' });
    doc.font("Helvetica").fontSize(7);
    doc.text(`Date: ${r.ReportDate ? new Date(r.ReportDate).toLocaleDateString('en-GB') : '-'}   |   Shift: ${r.Shift || '1ST'}   |   Shop: ${r.MachineShop || 3}`, startX + fullWidth - 205, 30, { width: 200, align: 'center' });

    // 2. METADATA SUB-HEADER (Height: 36)
    const metaY = 51;
    doc.rect(startX, metaY, fullWidth, 36).stroke();
    doc.font("Helvetica-Bold").fontSize(7.2).fillColor('#111827');
    doc.text("Customer: ", startX + 8, metaY + 4, { continued: true }).font("Helvetica").text(r.Customer || '-');
    doc.font("Helvetica-Bold").text("Part Name: ", startX + 8, metaY + 15, { continued: true }).font("Helvetica").text(r.PartName || '-', { width: 310, ellipsis: true });
    doc.font("Helvetica-Bold").text("Part No: ", startX + 8, metaY + 26, { continued: true }).font("Helvetica").text(r.PartNo || '-', { width: 310, ellipsis: true });

    doc.font("Helvetica-Bold").text("Category: ", startX + 335, metaY + 4, { continued: true }).font("Helvetica").text(r.Category || 'Quality');
    doc.font("Helvetica-Bold").text("Problem Found By: ", startX + 335, metaY + 15, { continued: true }).font("Helvetica").text(r.ProblemFoundBy || 'Production');
    doc.font("Helvetica-Bold").text("Scope: ", startX + 335, metaY + 26, { continued: true }).font("Helvetica").text(`${r.ProblemScope || 'New'}   |   Quality Alert: ${r.QualityAlert ? 'YES' : 'NO'}`);

    const teamList = r.TeamMembers ? JSON.parse(r.TeamMembers).filter(Boolean).join(", ") : "-";
    doc.font("Helvetica-Bold").text("Team Members: ", startX + 560, metaY + 4, { continued: true }).font("Helvetica").text(teamList || '-', { width: fullWidth - 568 });
    doc.font("Helvetica-Bold").text("Customer Visit Required: ", startX + 560, metaY + 26, { continued: true }).font("Helvetica").text(r.IsCustomerVisitRequired || 'No');

    // 3. PROBLEM DESCRIPTION (Height: 28)
    const descY = 91;
    doc.rect(startX, descY, fullWidth, 28).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor('#111827').text("(2a) Problem Description:", startX + 8, descY + 4);
    doc.font("Helvetica").fontSize(7).fillColor('#374151').text(r.ProblemDescription || "None recorded", startX + 8, descY + 15, { width: fullWidth - 16 });

    // 4. CAUSE & EFFECT (FISHBONE 4M) DIAGRAM (Height: 220)
    const fishY = 123;
    const fishH = 220;
    doc.rect(startX, fishY, fullWidth, fishH).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor('#111827').text("(4) Root Cause Analysis - Ishikawa Cause & Effect (Fishbone 4M):", startX + 8, fishY + 6);

    const spineY = fishY + 110;
    const spineStartX = startX + 30;
    const spineEndX = startX + 630;

    // Center Spine Line
    doc.lineWidth(2.5).strokeColor('#1f2937').moveTo(spineStartX, spineY).lineTo(spineEndX, spineY).stroke();
    doc.moveTo(spineEndX, spineY).lineTo(spineEndX - 9, spineY - 5).lineTo(spineEndX - 9, spineY + 5).fill('#1f2937');

    const parseFishboneSafe = (raw) => {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return parsed.map((item, idx) =>
          typeof item === "string" ? { text: item, side: idx % 2 === 0 ? "left" : "right" } : item
        );
      } catch (e) {
        return [];
      }
    };

    const drawBoneSubBranch = (boneX, boneY, side, text) => {
      if (!text || text === "-") return;
      const isLeft = side === "left";
      const branchWidth = 45;

      if (isLeft) {
        const lineEndX = boneX;
        const lineStartX = boneX - branchWidth;
        doc.lineWidth(0.9).strokeColor('#4b5563').moveTo(lineStartX, boneY).lineTo(lineEndX, boneY).stroke();
        doc.moveTo(lineEndX, boneY).lineTo(lineEndX - 4, boneY - 2.5).lineTo(lineEndX - 4, boneY + 2.5).fill('#4b5563');
        doc.fillColor('#1f2937').font("Helvetica-Bold").fontSize(6.2)
          .text(text, lineStartX - 105, boneY - 3.5, { width: 100, align: 'right', lineBreak: false });
      } else {
        const lineStartX = boneX;
        const lineEndX = boneX + branchWidth;
        doc.lineWidth(0.9).strokeColor('#4b5563').moveTo(lineStartX, boneY).lineTo(lineEndX, boneY).stroke();
        doc.moveTo(lineEndX, boneY).lineTo(lineEndX + 4, boneY - 2.5).lineTo(lineEndX + 4, boneY + 2.5).fill('#4b5563');
        doc.fillColor('#1f2937').font("Helvetica-Bold").fontSize(6.2)
          .text(text, lineEndX + 6, boneY - 3.5, { width: 100, align: 'left', lineBreak: false });
      }
    };

    // --- MAN (Top-Left) ---
    doc.lineWidth(1.8).strokeColor('#1f2937').moveTo(startX + 150, fishY + 25).lineTo(startX + 230, spineY).stroke();
    doc.fillColor('#111827').font("Helvetica-Bold").fontSize(9).text("MAN", startX + 130, fishY + 12);
    parseFishboneSafe(r.FishboneMan).slice(0, 3).forEach((c, idx) => {
      drawBoneSubBranch(startX + 170 + idx * 22, fishY + 45 + idx * 23, c.side || 'left', c.text);
    });

    // --- MACHINE (Top-Right) ---
    doc.lineWidth(1.8).strokeColor('#1f2937').moveTo(startX + 390, fishY + 25).lineTo(startX + 470, spineY).stroke();
    doc.fillColor('#111827').font("Helvetica-Bold").fontSize(9).text("MACHINE", startX + 365, fishY + 12);
    parseFishboneSafe(r.FishboneMachine).slice(0, 3).forEach((c, idx) => {
      drawBoneSubBranch(startX + 410 + idx * 22, fishY + 45 + idx * 23, c.side || 'left', c.text);
    });

    // --- METHOD (Bottom-Left) ---
    doc.lineWidth(1.8).strokeColor('#1f2937').moveTo(startX + 150, fishY + 195).lineTo(startX + 230, spineY).stroke();
    doc.fillColor('#111827').font("Helvetica-Bold").fontSize(9).text("METHOD", startX + 122, fishY + 198);
    parseFishboneSafe(r.FishboneMethod).slice(0, 3).forEach((c, idx) => {
      drawBoneSubBranch(startX + 170 + idx * 22, fishY + 175 - idx * 23, c.side || 'left', c.text);
    });

    // --- MATERIAL (Bottom-Right) ---
    doc.lineWidth(1.8).strokeColor('#1f2937').moveTo(startX + 390, fishY + 195).lineTo(startX + 470, spineY).stroke();
    doc.fillColor('#111827').font("Helvetica-Bold").fontSize(9).text("MATERIAL", startX + 355, fishY + 198);
    parseFishboneSafe(r.FishboneMaterial).slice(0, 3).forEach((c, idx) => {
      drawBoneSubBranch(startX + 410 + idx * 22, fishY + 175 - idx * 23, c.side || 'left', c.text);
    });

    // Problem Circle Block
    doc.lineWidth(1.8).strokeColor('#1f2937').circle(startX + 710, spineY, 44).stroke();
    doc.fillColor('#111827').font("Helvetica-Bold").fontSize(8).text("PROBLEM", startX + 665, spineY - 20, { width: 90, align: "center" });
    doc.font("Helvetica").fontSize(6.8).text(r.FishboneProblem || "ABS DEFECT", startX + 665, spineY - 6, { width: 90, align: "center" });

    // 5. VALIDATION TABLE (Height: 200)
    const valY = 347;
    doc.rect(startX, valY, fullWidth, 205).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor('#111827').text("(4a) Validation of Potential Causes:", startX + 8, valY + 5);

    doc.rect(startX, valY + 16, fullWidth, 16).fillAndStroke('#f3f4f6', '#1f2937');
    doc.fillColor('black').font("Helvetica-Bold").fontSize(7);
    doc.text("Test / Simulation", startX + 8, valY + 21, { width: 230 });
    doc.text("Verification of Possible Causes", startX + 245, valY + 21, { width: 340 });
    doc.text("Date", startX + 595, valY + 21, { width: 65, align: 'center' });
    doc.text("Significant", startX + 670, valY + 21, { width: 65, align: 'center' });
    doc.text("Remarks", startX + 745, valY + 21, { width: 45, align: 'center' });

    const valRows = r.ValidationRows ? JSON.parse(r.ValidationRows) : [];
    let vy = valY + 32;
    valRows.slice(0, 7).forEach((v) => {
      doc.rect(startX, vy, fullWidth, 24).stroke();
      doc.font("Helvetica-Bold").fontSize(6.8).fillColor('#1f2937');
      doc.text(v.testSimulation || '-', startX + 8, vy + 7, { width: 230, ellipsis: true });
      doc.font("Helvetica").fontSize(6.8);
      doc.text(v.verification || '-', startX + 245, vy + 5, { width: 340, height: 16 });
      doc.text(v.date ? String(v.date).split('T')[0] : '-', startX + 595, vy + 7, { width: 65, align: 'center' });
      doc.font(v.significant === 'SIGNIFICANT' ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(v.significant === 'SIGNIFICANT' ? '#dc2626' : '#111827')
        .text(v.significant || '-', startX + 670, vy + 7, { width: 65, align: 'center' });
      doc.fillColor('#111827').font("Helvetica").text(v.remarks || '-', startX + 745, vy + 7, { width: 45, align: 'center' });
      vy += 24;
    });

    // ============================================================
    // ======================== PAGE 2 ============================
    // ============================================================
    doc.addPage();

    // Page 2 Header with Top Revision Metadata (Height: 28)
    doc.lineWidth(1).strokeColor('#1f2937');
    doc.rect(startX, 15, 95, 28).stroke();
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, startX + 7, 18, { width: 80, height: 22 });
    } else {
      doc.font("Helvetica-Bold").fontSize(9).fillColor('#1f2937').text("SAKTHI AUTO", startX, 22, { width: 95, align: "center" });
    }

    doc.rect(startX + 95, 15, fullWidth - 305, 28).stroke();
    doc.font("Helvetica-Bold").fontSize(11).fillColor('#111827').text("8D Problem Solving Report - Analysis & Corrective Actions", startX + 95, 24, { width: fullWidth - 305, align: "center" });

    // Top Right Info Box with Revision Code
    doc.rect(startX + fullWidth - 210, 15, 210, 28).stroke();
    doc.font("Helvetica-Bold").fontSize(6.8).fillColor('#374151');
    doc.text("QF/08/CAT-05, Rev.No: 02 dt 25.11.2024", startX + fullWidth - 205, 18, { width: 200, align: 'center' });
    doc.font("Helvetica").fontSize(6.8);
    doc.text(`Part: ${r.PartNo || '-'}   |   Date: ${r.ReportDate ? new Date(r.ReportDate).toLocaleDateString('en-GB') : '-'}   |   Shift: ${r.Shift || '1ST'}`, startX + fullWidth - 205, 28, { width: 200, align: 'center' });

    // 1. (4b) Root Cause Analysis (5-Why) (Height: 184)
    const fiveRootY = 47;
    doc.rect(startX, fiveRootY, fullWidth, 184).stroke();
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor('#111827').text("(4b) Root Cause Analysis (5-Why Analysis):", startX + 8, fiveRootY + 6);

    const fiveOcc = r.FiveWhyOccurrence ? JSON.parse(r.FiveWhyOccurrence) : {};
    const fiveDet = r.FiveWhyDetection ? JSON.parse(r.FiveWhyDetection) : {};
    const fiveSys = r.FiveWhySystem ? JSON.parse(r.FiveWhySystem) : {};

    // 5-Why Header
    doc.rect(startX, fiveRootY + 18, fullWidth, 16).fillAndStroke('#f3f4f6', '#1f2937');
    doc.fillColor('black').font("Helvetica-Bold").fontSize(7);
    doc.text("Analysis Category", startX + 8, fiveRootY + 23, { width: 90 });
    doc.text("Why-1", startX + 105, fiveRootY + 23, { width: 130 });
    doc.text("Why-2", startX + 240, fiveRootY + 23, { width: 130 });
    doc.text("Why-3", startX + 375, fiveRootY + 23, { width: 130 });
    doc.text("Why-4", startX + 510, fiveRootY + 23, { width: 130 });
    doc.text("Why-5", startX + 645, fiveRootY + 23, { width: 145 });

    const render5WhyBlock = (yPos, title, obj) => {
      // Why 1-5 Row (Height: 25)
      doc.rect(startX, yPos, fullWidth, 25).stroke();
      doc.font("Helvetica-Bold").fontSize(7).fillColor('#111827').text(title, startX + 8, yPos + 8);
      doc.font("Helvetica").fontSize(6.5).fillColor('#374151');
      doc.text(obj.why1 || '-', startX + 105, yPos + 4, { width: 130, height: 18 });
      doc.text(obj.why2 || '-', startX + 240, yPos + 4, { width: 130, height: 18 });
      doc.text(obj.why3 || '-', startX + 375, yPos + 4, { width: 130, height: 18 });
      doc.text(obj.why4 || '-', startX + 510, yPos + 4, { width: 130, height: 18 });
      doc.text(obj.why5 || '-', startX + 645, yPos + 4, { width: 145, height: 18 });

      // Root Cause Highlight Row (Height: 18)
      doc.rect(startX, yPos + 25, fullWidth, 18).fillAndStroke('#fff7ed', '#1f2937');
      doc.font("Helvetica-Bold").fontSize(7).fillColor('#9a3412')
        .text(`Definitive Root Cause (${title}): `, startX + 8, yPos + 30, { continued: true })
        .font("Helvetica-Bold").fillColor('#111827').text(obj.rootCause || '-');
    };

    render5WhyBlock(fiveRootY + 34, "Occurrence", fiveOcc);
    render5WhyBlock(fiveRootY + 77, "Detection", fiveDet);
    render5WhyBlock(fiveRootY + 120, "System", fiveSys);

    // PFMEA Row
    doc.rect(startX, fiveRootY + 163, fullWidth, 21).stroke();
    doc.fillColor('#111827').font("Helvetica-Bold").fontSize(7.2)
      .text(`PREDICT: Included in PFMEA?  ${r.PfmeaIncluded || 'NO'}       |       RPN #: ${r.PfmeaRpn || 'N/A'}       |       Trial Run Date: ${r.TrialRunDate ? new Date(r.TrialRunDate).toLocaleDateString('en-GB') : '-'}`, startX + 8, fiveRootY + 169);

    // 2. Developing Solution & Trial Run (Height: 65)
    const solY = 236;
    doc.rect(startX, solY, fullWidth, 65).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor('#111827').text("(5) Developing Solution & (5a) Trial Run:", startX + 8, solY + 5);

    const halfSolW = (fullWidth - 8) / 2;
    doc.rect(startX + 4, solY + 16, halfSolW, 43).stroke();
    doc.font("Helvetica-Bold").fontSize(7).fillColor('#111827').text("Solution Description:", startX + 8, solY + 20);
    doc.font("Helvetica").fontSize(6.5).fillColor('#374151').text(r.DevelopingSolution || "None specified", startX + 8, solY + 30, { width: halfSolW - 14 });

    doc.rect(startX + halfSolW + 4, solY + 16, halfSolW, 43).stroke();
    doc.font("Helvetica-Bold").fontSize(7).fillColor('#111827').text("Trial Run / Confirmation Details:", startX + halfSolW + 8, solY + 20);
    doc.font("Helvetica").fontSize(6.5).fillColor('#374151').text(r.TrialRunDetails || "None specified", startX + halfSolW + 8, solY + 30, { width: halfSolW - 14 });

    // 3. Permanent Corrective Actions (Height: 110)
    const pcaY = 306;
    doc.rect(startX, pcaY, fullWidth, 110).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor('#111827').text("(6) Permanent Corrective Actions (PCA):", startX + 8, pcaY + 5);

    doc.rect(startX, pcaY + 16, fullWidth, 16).fillAndStroke('#f3f4f6', '#1f2937');
    doc.fillColor('black').font("Helvetica-Bold").fontSize(7);
    doc.text("Type", startX + 8, pcaY + 21, { width: 70 });
    doc.text("Action Plan Description", startX + 85, pcaY + 21, { width: 440 });
    doc.text("Who", startX + 535, pcaY + 21, { width: 100 });
    doc.text("Due Date", startX + 640, pcaY + 21, { width: 55, align: 'center' });
    doc.text("Break Point", startX + 700, pcaY + 21, { width: 55, align: 'center' });
    doc.text("Status", startX + 760, pcaY + 21, { width: 35, align: 'center' });

    const pcas = r.CorrectiveActions ? JSON.parse(r.CorrectiveActions) : [];
    let pRowY = pcaY + 32;
    pcas.slice(0, 3).forEach((p) => {
      doc.rect(startX, pRowY, fullWidth, 24).stroke();
      doc.font("Helvetica-Bold").fontSize(7).fillColor('#111827').text(p.type || 'Action', startX + 8, pRowY + 7);
      doc.font("Helvetica").fontSize(6.8).text(p.action || '-', startX + 85, pRowY + 4, { width: 440, height: 18 });
      doc.text(p.who || '-', startX + 535, pRowY + 7);
      doc.text(p.dueDate ? String(p.dueDate).split('T')[0] : '-', startX + 640, pRowY + 7, { width: 55, align: 'center' });
      doc.text(p.breakPoint ? String(p.breakPoint).split('T')[0] : '-', startX + 700, pRowY + 7, { width: 55, align: 'center' });
      doc.font("Helvetica-Bold").text(`L-${p.status || 1}`, startX + 760, pRowY + 7, { width: 35, align: 'center' });
      pRowY += 24;
    });

    // 4. Signatures (Height: 52)
    const sigY = 421;
    const sigW = fullWidth / 4;
    const opSig = r.Sign_ShiftIncharge || r.Sign_TeamLeader;
    const qcSig = r.Sign_QualityHead;
    const peSig = r.Sign_ProductionHead;
    const hofSig = r.Sign_ProductionHead;

    const renderSigBox = (colIdx, title, sigVal) => {
      const bx = startX + sigW * colIdx;
      doc.rect(bx, sigY, sigW, 52).stroke();
      doc.fillColor('#111827').font("Helvetica-Bold").fontSize(7).text(title, bx, sigY + 6, { width: sigW, align: 'center' });
      if (sigVal && !String(sigVal).includes('Pending')) {
        doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(8).text(`APPROVED (${String(sigVal).toUpperCase()})`, bx, sigY + 28, { width: sigW, align: 'center' });
      } else {
        doc.fillColor('#dc2626').font('Helvetica').fontSize(7.5).text("Pending", bx, sigY + 28, { width: sigW, align: 'center' });
      }
    };

    renderSigBox(0, "SHIFT SUPERVISOR (PRODUCTION)", opSig);
    renderSigBox(1, "SHIFT SUPERVISOR (QUALITY)", qcSig);
    renderSigBox(2, "PRODUCTION ENGINEER", peSig);
    renderSigBox(3, "HEAD OF PRODUCTION (HOF)", hofSig);

    // 5. Verification Checklist & Lessons Learned (Height: 45)
    const verY = 478;
    doc.rect(startX, verY, fullWidth, 45).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor('#111827').text("(7) Verification Checklist & Lessons Learned:", startX + 8, verY + 4);
    
    const vq = r.VerificationQuestions ? JSON.parse(r.VerificationQuestions) : {};
    doc.font("Helvetica").fontSize(6.5).fillColor('#374151')
      .text(`SOP Updated: ${vq.q2 || 'Y'}   |   Checksheet Updated: ${vq.q4 || 'Y'}   |   PFMEA Updated: ${vq.q5 || 'Y'}   |   Changes Communicated: ${vq.q6 || 'Y'}   |   Issue Resolved: ${r.IssueResolved || 'Yes'}`, startX + 8, verY + 16);
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor('#111827')
      .text("Lessons Learned: ", startX + 8, verY + 28, { continued: true })
      .font("Helvetica").fillColor('#374151').text(r.LessonsLearned || 'Continuous adherence to tool setting & qualification standards maintained.', { width: fullWidth - 20, ellipsis: true });

    doc.end();
  } catch (err) {
    console.error('PDF Generation Error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'PDF generation failed' });
    else res.end();
  }
};

module.exports = {
  saveEightDReport,
  getEightDReports,
  getEightDReportById,
  generateEightDPdf,
  signEightDApproval,
  getPartSets
};