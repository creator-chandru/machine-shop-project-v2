const sql = require('../db');
const PDFDocument = require("pdfkit");
const fs = require('fs');
const path = require('path');

// 1. SAVE OR UPDATE 8D REPORT
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

    // Check if record already exists for this date, customer, partNo
    const checkReq = transaction.request();
    checkReq.input('MachineShop', sql.NVarChar(50), machineShop);
    checkReq.input('Customer', sql.NVarChar(100), customer);
    checkReq.input('PartNo', sql.NVarChar(100), partNo);
    checkReq.input('ReportDate', sql.Date, reportDate);

    const checkRes = await checkReq.query(`
      SELECT Id FROM EightDProblemSolvingReport 
      WHERE MachineShop = @MachineShop 
        AND Customer = @Customer 
        AND PartNo = @PartNo 
        AND CONVERT(date, ReportDate) = CONVERT(date, @ReportDate)
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

    request.input('Sign_TeamLeader', sql.NVarChar(100), signatures?.teamLeader || '');
    request.input('Sign_ProductionHead', sql.NVarChar(100), signatures?.productionHead || '');
    request.input('Sign_QualityHead', sql.NVarChar(100), signatures?.qualityHead || '');
    request.input('Sign_ShiftIncharge', sql.NVarChar(100), signatures?.shiftIncharge || '');

    if (checkRes.recordset.length > 0) {
      request.input('Id', sql.Int, checkRes.recordset[0].Id);
      await request.query(`
        UPDATE EightDProblemSolvingReport SET
          Shift = @Shift, Category = @Category, ProblemFoundBy = @ProblemFoundBy, ProblemFoundByOther = @ProblemFoundByOther,
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
          HorizontalDeployment = @HorizontalDeployment, Sign_TeamLeader = @Sign_TeamLeader,
          Sign_ProductionHead = @Sign_ProductionHead, Sign_QualityHead = @Sign_QualityHead,
          Sign_ShiftIncharge = @Sign_ShiftIncharge, UpdatedAt = GETDATE()
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
          Sign_TeamLeader, Sign_ProductionHead, Sign_QualityHead, Sign_ShiftIncharge
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
          @Sign_TeamLeader, @Sign_ProductionHead, @Sign_QualityHead, @Sign_ShiftIncharge
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

// 2. GET 8D REPORTS
const getEightDReports = async (req, res) => {
  const { machineShop, customer, partNo, date } = req.query;
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

    query += ` ORDER BY Id DESC`;
    const result = await request.query(query);

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
        man: r.FishboneMan ? JSON.parse(r.FishboneMan) : [],
        machine: r.FishboneMachine ? JSON.parse(r.FishboneMachine) : [],
        method: r.FishboneMethod ? JSON.parse(r.FishboneMethod) : [],
        material: r.FishboneMaterial ? JSON.parse(r.FishboneMaterial) : [],
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
        teamLeader: r.Sign_TeamLeader || '',
        productionHead: r.Sign_ProductionHead || '',
        qualityHead: r.Sign_QualityHead || '',
        shiftIncharge: r.Sign_ShiftIncharge || '',
      },
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error('Get 8D Reports Error:', err);
    res.status(500).json({ error: 'Failed to fetch 8D records' });
  }
};

// 3. GET SINGLE REPORT BY ID
const getEightDReportById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await sql.query`SELECT * FROM EightDProblemSolvingReport WHERE Id = ${id}`;
    if (!result.recordset.length) return res.status(404).json({ message: 'Record not found' });
    res.status(200).json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. SIGN APPROVAL
const signEightDApproval = async (req, res) => {
  const { id, role, signature } = req.body;
  try {
    let col = 'Sign_ShiftIncharge';
    if (role === 'qc') col = 'Sign_QualityHead';
    if (role === 'pe' || role === 'hof') col = 'Sign_ProductionHead';

    await sql.query(`UPDATE EightDProblemSolvingReport SET ${col} = ${signature} WHERE Id = ${id}`);
    res.status(200).json({ success: true, message: 'Signed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 5. PDFKIT GENERATOR (2 PAGES LANDSCAPE)
const generateEightDPdf = async (req, res) => {
  const { shopId, customer, partNo, date } = req.query;
  try {
    const request = new sql.Request();
    request.input('shopId', sql.NVarChar(50), String(shopId || 3));
    request.input('customer', sql.NVarChar(100), customer || '');
    request.input('partNo', sql.NVarChar(100), partNo || '');

    const result = await request.query(`
      SELECT TOP 1 * FROM EightDProblemSolvingReport 
      WHERE MachineShop = @shopId AND Customer = @customer AND PartNo = @partNo
      ORDER BY Id DESC
    `);

    if (!result.recordset.length) {
      return res.status(404).send("No 8D record found to preview PDF");
    }

    const r = result.recordset[0];
    const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=8D_Report_${customer}_${partNo}.pdf`);
    doc.pipe(res);

    const fullWidth = doc.page.width - 40;

    // === PAGE 1 ===
    // Header
    doc.lineWidth(1).strokeColor('black').rect(20, 20, 100, 35).stroke();
    doc.font("Helvetica-Bold").fontSize(11).text("SAKTHI\nAUTO", 25, 28, { width: 90, align: "center" });

    doc.rect(120, 20, fullWidth - 240, 35).stroke();
    doc.font("Helvetica-Bold").fontSize(14).text("8D Problem Solving Report", 120, 32, { width: fullWidth - 240, align: "center" });

    doc.rect(fullWidth - 100, 20, 120, 35).stroke();
    doc.font("Helvetica").fontSize(8).text(`Date: ${r.ReportDate ? new Date(r.ReportDate).toLocaleDateString('en-GB') : '-'}`, fullWidth - 95, 26);
    doc.text(`Shift: ${r.Shift || '1ST'}`, fullWidth - 95, 38);

    // Metadata Subheader
    doc.rect(20, 58, fullWidth, 42).stroke();
    doc.fontSize(8).font("Helvetica-Bold");
    doc.text(`Customer: ${r.Customer || '-'}`, 25, 64);
    doc.text(`Part Name: ${r.PartName || '-'}`, 25, 76);
    doc.text(`Part No: ${r.PartNo || '-'}`, 25, 88);
    doc.text(`Category: ${r.Category || 'Quality'}`, 320, 64);
    doc.text(`Problem found by: ${r.ProblemFoundBy || 'Production'}`, 320, 76);
    doc.text(`Scope: ${r.ProblemScope || 'New'} | Alert: ${r.QualityAlert ? 'YES' : 'NO'}`, 520, 64);

    // Problem Description
    doc.rect(20, 103, fullWidth, 35).stroke();
    doc.font("Helvetica-Bold").text("(2a) Problem Description:", 25, 107);
    doc.font("Helvetica").text(r.ProblemDescription || "None", 25, 119, { width: fullWidth - 10 });

    // Fishbone 4M Diagram Box
    doc.rect(20, 142, fullWidth, 180).stroke();
    doc.font("Helvetica-Bold").text("(4) Root cause analysis - Cause & Effect Diagram (Fishbone / Ishikawa 4M):", 25, 147);

    // Fishbone Spine & Branches
    const spineY = 230;
    doc.lineWidth(2).moveTo(40, spineY).lineTo(620, spineY).stroke();

    // MAN (Top-Left)
    doc.lineWidth(1.5).moveTo(140, 165).lineTo(220, spineY).stroke();
    doc.font("Helvetica-Bold").fontSize(9).text("MAN", 125, 155);
    const manCauses = r.FishboneMan ? JSON.parse(r.FishboneMan) : [];
    manCauses.forEach((c, idx) => {
      doc.lineWidth(0.8).moveTo(120, 180 + idx * 16).lineTo(180, 180 + idx * 16).stroke();
      doc.font("Helvetica").fontSize(7).text(c, 50, 175 + idx * 16, { width: 125, align: 'right' });
    });

    // MACHINE (Top-Right)
    doc.lineWidth(1.5).moveTo(380, 165).lineTo(460, spineY).stroke();
    doc.font("Helvetica-Bold").fontSize(9).text("MACHINE", 360, 155);
    const machCauses = r.FishboneMachine ? JSON.parse(r.FishboneMachine) : [];
    machCauses.forEach((c, idx) => {
      doc.lineWidth(0.8).moveTo(360, 180 + idx * 16).lineTo(420, 180 + idx * 16).stroke();
      doc.font("Helvetica").fontSize(7).text(c, 290, 175 + idx * 16, { width: 125, align: 'right' });
    });

    // METHOD (Bottom-Left)
    doc.lineWidth(1.5).moveTo(140, 300).lineTo(220, spineY).stroke();
    doc.font("Helvetica-Bold").fontSize(9).text("METHOD", 115, 305);
    const methCauses = r.FishboneMethod ? JSON.parse(r.FishboneMethod) : [];
    methCauses.forEach((c, idx) => {
      doc.lineWidth(0.8).moveTo(120, 275 - idx * 16).lineTo(180, 275 - idx * 16).stroke();
      doc.font("Helvetica").fontSize(7).text(c, 50, 270 - idx * 16, { width: 125, align: 'right' });
    });

    // MATERIAL (Bottom-Right)
    doc.lineWidth(1.5).moveTo(380, 300).lineTo(460, spineY).stroke();
    doc.font("Helvetica-Bold").fontSize(9).text("MATERIAL", 355, 305);
    const matCauses = r.FishboneMaterial ? JSON.parse(r.FishboneMaterial) : [];
    matCauses.forEach((c, idx) => {
      doc.lineWidth(0.8).moveTo(360, 275 - idx * 16).lineTo(420, 275 - idx * 16).stroke();
      doc.font("Helvetica").fontSize(7).text(c, 290, 270 - idx * 16, { width: 125, align: 'right' });
    });

    // Problem Head Circle
    doc.lineWidth(1.5).circle(680, spineY, 48).stroke();
    doc.font("Helvetica-Bold").fontSize(8).text("PROBLEM", 640, spineY - 25, { width: 80, align: "center" });
    doc.font("Helvetica").fontSize(7).text(r.FishboneProblem || "DEFECT", 640, spineY - 8, { width: 80, align: "center" });

    // Validation Table
    let curY = 326;
    doc.rect(20, curY, fullWidth, 200).stroke();
    doc.font("Helvetica-Bold").fontSize(8).text("(4a) Validation of Potential Causes:", 25, curY + 4);
    
    // Header Row
    doc.rect(20, curY + 16, fullWidth, 18).fillAndStroke('#e5e7eb', '#000');
    doc.fillColor('black').font("Helvetica-Bold").fontSize(7);
    doc.text("Test / Simulation", 25, curY + 22, { width: 220 });
    doc.text("Verification of Possible Causes", 250, curY + 22, { width: 300 });
    doc.text("Date", 560, curY + 22, { width: 60 });
    doc.text("Significant", 630, curY + 22, { width: 80 });
    doc.text("Remarks", 720, curY + 22, { width: 80 });

    const valRows = r.ValidationRows ? JSON.parse(r.ValidationRows) : [];
    let rowY = curY + 34;
    valRows.slice(0, 8).forEach((v) => {
      doc.rect(20, rowY, fullWidth, 18).stroke();
      doc.font("Helvetica").fontSize(6.5);
      doc.text(v.testSimulation || '-', 25, rowY + 5, { width: 220 });
      doc.text(v.verification || '-', 250, rowY + 5, { width: 300 });
      doc.text(v.date ? String(v.date).split('T')[0] : '-', 560, rowY + 5, { width: 60 });
      doc.font(v.significant === 'SIGNIFICANT' ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(v.significant === 'SIGNIFICANT' ? '#dc2626' : '#000')
        .text(v.significant || '-', 630, rowY + 5, { width: 80 });
      doc.fillColor('#000').font("Helvetica").text(v.remarks || '-', 720, rowY + 5, { width: 80 });
      rowY += 18;
    });

    doc.font("Helvetica").fontSize(7).text("QF/08/CAT-05, Rev.No: 02 dt 25.11.2024", 25, doc.page.height - 15);

    // === PAGE 2 ===
    doc.addPage();

    // 4b. 5-Why Analysis
    doc.lineWidth(1).strokeColor('black').rect(20, 20, fullWidth, 140).stroke();
    doc.font("Helvetica-Bold").fontSize(8).text("(4b) Root Cause Analysis (5-Why Analysis):", 25, 25);

    const fiveWhyOcc = r.FiveWhyOccurrence ? JSON.parse(r.FiveWhyOccurrence) : {};
    const fiveWhyDet = r.FiveWhyDetection ? JSON.parse(r.FiveWhyDetection) : {};

    doc.rect(20, 36, fullWidth, 16).fillAndStroke('#f3f4f6', '#000');
    doc.fillColor('#000').font("Helvetica-Bold").fontSize(7);
    doc.text("Analysis", 25, 41, { width: 80 });
    doc.text("Why-1", 110, 41, { width: 130 });
    doc.text("Why-2", 245, 41, { width: 130 });
    doc.text("Why-3", 380, 41, { width: 130 });
    doc.text("Why-4", 515, 41, { width: 130 });
    doc.text("Why-5", 650, 41, { width: 130 });

    // Occurrence
    doc.rect(20, 52, fullWidth, 24).stroke();
    doc.font("Helvetica-Bold").fontSize(7).text("Occurrence", 25, 58);
    doc.font("Helvetica").fontSize(6.5);
    doc.text(fiveWhyOcc.why1 || '-', 110, 56, { width: 130 });
    doc.text(fiveWhyOcc.why2 || '-', 245, 56, { width: 130 });
    doc.text(fiveWhyOcc.why3 || '-', 380, 56, { width: 130 });
    doc.text(fiveWhyOcc.why4 || '-', 515, 56, { width: 130 });
    doc.text(fiveWhyOcc.why5 || '-', 650, 56, { width: 130 });

    doc.rect(20, 76, fullWidth, 16).fillAndStroke('#fff7ed', '#000');
    doc.fillColor('#9a3412').font("Helvetica-Bold").fontSize(7).text(`Root Cause (Occurrence): ${fiveWhyOcc.rootCause || '-'}`, 25, 80);

    // Detection
    doc.rect(20, 92, fullWidth, 24).stroke();
    doc.fillColor('#000').font("Helvetica-Bold").fontSize(7).text("Detection", 25, 98);
    doc.font("Helvetica").fontSize(6.5);
    doc.text(fiveWhyDet.why1 || '-', 110, 96, { width: 130 });
    doc.text(fiveWhyDet.why2 || '-', 245, 96, { width: 130 });
    doc.text(fiveWhyDet.why3 || '-', 380, 96, { width: 130 });
    doc.text(fiveWhyDet.why4 || '-', 515, 96, { width: 130 });
    doc.text(fiveWhyDet.why5 || '-', 650, 96, { width: 130 });

    doc.rect(20, 116, fullWidth, 16).fillAndStroke('#fff7ed', '#000');
    doc.fillColor('#9a3412').font("Helvetica-Bold").fontSize(7).text(`Root Cause (Detection): ${fiveWhyDet.rootCause || '-'}`, 25, 120);

    // PFMEA
    doc.fillColor('#000').rect(20, 132, fullWidth, 24).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).text(`PREDICT: Included in PFMEA?  ${r.PfmeaIncluded || 'NO'}   |   RPN #: ${r.PfmeaRpn || 'N/A'}`, 25, 139);

    // (5) Solutions & Corrective Actions
    doc.rect(20, 168, fullWidth, 140).stroke();
    doc.font("Helvetica-Bold").fontSize(8).text("(6) Permanent Corrective Actions:", 25, 173);

    doc.rect(20, 185, fullWidth, 16).fillAndStroke('#f3f4f6', '#000');
    doc.fillColor('#000').font("Helvetica-Bold").fontSize(7);
    doc.text("Type", 25, 190, { width: 80 });
    doc.text("Action Description", 110, 190, { width: 400 });
    doc.text("Who", 520, 190, { width: 100 });
    doc.text("Due Date", 630, 190, { width: 70 });
    doc.text("Break Point", 710, 190, { width: 70 });

    const pcas = r.CorrectiveActions ? JSON.parse(r.CorrectiveActions) : [];
    let pcaY = 201;
    pcas.forEach((p) => {
      doc.rect(20, pcaY, fullWidth, 22).stroke();
      doc.font("Helvetica-Bold").fontSize(7).text(p.type || 'Action', 25, pcaY + 6);
      doc.font("Helvetica").fontSize(6.5).text(p.action || '-', 110, pcaY + 4, { width: 400 });
      doc.text(p.who || '-', 520, pcaY + 6);
      doc.text(p.dueDate ? String(p.dueDate).split('T')[0] : '-', 630, pcaY + 6);
      doc.text(p.breakPoint ? String(p.breakPoint).split('T')[0] : '-', 710, pcaY + 6);
      pcaY += 22;
    });

    // (8) Signatures Block
    const sigY = 440;
    doc.rect(20, sigY, fullWidth, 65).stroke();
    doc.font("Helvetica-Bold").fontSize(8).text("(8) Closure Sign-off & Approvals:", 25, sigY + 5);

    const sigW = fullWidth / 3;
    doc.rect(20, sigY + 16, sigW, 49).stroke();
    doc.text("Team Leader / Group Leader", 25, sigY + 22, { width: sigW - 10, align: 'center' });
    if (r.Sign_TeamLeader) {
      doc.fillColor('#16a34a').text(`APPROVED: ${r.Sign_TeamLeader}`, 25, sigY + 40, { width: sigW - 10, align: 'center' });
    }

    doc.fillColor('#000').rect(20 + sigW, sigY + 16, sigW, 49).stroke();
    doc.text("Production Engineer / HOF", 20 + sigW + 5, sigY + 22, { width: sigW - 10, align: 'center' });
    if (r.Sign_ProductionHead) {
      doc.fillColor('#16a34a').text(`APPROVED: ${r.Sign_ProductionHead}`, 20 + sigW + 5, sigY + 40, { width: sigW - 10, align: 'center' });
    }

    doc.fillColor('#000').rect(20 + sigW * 2, sigY + 16, sigW, 49).stroke();
    doc.text("Quality Controller / Quality Head", 20 + sigW * 2 + 5, sigY + 22, { width: sigW - 10, align: 'center' });
    if (r.Sign_QualityHead) {
      doc.fillColor('#16a34a').text(`APPROVED: ${r.Sign_QualityHead}`, 20 + sigW * 2 + 5, sigY + 40, { width: sigW - 10, align: 'center' });
    }

    doc.font("Helvetica").fontSize(7).fillColor('#000').text("QF/08/CAT-05, Rev.No: 02 dt 25.11.2024", 25, doc.page.height - 15);

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
  signEightDApproval
};