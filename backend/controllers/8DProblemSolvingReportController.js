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
    const category = header?.category || '';
    const problemFoundBy = header?.problemFoundBy || '';
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
    request.input('ProblemScope', sql.NVarChar(50), problemScope || '');
    request.input('QualityAlert', sql.Bit, emergencyActions?.qualityAlert ? 1 : 0);
    request.input('Segregation_Customer_Qty', sql.NVarChar(50), emergencyActions?.segregationCustomerQty || '');
    request.input('Segregation_Customer_NotOk', sql.NVarChar(50), emergencyActions?.segregationCustomerNotOk || '');
    request.input('Segregation_FG_Qty', sql.NVarChar(50), emergencyActions?.segregationFGQty || '');
    request.input('Segregation_FG_NotOk', sql.NVarChar(50), emergencyActions?.segregationFGNotOk || '');
    request.input('Segregation_WIP_Qty', sql.NVarChar(50), emergencyActions?.segregationWIPQty || '');
    request.input('Segregation_WIP_NotOk', sql.NVarChar(50), emergencyActions?.segregationWIPNotOk || '');
    request.input('IsCustomerVisitRequired', sql.NVarChar(10), emergencyActions?.customerVisitRequired || '');
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
    request.input('PfmeaIncluded', sql.NVarChar(10), fiveWhy?.pfmeaIncluded || '');
    request.input('PfmeaRpn', sql.NVarChar(50), fiveWhy?.pfmeaRpn || '');

    request.input('DevelopingSolution', sql.NVarChar(sql.MAX), solution?.developingSolution || '');
    request.input('TrialRunDetails', sql.NVarChar(sql.MAX), solution?.trialRun || '');
    request.input('TrialRunDate', sql.Date, solution?.trialRunDate ? solution.trialRunDate : null);
    request.input('TrialRunSequence', sql.NVarChar(100), solution?.trialRunSequence || '');

    request.input('CorrectiveActions', sql.NVarChar(sql.MAX), JSON.stringify(correctiveActions || []));
    request.input('VerificationQuestions', sql.NVarChar(sql.MAX), JSON.stringify(verification || {}));
    request.input('LessonsLearned', sql.NVarChar(sql.MAX), verification?.lessonsLearned || '');
    request.input('IssueResolved', sql.NVarChar(10), verification?.issueResolved || '');
    request.input('DateClosed', sql.Date, verification?.dateClosed ? verification.dateClosed : null);
    request.input('AssignedTo', sql.NVarChar(100), verification?.assignedTo || '');
    request.input('TrackingNo', sql.NVarChar(100), verification?.trackingNo || '');
    request.input('EffectivenessMonitoring', sql.NVarChar(sql.MAX), JSON.stringify(verification?.effectiveness || []));
    request.input('HorizontalDeployment', sql.NVarChar(sql.MAX), verification?.horizontalDeployment || '');

    const shiftInchargeSig = signatures?.shiftSupervisorProduction || signatures?.shiftIncharge || '';
    const teamLeaderSig = signatures?.teamLeader || shiftInchargeSig;
    const qualityHeadSig = signatures?.shiftSupervisorQuality || signatures?.qualityHead || '';
    const peSignature = signatures?.productionEngineer || signatures?.productionHead || '';
    const hofSignature = signatures?.hofProduction || '';

    request.input('Sign_TeamLeader', sql.NVarChar(100), teamLeaderSig);
    request.input('Sign_ProductionHead', sql.NVarChar(100), peSignature);
    request.input('Sign_QualityHead', sql.NVarChar(100), qualityHeadSig);
    request.input('Sign_ShiftIncharge', sql.NVarChar(100), shiftInchargeSig);
    request.input('Sign_HOFProduction', sql.NVarChar(100), hofSignature);

    const isFullyApproved = Boolean(
      teamLeaderSig &&
      qualityHeadSig &&
      peSignature &&
      hofSignature &&
      !teamLeaderSig.includes('Pending') &&
      !qualityHeadSig.includes('Pending') &&
      !peSignature.includes('Pending') &&
      !hofSignature.includes('Pending')
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
          Sign_HOFProduction = @Sign_HOFProduction,
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
          Sign_TeamLeader, Sign_ProductionHead, Sign_QualityHead, Sign_ShiftIncharge, Sign_HOFProduction,
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
          @Sign_TeamLeader, @Sign_ProductionHead, @Sign_QualityHead, @Sign_ShiftIncharge, @Sign_HOFProduction,
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

    const formatted = result.recordset.map((r) => {
      let parsedVerification = {};
      try {
        parsedVerification = r.VerificationQuestions ? JSON.parse(r.VerificationQuestions) : {};
      } catch (e) {
        parsedVerification = {};
      }

      let parsedEffectiveness = [];
      try {
        parsedEffectiveness = r.EffectivenessMonitoring
          ? JSON.parse(r.EffectivenessMonitoring)
          : parsedVerification.effectiveness || [];
      } catch (e) {
        parsedEffectiveness = [];
      }

      let parsedClosureSignOff = [];
      try {
        parsedClosureSignOff = parsedVerification.closureSignOff || [
          { shift: "1ST", teamMembers: "", teamLeader: "", prodQualityHead: "" },
          { shift: "2ND", teamMembers: "", teamLeader: "", prodQualityHead: "" },
          { shift: "3RD", teamMembers: "", teamLeader: "", prodQualityHead: "" },
        ];
      } catch (e) {
        parsedClosureSignOff = [];
      }

      return {
        id: r.Id,
        header: {
          machineShop: r.MachineShop,
          date: r.ReportDate ? new Date(r.ReportDate).toISOString().split('T')[0] : '',
          shift: r.Shift || '1ST',
          customer: r.Customer || '',
          partName: r.PartName || '',
          partNo: r.PartNo || '',
          category: r.Category || '',
          problemFoundBy: r.ProblemFoundBy || '',
          problemFoundByOther: r.ProblemFoundByOther || '',
          assignedQc: r.assignedQc || '',
          assignedPe: r.assignedPe || '',
          assignedHof: r.assignedHof || '',
        },
        teamMembers: r.TeamMembers ? JSON.parse(r.TeamMembers) : ["", "", "", "", "", ""],
        problemScope: r.ProblemScope || '',
        emergencyActions: {
          qualityAlert: Boolean(r.QualityAlert),
          segregationCustomerQty: r.Segregation_Customer_Qty || '',
          segregationCustomerNotOk: r.Segregation_Customer_NotOk || '',
          segregationFGQty: r.Segregation_FG_Qty || '',
          segregationFGNotOk: r.Segregation_FG_NotOk || '',
          segregationWIPQty: r.Segregation_WIP_Qty || '',
          segregationWIPNotOk: r.Segregation_WIP_NotOk || '',
          customerVisitRequired: r.IsCustomerVisitRequired || '',
        },
        problemDescription: r.ProblemDescription || '',
        processFlow: r.ProcessFlowSketch ? JSON.parse(r.ProcessFlowSketch) : [""],
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
          pfmeaIncluded: r.PfmeaIncluded || '',
          pfmeaRpn: r.PfmeaRpn || '',
        },
        solution: {
          developingSolution: r.DevelopingSolution || '',
          trialRun: r.TrialRunDetails || '',
          trialRunDate: r.TrialRunDate ? new Date(r.TrialRunDate).toISOString().split('T')[0] : '',
          trialRunSequence: r.TrialRunSequence || '',
        },
        correctiveActions: r.CorrectiveActions ? JSON.parse(r.CorrectiveActions) : [],
        verification: {
          ...parsedVerification,
          lessonsLearned: r.LessonsLearned || parsedVerification.lessonsLearned || '',
          issueResolved: r.IssueResolved || parsedVerification.issueResolved || '',
          dateClosed: r.DateClosed ? new Date(r.DateClosed).toISOString().split('T')[0] : (parsedVerification.dateClosed || ''),
          assignedTo: r.AssignedTo || parsedVerification.assignedTo || '',
          trackingNo: r.TrackingNo || parsedVerification.trackingNo || '',
          effectiveness: parsedEffectiveness.length > 0 ? parsedEffectiveness : [
            { month: "", rejQty: "", rejPct: "" },
            { month: "", rejQty: "", rejPct: "" },
            { month: "", rejQty: "", rejPct: "" }
          ],
          horizontalDeployment: r.HorizontalDeployment || parsedVerification.horizontalDeployment || '',
          closureSignOff: parsedClosureSignOff
        },
        signatures: {
          shiftSupervisorProduction: r.Sign_ShiftIncharge || r.Sign_TeamLeader || '',
          shiftSupervisorQuality: r.Sign_QualityHead || '',
          productionEngineer: r.Sign_ProductionHead || '',
          hofProduction: r.Sign_HOFProduction || '',
          teamLeader: r.Sign_TeamLeader || r.Sign_ShiftIncharge || '',
          productionHead: r.Sign_ProductionHead || '',
          qualityHead: r.Sign_QualityHead || '',
        },
        status: r.Status || 'Draft',
      };
    });

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
    if (role === 'pe') col = 'Sign_ProductionHead';
    if (role === 'hof') col = 'Sign_HOFProduction';

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
// 5. GET QC PENDING 8D REPORTS
// ============================================================
const getQcEightDReports = async (req, res) => {
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
        Id AS id,
        MachineShop AS machineShop,
        Customer AS customer,
        PartName AS partName,
        PartNo AS partNo,
        FORMAT(ReportDate, 'yyyy-MM-dd') AS reportDate,
        Shift AS shift,
        Sign_TeamLeader AS shiftInchargeName,
        Sign_QualityHead AS verifiedByQcSignature,
        Sign_ProductionHead AS peSignature,
        Sign_HOFProduction AS hofSignature,
        assignedQc,
        assignedPe,
        assignedHof,
        'Pending' AS status
      FROM EightDProblemSolvingReport
      WHERE (Sign_QualityHead IS NULL OR Sign_QualityHead = '' OR Sign_QualityHead = 'Pending')
        AND (assignedQc IS NULL OR assignedQc = '' OR LOWER(assignedQc) = LOWER(@qcName))
        ${shopFilter}
      ORDER BY ReportDate DESC, Id DESC
    `);

    return res.status(200).json(result.recordset);
  } catch (err) {
    console.error('QC 8D Report Fetch Error:', err);
    return res.status(500).json({ message: 'DB error' });
  }
};

// ============================================================
// 6. GET PE PENDING 8D REPORTS
// ============================================================
const getPeEightDReports = async (req, res) => {
  try {
    const { name } = req.params;
    const shopId = req.query.shopId;

    const request = new sql.Request();
    request.input('peName', sql.NVarChar(100), String(name || '').trim());

    let shopFilter = '';
    if (shopId) {
      request.input('machineShop', sql.NVarChar(50), String(shopId));
      shopFilter = ' AND MachineShop = @machineShop';
    }

    const result = await request.query(`
      SELECT 
        Id AS id,
        MachineShop AS machineShop,
        Customer AS customer,
        PartName AS partName,
        PartNo AS partNo,
        FORMAT(ReportDate, 'yyyy-MM-dd') AS reportDate,
        Shift AS shift,
        Sign_TeamLeader AS shiftInchargeName,
        Sign_QualityHead AS verifiedByQcSignature,
        Sign_ProductionHead AS peSignature,
        Sign_HOFProduction AS hofSignature,
        assignedQc,
        assignedPe,
        assignedHof,
        'Pending' AS status
      FROM EightDProblemSolvingReport
      WHERE (Sign_ProductionHead IS NULL OR Sign_ProductionHead = '' OR Sign_ProductionHead = 'Pending')
        AND (assignedPe IS NULL OR assignedPe = '' OR LOWER(assignedPe) = LOWER(@peName))
        ${shopFilter}
      ORDER BY ReportDate DESC, Id DESC
    `);

    return res.status(200).json(result.recordset);
  } catch (err) {
    console.error('PE 8D Report Fetch Error:', err);
    return res.status(500).json({ message: 'DB error' });
  }
};

// ============================================================
// 7. GET HOF PENDING 8D REPORTS
// ============================================================
const getHofEightDReports = async (req, res) => {
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
        Id AS id,
        MachineShop AS machineShop,
        Customer AS customer,
        PartName AS partName,
        PartNo AS partNo,
        FORMAT(ReportDate, 'yyyy-MM-dd') AS reportDate,
        Shift AS shift,
        Sign_TeamLeader AS shiftInchargeName,
        Sign_QualityHead AS verifiedByQcSignature,
        Sign_ProductionHead AS peSignature,
        Sign_HOFProduction AS hofSignature,
        assignedQc,
        assignedPe,
        assignedHof,
        'Pending' AS status
      FROM EightDProblemSolvingReport
      WHERE (Sign_HOFProduction IS NULL OR Sign_HOFProduction = '' OR Sign_HOFProduction = 'Pending')
        AND (assignedHof IS NULL OR assignedHof = '' OR LOWER(assignedHof) = LOWER(@hofName))
        ${shopFilter}
      ORDER BY ReportDate DESC, Id DESC
    `);

    return res.status(200).json(result.recordset);
  } catch (err) {
    console.error('HOF 8D Report Fetch Error:', err);
    return res.status(500).json({ message: 'DB error' });
  }
};

// ============================================================
// 8. SIGN QC APPROVAL FOR 8D
// ============================================================
const signQcEightDApproval = async (req, res) => {
  try {
    const { partNo, date, shift, signature, qcUsername } = req.body;

    if (!partNo || !date) {
      return res.status(400).json({ message: 'Missing partNo or date' });
    }

    const signVal = signature || qcUsername || 'Approved';
    const cleanDate = String(date).split('T')[0];

    const request = new sql.Request();
    request.input('partNo', sql.NVarChar(100), String(partNo).trim());
    request.input('reportDate', sql.NVarChar(50), cleanDate);
    request.input('signature', sql.NVarChar(100), signVal);

    let shiftFilter = '';
    if (shift) {
      request.input('shift', sql.NVarChar(10), shift);
      shiftFilter = ' AND Shift = @shift';
    }

    const result = await request.query(`
      UPDATE EightDProblemSolvingReport 
      SET Sign_QualityHead = @signature,
          Status = CASE WHEN (Sign_ProductionHead IS NOT NULL AND Sign_ProductionHead != '' AND Sign_ProductionHead != 'Pending'
                              AND Sign_HOFProduction IS NOT NULL AND Sign_HOFProduction != '' AND Sign_HOFProduction != 'Pending')
                        THEN 'Completed' ELSE 'Submitted' END,
          UpdatedAt = GETDATE()
      WHERE PartNo = @partNo 
        AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)
        AND (Sign_QualityHead IS NULL OR Sign_QualityHead = '' OR Sign_QualityHead = 'Pending')
        ${shiftFilter}
    `);

    if (!result.rowsAffected[0]) {
      return res.status(404).json({ message: 'No pending 8D records found to approve' });
    }

    return res.status(200).json({ success: true, message: '8D Report approved by QC successfully!' });
  } catch (err) {
    console.error('Sign QC 8D Error:', err);
    return res.status(500).json({ message: 'Failed to approve 8D report' });
  }
};

// ============================================================
// 9. SIGN PE APPROVAL FOR 8D
// ============================================================
const signPeEightDApproval = async (req, res) => {
  try {
    const { partNo, date, shift, signature, peUsername } = req.body;

    if (!partNo || !date) {
      return res.status(400).json({ message: 'Missing partNo or date' });
    }

    const signVal = signature || peUsername || 'Approved';
    const cleanDate = String(date).split('T')[0];

    const request = new sql.Request();
    request.input('partNo', sql.NVarChar(100), String(partNo).trim());
    request.input('reportDate', sql.NVarChar(50), cleanDate);
    request.input('signature', sql.NVarChar(100), signVal);

    let shiftFilter = '';
    if (shift) {
      request.input('shift', sql.NVarChar(10), shift);
      shiftFilter = ' AND Shift = @shift';
    }

    const result = await request.query(`
      UPDATE EightDProblemSolvingReport 
      SET Sign_ProductionHead = @signature,
          Status = CASE WHEN (Sign_QualityHead IS NOT NULL AND Sign_QualityHead != '' AND Sign_QualityHead != 'Pending'
                              AND Sign_HOFProduction IS NOT NULL AND Sign_HOFProduction != '' AND Sign_HOFProduction != 'Pending')
                        THEN 'Completed' ELSE 'Submitted' END,
          UpdatedAt = GETDATE()
      WHERE PartNo = @partNo 
        AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)
        AND (Sign_ProductionHead IS NULL OR Sign_ProductionHead = '' OR Sign_ProductionHead = 'Pending')
        ${shiftFilter}
    `);

    if (!result.rowsAffected[0]) {
      return res.status(404).json({ message: 'No pending 8D records found for PE approval' });
    }

    return res.status(200).json({ success: true, message: '8D Report approved by PE successfully!' });
  } catch (err) {
    console.error('Sign PE 8D Error:', err);
    return res.status(500).json({ message: 'Failed to approve 8D report' });
  }
};

// ============================================================
// 10. SIGN HOF APPROVAL FOR 8D
// ============================================================
const signHofEightDApproval = async (req, res) => {
  try {
    const { partNo, date, shift, signature, hofUsername } = req.body;

    if (!partNo || !date) {
      return res.status(400).json({ message: 'Missing partNo or date' });
    }

    const signVal = signature || hofUsername || 'Approved';
    const cleanDate = String(date).split('T')[0];

    const request = new sql.Request();
    request.input('partNo', sql.NVarChar(100), String(partNo).trim());
    request.input('reportDate', sql.NVarChar(50), cleanDate);
    request.input('signature', sql.NVarChar(100), signVal);

    let shiftFilter = '';
    if (shift) {
      request.input('shift', sql.NVarChar(10), shift);
      shiftFilter = ' AND Shift = @shift';
    }

    const result = await request.query(`
      UPDATE EightDProblemSolvingReport 
      SET Sign_HOFProduction = @signature,
          Status = CASE WHEN (Sign_QualityHead IS NOT NULL AND Sign_QualityHead != '' AND Sign_QualityHead != 'Pending'
                              AND Sign_ProductionHead IS NOT NULL AND Sign_ProductionHead != '' AND Sign_ProductionHead != 'Pending')
                        THEN 'Completed' ELSE 'Submitted' END,
          UpdatedAt = GETDATE()
      WHERE PartNo = @partNo 
        AND CONVERT(date, ReportDate) = CONVERT(date, @reportDate)
        AND (Sign_HOFProduction IS NULL OR Sign_HOFProduction = '' OR Sign_HOFProduction = 'Pending')
        ${shiftFilter}
    `);

    if (!result.rowsAffected[0]) {
      return res.status(404).json({ message: 'No pending 8D records found for HOF approval' });
    }

    return res.status(200).json({ success: true, message: '8D Report approved by HOF successfully!' });
  } catch (err) {
    console.error('Sign HOF 8D Error:', err);
    return res.status(500).json({ message: 'Failed to approve 8D report' });
  }
};

// ============================================================
// 11. PDF GENERATOR - STRICT 2-PAGE LANDSCAPE FORMAT
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

    // Fetch QF History for 8D Report
    let qfHistory = [];
    try {
      const qfRes = await sql.query(`
        SELECT id, formName, qfValue, date 
        FROM EightDReportQFvalues 
        ORDER BY date DESC, id DESC
      `);
      qfHistory = qfRes.recordset || [];
    } catch (qfErr) {
      console.error("Warning: Could not fetch EightDReportQFvalues:", qfErr.message);
    }

    const getEffectiveQfValue = (recordDateStr) => {
      const fallback = "QF/08/CAT-05, Rev.No: 02 dt 25.11.2024";
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

    const effectiveQf = getEffectiveQfValue(r.ReportDate);

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

    // 1. TOP HEADER (Height: 28)
    doc.lineWidth(1).strokeColor('#1f2937');
    doc.rect(startX, 15, 95, 28).stroke();
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, startX + 7, 18, { width: 80, height: 22 });
    } else {
      doc.font("Helvetica-Bold").fontSize(10).fillColor('#1f2937').text("SAKTHI\nAUTO", startX, 18, { width: 95, align: "center" });
    }

    doc.rect(startX + 95, 15, fullWidth - 305, 28).stroke();
    doc.font("Helvetica-Bold").fontSize(13).fillColor('#111827').text("8D Problem Solving Report (Machine Shop)", startX + 95, 22, { width: fullWidth - 305, align: "center" });

    doc.rect(startX + fullWidth - 210, 15, 210, 28).stroke();
    doc.font("Helvetica-Bold").fontSize(6.8).fillColor('#374151');
    doc.text(effectiveQf, startX + fullWidth - 205, 18, { width: 200, align: 'center' });
    doc.font("Helvetica").fontSize(6.8);
    doc.text(`Date: ${r.ReportDate ? new Date(r.ReportDate).toLocaleDateString('en-GB') : '-'}   |   Shift: ${r.Shift || '1ST'}   |   Shop: ${r.MachineShop || 3}`, startX + fullWidth - 205, 28, { width: 200, align: 'center' });

    // 2. METADATA SUB-HEADER & CATEGORY TABLE (Height: 38)
    const metaY = 47;
    doc.rect(startX, metaY, fullWidth, 38).stroke();

    // Category Grid
    const catList = ["Safety", "Quality", "Delivery", "People", "Cost", "Other"];
    const catW = 45;
    catList.forEach((c, idx) => {
      const cx = startX + 6 + idx * catW;
      const isSelected = (r.Category || '').toLowerCase() === c.toLowerCase();
      doc.rect(cx, metaY + 4, catW, 14).fillAndStroke(isSelected ? '#ea580c' : '#f3f4f6', '#9ca3af');
      doc.fillColor(isSelected ? '#ffffff' : '#1f2937').font("Helvetica-Bold").fontSize(6.5).text(c, cx, metaY + 8, { width: catW, align: 'center' });
    });

    doc.font("Helvetica-Bold").fontSize(7).fillColor('#111827');
    doc.text("Customer: ", startX + 285, metaY + 5, { continued: true }).font("Helvetica").text(r.Customer || '-');
    doc.font("Helvetica-Bold").text("Part Name: ", startX + 285, metaY + 16, { continued: true }).font("Helvetica").text(r.PartName || '-', { width: 260, ellipsis: true });
    doc.font("Helvetica-Bold").text("Part No: ", startX + 285, metaY + 27, { continued: true }).font("Helvetica").text(r.PartNo || '-', { width: 260, ellipsis: true });

    doc.font("Helvetica-Bold").text("Problem Found By: ", startX + 560, metaY + 5, { continued: true }).font("Helvetica").text(r.ProblemFoundBy || '-');
    doc.font("Helvetica-Bold").text("Scope: ", startX + 560, metaY + 16, { continued: true }).font("Helvetica").text(`${r.ProblemScope || 'New'}   |   Quality Alert: ${r.QualityAlert ? 'YES' : 'NO'}`);
    const teamList = r.TeamMembers ? JSON.parse(r.TeamMembers).filter(Boolean).join(", ") : "-";
    doc.font("Helvetica-Bold").text("(1) Team: ", startX + 560, metaY + 27, { continued: true }).font("Helvetica").text(teamList || '-', { width: fullWidth - 565, ellipsis: true });

    // 3. (2) EMERGENCY ACTIONS & (2b) DYNAMIC PROCESS FLOW (Height: 64)
    const sec2Y = 88;
    const halfW = (fullWidth - 8) / 2;

    // Left Box: Emergency response & Segregation
    doc.rect(startX, sec2Y, halfW, 64).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor('#111827').text("(2) Problem Scope & Emergency Response Action:", startX + 6, sec2Y + 4);
    
    // Mini segregation table
    const segY = sec2Y + 16;
    doc.rect(startX + 6, segY, halfW - 12, 12).fillAndStroke('#f3f4f6', '#9ca3af');
    doc.fillColor('black').font("Helvetica-Bold").fontSize(6);
    doc.text("Segregation Location", startX + 10, segY + 3, { width: 140 });
    doc.text("Quantity", startX + 160, segY + 3, { width: 100, align: 'center' });
    doc.text("Not OK Qty", startX + 270, segY + 3, { width: 100, align: 'center' });

    const drawSegRow = (ry, loc, qty, notOk) => {
      doc.rect(startX + 6, ry, halfW - 12, 10).stroke();
      doc.font("Helvetica").fontSize(6).fillColor('#111827');
      doc.text(loc, startX + 10, ry + 2);
      doc.text(String(qty || '0'), startX + 160, ry + 2, { width: 100, align: 'center' });
      doc.text(String(notOk || '0'), startX + 270, ry + 2, { width: 100, align: 'center' });
    };
    drawSegRow(segY + 12, "Customer", r.Segregation_Customer_Qty, r.Segregation_Customer_NotOk);
    drawSegRow(segY + 22, "FG (Finished Goods)", r.Segregation_FG_Qty, r.Segregation_FG_NotOk);
    drawSegRow(segY + 32, "WIP / Line", r.Segregation_WIP_Qty, r.Segregation_WIP_NotOk);

    doc.font("Helvetica-Bold").fontSize(6.5).fillColor('#374151').text(`Customer Visit Required: ${r.IsCustomerVisitRequired || 'No'}`, startX + 6, segY + 44);

    // Right Box: (2b) Process Flow Sketch with Dynamic Horizontal & Vertical Sizing
    doc.rect(startX + halfW + 8, sec2Y, halfW, 64).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor('#111827').text("(2b) Sketch / Process Flow Sequence:", startX + halfW + 14, sec2Y + 4);

    let flowSteps = [];
    try {
      flowSteps = r.ProcessFlowSketch ? JSON.parse(r.ProcessFlowSketch) : [];
    } catch (e) {
      flowSteps = [];
    }
    const cleanFlow = flowSteps.filter(Boolean);

    const leftLimit = startX + halfW + 14;
    const rightLimit = startX + fullWidth - 10;
    let fx = leftLimit;
    let fy = sec2Y + 18;
    const maxBoxW = 95; // Maximum horizontal box width in PDF
    const minBoxW = 38;

    cleanFlow.slice(0, 8).forEach((st, idx) => {
      const stepStr = String(st).trim();
      const textWidth = doc.font("Helvetica-Bold").fontSize(5.5).widthOfString(stepStr);

      // Dynamic sizing: grow horizontally up to maxBoxW, else cap width & grow vertically
      let boxW = Math.max(minBoxW, Math.min(maxBoxW, textWidth + 10));
      let boxH = 14;
      if (textWidth + 10 > maxBoxW) {
        boxW = maxBoxW;
        boxH = 20; // Multi-line vertical expansion
      }

      // Check if box exceeds container boundary horizontally; if so, wrap to next line
      if (fx + boxW > rightLimit) {
        fx = leftLimit;
        fy += 22; // Move down to next line
      }

      // Safeguard: keep strictly within the 2B container height
      if (fy + boxH <= sec2Y + 63) {
        doc.rect(fx, fy, boxW, boxH).fillAndStroke('#ffffff', '#1f2937');
        doc.font("Helvetica-Bold").fontSize(5.2).fillColor('#111827')
          .text(stepStr, fx + 2, fy + (boxH > 14 ? 2.5 : 3.5), {
            width: boxW - 4,
            align: 'center',
            height: boxH - 2,
            ellipsis: true
          });

        fx += boxW;

        if (idx < cleanFlow.length - 1 && idx < 7) {
          if (fx + 14 <= rightLimit) {
            const arrowY = fy + boxH / 2;
            const arrowStartX = fx + 2;
            const arrowEndX = fx + 11;

            // Draw orange right arrow using PDF vector lines
            doc.save();
            doc.lineWidth(1.2)
              .strokeColor('#ea580c')
              .moveTo(arrowStartX, arrowY)
              .lineTo(arrowEndX, arrowY)
              .moveTo(arrowEndX - 3, arrowY - 3)
              .lineTo(arrowEndX, arrowY)
              .lineTo(arrowEndX - 3, arrowY + 3)
              .stroke();
            doc.restore();

            fx += 12;
          }
        }
      }
    });

    // 4. (2a) PROBLEM DESCRIPTION (Height: 26)
    const descY = 155;
    doc.rect(startX, descY, fullWidth, 26).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor('#111827').text("(2a) Problem Description:", startX + 6, descY + 3);
    doc.font("Helvetica").fontSize(6.8).fillColor('#1f2937').text(r.ProblemDescription || "None recorded", startX + 6, descY + 12, { width: fullWidth - 12, height: 12, ellipsis: true });

    // 5. (3) INTERIM CONTAINMENT ACTION TABLE (Height: 52)
    const intY = 184;
    doc.rect(startX, intY, fullWidth, 52).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor('#111827').text("(3) Interim Containment Action:", startX + 6, intY + 3);

    const intHeadY = intY + 13;
    doc.rect(startX, intHeadY, fullWidth, 12).fillAndStroke('#f3f4f6', '#1f2937');
    doc.fillColor('black').font("Helvetica-Bold").fontSize(6.5);
    doc.text("Action Description", startX + 6, intHeadY + 2.5, { width: 440 });
    doc.text("Who", startX + 460, intHeadY + 2.5, { width: 140 });
    doc.text("Due Date", startX + 610, intHeadY + 2.5, { width: 90, align: 'center' });
    doc.text("Break Point", startX + 710, intHeadY + 2.5, { width: 90, align: 'center' });

    const interims = r.InterimActions ? JSON.parse(r.InterimActions) : [];
    let curIntY = intHeadY + 12;
    interims.slice(0, 2).forEach((ia) => {
      doc.rect(startX, curIntY, fullWidth, 13).stroke();
      doc.font("Helvetica").fontSize(6.5).fillColor('#1f2937');
      doc.text(ia.action || '-', startX + 6, curIntY + 3, { width: 440, ellipsis: true });
      doc.text(ia.who || '-', startX + 460, curIntY + 3, { width: 140, ellipsis: true });
      doc.text(ia.dueDate ? String(ia.dueDate).split('T')[0] : '-', startX + 610, curIntY + 3, { width: 90, align: 'center' });
      doc.text(ia.breakPoint ? String(ia.breakPoint).split('T')[0] : '-', startX + 710, curIntY + 3, { width: 90, align: 'center' });
      curIntY += 13;
    });

    // 6. (4) FISHBONE CAUSE & EFFECT DIAGRAM (Height: 180)
    const fishY = 239;
    doc.rect(startX, fishY, fullWidth, 180).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor('#111827').text("(4) Root Cause Analysis - Cause & Effect Diagram (Fishbone 4M):", startX + 6, fishY + 4);

    const spineY = fishY + 90;
    const spineStartX = startX + 30;
    const spineEndX = startX + 630;

    // Spine
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
        doc.fillColor('#1f2937').font("Helvetica-Bold").fontSize(6)
          .text(text, lineStartX - 105, boneY - 3, { width: 100, align: 'right', lineBreak: false });
      } else {
        const lineStartX = boneX;
        const lineEndX = boneX + branchWidth;
        doc.lineWidth(0.9).strokeColor('#4b5563').moveTo(lineStartX, boneY).lineTo(lineEndX, boneY).stroke();
        doc.moveTo(lineEndX, boneY).lineTo(lineEndX + 4, boneY - 2.5).lineTo(lineEndX + 4, boneY + 2.5).fill('#4b5563');
        doc.fillColor('#1f2937').font("Helvetica-Bold").fontSize(6)
          .text(text, lineEndX + 6, boneY - 3, { width: 100, align: 'left', lineBreak: false });
      }
    };

    // MAN
    doc.lineWidth(1.8).strokeColor('#1f2937').moveTo(startX + 150, fishY + 20).lineTo(startX + 230, spineY).stroke();
    doc.fillColor('#111827').font("Helvetica-Bold").fontSize(8.5).text("MAN", startX + 130, fishY + 10);
    parseFishboneSafe(r.FishboneMan).slice(0, 3).forEach((c, idx) => {
      drawBoneSubBranch(startX + 170 + idx * 22, fishY + 36 + idx * 19, c.side || 'left', c.text);
    });

    // MACHINE
    doc.lineWidth(1.8).strokeColor('#1f2937').moveTo(startX + 390, fishY + 20).lineTo(startX + 470, spineY).stroke();
    doc.fillColor('#111827').font("Helvetica-Bold").fontSize(8.5).text("MACHINE", startX + 365, fishY + 10);
    parseFishboneSafe(r.FishboneMachine).slice(0, 3).forEach((c, idx) => {
      drawBoneSubBranch(startX + 410 + idx * 22, fishY + 36 + idx * 19, c.side || 'left', c.text);
    });

    // METHOD
    doc.lineWidth(1.8).strokeColor('#1f2937').moveTo(startX + 150, fishY + 160).lineTo(startX + 230, spineY).stroke();
    doc.fillColor('#111827').font("Helvetica-Bold").fontSize(8.5).text("METHOD", startX + 122, fishY + 162);
    parseFishboneSafe(r.FishboneMethod).slice(0, 3).forEach((c, idx) => {
      drawBoneSubBranch(startX + 170 + idx * 22, fishY + 144 - idx * 19, c.side || 'left', c.text);
    });

    // MATERIAL
    doc.lineWidth(1.8).strokeColor('#1f2937').moveTo(startX + 390, fishY + 160).lineTo(startX + 470, spineY).stroke();
    doc.fillColor('#111827').font("Helvetica-Bold").fontSize(8.5).text("MATERIAL", startX + 355, fishY + 162);
    parseFishboneSafe(r.FishboneMaterial).slice(0, 3).forEach((c, idx) => {
      drawBoneSubBranch(startX + 410 + idx * 22, fishY + 144 - idx * 19, c.side || 'left', c.text);
    });

    // Problem Circle Block
    doc.lineWidth(1.8).strokeColor('#1f2937').circle(startX + 710, spineY, 44).stroke();
    doc.fillColor('#111827').font("Helvetica-Bold").fontSize(8).text("PROBLEM", startX + 665, spineY - 18, { width: 90, align: "center" });
    doc.font("Helvetica").fontSize(6.5).text(r.FishboneProblem || "PROBLEM STATEMENT", startX + 665, spineY - 4, { width: 90, align: "center" });

    // 7. (4a) VALIDATION OF POTENTIAL CAUSES (Height: 142)
    const valY = 422;
    doc.rect(startX, valY, fullWidth, 142).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor('#111827').text("(4a) Validation of Potential Causes:", startX + 6, valY + 3);

    doc.rect(startX, valY + 13, fullWidth, 13).fillAndStroke('#f3f4f6', '#1f2937');
    doc.fillColor('black').font("Helvetica-Bold").fontSize(6.5);
    doc.text("Test / Simulation", startX + 6, valY + 16, { width: 230 });
    doc.text("Verification of Possible Causes", startX + 245, valY + 16, { width: 340 });
    doc.text("Date", startX + 595, valY + 16, { width: 65, align: 'center' });
    doc.text("Significant", startX + 670, valY + 16, { width: 65, align: 'center' });
    doc.text("Remarks", startX + 745, valY + 16, { width: 45, align: 'center' });

    const valRows = r.ValidationRows ? JSON.parse(r.ValidationRows) : [];
    let vy = valY + 26;
    valRows.slice(0, 5).forEach((v) => {
      doc.rect(startX, vy, fullWidth, 20).stroke();
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor('#1f2937');
      doc.text(v.testSimulation || '-', startX + 6, vy + 6, { width: 230, ellipsis: true });
      doc.font("Helvetica").fontSize(6.5);
      doc.text(v.verification || '-', startX + 245, vy + 4, { width: 340, height: 14 });
      doc.text(v.date ? String(v.date).split('T')[0] : '-', startX + 595, vy + 6, { width: 65, align: 'center' });
      doc.font(v.significant === 'SIGNIFICANT' ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(v.significant === 'SIGNIFICANT' ? '#dc2626' : '#111827')
        .text(v.significant || '-', startX + 670, vy + 6, { width: 65, align: 'center' });
      doc.fillColor('#111827').font("Helvetica").text(v.remarks || '-', startX + 745, vy + 6, { width: 45, align: 'center' });
      vy += 20;
    });

    // Page 1 Footer
    doc.font("Helvetica").fontSize(6.5).fillColor('#6b7280')
      .text(effectiveQf, startX, 568, { width: fullWidth, align: 'center' });

    // ============================================================
    // ======================== PAGE 2 ============================
    // ============================================================
    doc.addPage();

    // Top Header (Height: 24)
    doc.lineWidth(1).strokeColor('#1f2937');
    doc.rect(startX, 15, 95, 24).stroke();
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, startX + 7, 17, { width: 80, height: 20 });
    } else {
      doc.font("Helvetica-Bold").fontSize(9).fillColor('#1f2937').text("SAKTHI AUTO", startX, 20, { width: 95, align: "center" });
    }

    doc.rect(startX + 95, 15, fullWidth - 305, 24).stroke();
    doc.font("Helvetica-Bold").fontSize(11).fillColor('#111827').text("8D Problem Solving Report - Analysis & Corrective Actions", startX + 95, 21, { width: fullWidth - 305, align: "center" });

    doc.rect(startX + fullWidth - 210, 15, 210, 24).stroke();
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor('#374151');
    doc.text(effectiveQf, startX + fullWidth - 205, 18, { width: 200, align: 'center' });
    doc.font("Helvetica").fontSize(6.5);
    doc.text(`Part: ${r.PartNo || '-'}   |   Date: ${r.ReportDate ? new Date(r.ReportDate).toLocaleDateString('en-GB') : '-'}   |   Shift: ${r.Shift || '1ST'}`, startX + fullWidth - 205, 26, { width: 200, align: 'center' });

    // 1. (4b) 5-WHY ROOT CAUSE ANALYSIS (Height: 126)
    const fiveRootY = 42;
    doc.rect(startX, fiveRootY, fullWidth, 126).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor('#111827').text("(4b) Root Cause Analysis (5-Why Analysis):", startX + 6, fiveRootY + 4);

    const fiveOcc = r.FiveWhyOccurrence ? JSON.parse(r.FiveWhyOccurrence) : {};
    const fiveDet = r.FiveWhyDetection ? JSON.parse(r.FiveWhyDetection) : {};
    const fiveSys = r.FiveWhySystem ? JSON.parse(r.FiveWhySystem) : {};

    doc.rect(startX, fiveRootY + 14, fullWidth, 12).fillAndStroke('#f3f4f6', '#1f2937');
    doc.fillColor('black').font("Helvetica-Bold").fontSize(6.5);
    doc.text("Analysis", startX + 6, fiveRootY + 17, { width: 80 });
    doc.text("Why-1", startX + 90, fiveRootY + 17, { width: 140 });
    doc.text("Why-2", startX + 235, fiveRootY + 17, { width: 140 });
    doc.text("Why-3", startX + 380, fiveRootY + 17, { width: 140 });
    doc.text("Why-4", startX + 525, fiveRootY + 17, { width: 140 });
    doc.text("Why-5", startX + 670, fiveRootY + 17, { width: 135 });

    const render5WhyBlock = (yPos, title, obj) => {
      doc.rect(startX, yPos, fullWidth, 18).stroke();
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor('#111827').text(title, startX + 6, yPos + 6);
      doc.font("Helvetica").fontSize(6).fillColor('#374151');
      doc.text(obj.why1 || '-', startX + 90, yPos + 3, { width: 140, height: 14 });
      doc.text(obj.why2 || '-', startX + 235, yPos + 3, { width: 140, height: 14 });
      doc.text(obj.why3 || '-', startX + 380, yPos + 3, { width: 140, height: 14 });
      doc.text(obj.why4 || '-', startX + 525, yPos + 3, { width: 140, height: 14 });
      doc.text(obj.why5 || '-', startX + 670, yPos + 3, { width: 135, height: 14 });

      doc.rect(startX, yPos + 18, fullWidth, 12).fillAndStroke('#fff7ed', '#1f2937');
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor('#9a3412')
        .text(`Root cause (${title}): `, startX + 6, yPos + 20.5, { continued: true })
        .font("Helvetica-Bold").fillColor('#111827').text(obj.rootCause || '-');
    };

    render5WhyBlock(fiveRootY + 26, "Occurrence", fiveOcc);
    render5WhyBlock(fiveRootY + 56, "Detection", fiveDet);
    render5WhyBlock(fiveRootY + 86, "System", fiveSys);

    // PFMEA Row
    doc.rect(startX, fiveRootY + 114, fullWidth, 12).stroke();
    doc.fillColor('#111827').font("Helvetica-Bold").fontSize(6.5)
      .text(`PREDICT: Included in PFMEA?  ${r.PfmeaIncluded || 'NO'}       |       RPN #: ${r.PfmeaRpn || 'N/A'}       |       Trial Run Date: ${r.TrialRunDate ? new Date(r.TrialRunDate).toLocaleDateString('en-GB') : '-'}`, startX + 6, fiveRootY + 117);

    // 2. (5) DEVELOPING SOLUTION & (5a) TRIAL RUN (Height: 46)
    const solY = 171;
    doc.rect(startX, solY, fullWidth, 46).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor('#111827').text("(5) Developing Solution & (5a) Trial Run:", startX + 6, solY + 3);

    const halfSolW = (fullWidth - 8) / 2;
    doc.rect(startX + 4, solY + 14, halfSolW, 28).stroke();
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor('#111827').text("Developing Solution:", startX + 8, solY + 17);
    doc.font("Helvetica").fontSize(6).fillColor('#374151').text(r.DevelopingSolution || "-", startX + 8, solY + 26, { width: halfSolW - 14 });

    doc.rect(startX + halfSolW + 4, solY + 14, halfSolW, 28).stroke();
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor('#111827').text(`Trial Run Details (Date: ${r.TrialRunDate ? new Date(r.TrialRunDate).toLocaleDateString('en-GB') : '-'}, Seq: ${r.TrialRunSequence || '-'}):`, startX + halfSolW + 8, solY + 17);
    doc.font("Helvetica").fontSize(6).fillColor('#374151').text(r.TrialRunDetails || "-", startX + halfSolW + 8, solY + 26, { width: halfSolW - 14 });

    // 3. (6) PERMANENT CORRECTIVE ACTIONS (Height: 96)
    const pcaY = 220;
    doc.rect(startX, pcaY, fullWidth, 96).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor('#111827').text("(6) Permanent Corrective Actions (PCA):", startX + 6, pcaY + 3);

    doc.rect(startX, pcaY + 13, fullWidth, 12).fillAndStroke('#f3f4f6', '#1f2937');
    doc.fillColor('black').font("Helvetica-Bold").fontSize(6.5);
    doc.text("Type", startX + 6, pcaY + 16, { width: 70 });
    doc.text("Action Plan Description", startX + 80, pcaY + 16, { width: 440 });
    doc.text("Who", startX + 530, pcaY + 16, { width: 100 });
    doc.text("Due Date", startX + 640, pcaY + 16, { width: 55, align: 'center' });
    doc.text("Break Point", startX + 700, pcaY + 16, { width: 55, align: 'center' });
    doc.text("Status", startX + 760, pcaY + 16, { width: 40, align: 'center' });

    const pcas = r.CorrectiveActions ? JSON.parse(r.CorrectiveActions) : [];
    let pRowY = pcaY + 25;
    pcas.slice(0, 5).forEach((p) => {
      doc.rect(startX, pRowY, fullWidth, 14).stroke();
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor('#111827').text(p.type || 'Action', startX + 6, pRowY + 4);
      doc.font("Helvetica").fontSize(6).text(p.action || '-', startX + 80, pRowY + 4, { width: 440, height: 10, ellipsis: true });
      doc.text(p.who || '-', startX + 530, pRowY + 4);
      doc.text(p.dueDate ? String(p.dueDate).split('T')[0] : '-', startX + 640, pRowY + 4, { width: 55, align: 'center' });
      doc.text(p.breakPoint ? String(p.breakPoint).split('T')[0] : '-', startX + 700, pRowY + 4, { width: 55, align: 'center' });
      doc.font("Helvetica-Bold").text(`L-${p.status || 1}`, startX + 760, pRowY + 4, { width: 40, align: 'center' });
      pRowY += 14;
    });

    // 4. (7) VERIFICATION QUESTIONS & (7a) LESSONS LEARNED (Height: 74)
    const verY = 319;
    doc.rect(startX, verY, fullWidth, 74).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor('#111827').text("(7) Verification & Resolution Questions:", startX + 6, verY + 3);

    // Questions checklist table (left)
    const vq = r.VerificationQuestions ? JSON.parse(r.VerificationQuestions) : {};
    const qList = [
      { key: "q1", text: "Has the Drawing been updated?" },
      { key: "q2", text: "Has the Work instruction, SOP/PFD been updated?" },
      { key: "q3", text: "Has the Product Quality Standard been updated?" },
      { key: "q4", text: "Have Prints, Check Sheets or other forms been updated?" },
      { key: "q5", text: "Have the PFMEA and Control Plans been updated?" },
      { key: "q6", text: "Results/changes communicated to affected Team Members?" },
    ];

    const qTableW = 420;
    doc.rect(startX + 4, verY + 13, qTableW, 10).fillAndStroke('#f3f4f6', '#9ca3af');
    doc.fillColor('black').font("Helvetica-Bold").fontSize(5.5);
    doc.text("Question", startX + 6, verY + 15, { width: 330 });
    doc.text("Y", startX + 345, verY + 15, { width: 20, align: 'center' });
    doc.text("N", startX + 370, verY + 15, { width: 20, align: 'center' });
    doc.text("N/A", startX + 395, verY + 15, { width: 25, align: 'center' });

    let qRowY = verY + 23;
    qList.forEach((q) => {
      doc.rect(startX + 4, qRowY, qTableW, 8).stroke();
      doc.font("Helvetica").fontSize(5.5).fillColor('#111827').text(q.text, startX + 6, qRowY + 2, { width: 330 });
      const val = vq[q.key] || '';

      // Clean vector tick function
      const drawTick = (cx, cy) => {
        doc.save();
        doc.lineWidth(1.1).strokeColor('#16a34a'); // Green checkmark
        doc.moveTo(cx - 2.8, cy + 0.2)
           .lineTo(cx - 0.8, cy + 2.2)
           .lineTo(cx + 3.0, cy - 2.2)
           .stroke();
        doc.restore();
      };

      const cellCenterY = qRowY + 4;
      if (val === 'Y') drawTick(startX + 345 + 10, cellCenterY);
      if (val === 'N') drawTick(startX + 370 + 10, cellCenterY);
      if (val === 'N/A') drawTick(startX + 395 + 12.5, cellCenterY);

      qRowY += 8;
    });

    // Right: Lessons Learned
    const rightVerX = startX + qTableW + 12;
    const rightVerW = fullWidth - qTableW - 16;
    doc.rect(rightVerX, verY + 13, rightVerW, 58).stroke();
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor('#111827').text("(7a) Lessons Learned:", rightVerX + 4, verY + 16);
    doc.font("Helvetica").fontSize(6).fillColor('#374151')
      .text(r.LessonsLearned || vq.lessonsLearned || "None documented", rightVerX + 4, verY + 26, { width: rightVerW - 8, height: 40, ellipsis: true });

    // 5. ISSUE RESOLVED SATISFACTORILY BAR (Height: 14)
    const resBarY = 395;
    doc.rect(startX, resBarY, fullWidth, 14).fillAndStroke('#f8fafc', '#1f2937');
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor('#111827')
      .text(`Issue Resolved satisfactorily?  ${r.IssueResolved || vq.issueResolved || '-'}     |     Date Closed: ${r.DateClosed ? new Date(r.DateClosed).toLocaleDateString('en-GB') : (vq.dateClosed || '-')}     |     Assigned to: ${r.AssignedTo || vq.assignedTo || '-'}     |     Tracking #: ${r.TrackingNo || vq.trackingNo || '-'}`, startX + 6, resBarY + 3.5);

    // 6. (7b) EFFECTIVENESS MONITORING & (7c) HORIZONTAL DEPLOYMENT (Height: 48)
    const sec7bcY = 412;
    const half7W = (fullWidth - 8) / 2;

    // (7b) Effectiveness
    doc.rect(startX, sec7bcY, half7W, 48).stroke();
    doc.font("Helvetica-Bold").fontSize(7).fillColor('#111827').text("(7b) Effectiveness Monitoring (up to 3 months):", startX + 6, sec7bcY + 3);

    let effList = [];
    try {
      effList = r.EffectivenessMonitoring ? JSON.parse(r.EffectivenessMonitoring) : (vq.effectiveness || []);
    } catch (e) {
      effList = [];
    }
    const m1 = effList[0] || {};
    const m2 = effList[1] || {};
    const m3 = effList[2] || {};

    const effTabY = sec7bcY + 13;
    doc.rect(startX + 4, effTabY, half7W - 8, 8).fillAndStroke('#f3f4f6', '#9ca3af');
    doc.font("Helvetica-Bold").fontSize(5.5).fillColor('black');
    doc.text("Metric", startX + 6, effTabY + 2, { width: 80 });
    doc.text(m1.month || "Month 1", startX + 90, effTabY + 2, { width: 90, align: 'center' });
    doc.text(m2.month || "Month 2", startX + 185, effTabY + 2, { width: 90, align: 'center' });
    doc.text(m3.month || "Month 3", startX + 280, effTabY + 2, { width: 90, align: 'center' });

    const drawEffRow = (ey, label, v1, v2, v3) => {
      doc.rect(startX + 4, ey, half7W - 8, 8).stroke();
      doc.font("Helvetica-Bold").fontSize(5.5).fillColor('#111827').text(label, startX + 6, ey + 2);
      doc.font("Helvetica").fontSize(5.5);
      doc.text(String(v1 || '-'), startX + 90, ey + 2, { width: 90, align: 'center' });
      doc.text(String(v2 || '-'), startX + 185, ey + 2, { width: 90, align: 'center' });
      doc.text(String(v3 || '-'), startX + 280, ey + 2, { width: 90, align: 'center' });
    };
    drawEffRow(effTabY + 8, "Rej Qty", m1.rejQty, m2.rejQty, m3.rejQty);
    drawEffRow(effTabY + 16, "Rej %", m1.rejPct, m2.rejPct, m3.rejPct);

    // (7c) Horizontal Deployment
    doc.rect(startX + half7W + 8, sec7bcY, half7W, 48).stroke();
    doc.font("Helvetica-Bold").fontSize(7).fillColor('#111827').text("(7c) Horizontal Deployment:", startX + half7W + 14, sec7bcY + 3);
    doc.font("Helvetica").fontSize(6).fillColor('#374151')
      .text(r.HorizontalDeployment || vq.horizontalDeployment || "None documented", startX + half7W + 14, sec7bcY + 14, { width: half7W - 20, height: 30, ellipsis: true });

    // 7. (8) CLOSURE SIGN-OFF SECTION (Height: 46)
    const csoY = 462;
    doc.rect(startX, csoY, fullWidth, 46).stroke();
    doc.font("Helvetica-Bold").fontSize(7).fillColor('#111827').text("(8) Closure Sign-off:", startX + 6, csoY + 3);
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor('#4b5563').text("APPROVALS", startX + fullWidth - 80, csoY + 3);

    const csoHeadY = csoY + 12;
    doc.rect(startX, csoHeadY, fullWidth, 9).fillAndStroke('#f3f4f6', '#1f2937');
    doc.font("Helvetica-Bold").fontSize(5.5).fillColor('black');
    doc.text("Shift", startX + 6, csoHeadY + 2, { width: 70 });
    doc.text("Team Members Involved", startX + 80, csoHeadY + 2, { width: 380 });
    doc.text("Team Leader / Group Leader", startX + 470, csoHeadY + 2, { width: 160, align: 'center' });
    doc.text("Production / Quality Head", startX + 640, csoHeadY + 2, { width: 160, align: 'center' });

    let csoList = vq.closureSignOff || [
      { shift: "1ST", teamMembers: "", teamLeader: "", prodQualityHead: "" },
      { shift: "2ND", teamMembers: "", teamLeader: "", prodQualityHead: "" },
      { shift: "3RD", teamMembers: "", teamLeader: "", prodQualityHead: "" },
    ];

    let csoRowY = csoHeadY + 9;
    csoList.slice(0, 3).forEach((cs) => {
      doc.rect(startX, csoRowY, fullWidth, 8).stroke();
      doc.font("Helvetica-Bold").fontSize(5.5).fillColor('#111827').text(cs.shift || '-', startX + 6, csoRowY + 2);
      doc.font("Helvetica").fontSize(5.5);
      doc.text(cs.teamMembers || '-', startX + 80, csoRowY + 2, { width: 380, ellipsis: true });
      doc.text(cs.teamLeader || '-', startX + 470, csoRowY + 2, { width: 160, align: 'center' });
      doc.text(cs.prodQualityHead || '-', startX + 640, csoRowY + 2, { width: 160, align: 'center' });
      csoRowY += 8;
    });

    // 8. SYSTEM DIGITAL VERIFICATION & APPROVAL (Height: 52)
    const sigY = 510;
    const sigW = fullWidth / 4;
    const opSig = r.Sign_ShiftIncharge || r.Sign_TeamLeader;
    const qcSig = r.Sign_QualityHead;
    const peSig = r.Sign_ProductionHead;
    const hofSig = r.Sign_HOFProduction;

    const renderSigBox = (colIdx, title, sigVal) => {
      const bx = startX + sigW * colIdx;
      doc.rect(bx, sigY, sigW, 52).stroke();
      doc.fillColor('#111827').font("Helvetica-Bold").fontSize(6.5).text(title, bx, sigY + 6, { width: sigW, align: 'center' });
      if (sigVal && !String(sigVal).includes('Pending')) {
        doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(7.5).text(`APPROVED (${String(sigVal).toUpperCase()})`, bx, sigY + 26, { width: sigW, align: 'center' });
      } else {
        doc.fillColor('#dc2626').font('Helvetica').fontSize(7).text("Pending", bx, sigY + 26, { width: sigW, align: 'center' });
      }
    };

    renderSigBox(0, "SHIFT SUPERVISOR (PRODUCTION)", opSig);
    renderSigBox(1, "SHIFT SUPERVISOR (QUALITY)", qcSig);
    renderSigBox(2, "PRODUCTION ENGINEER", peSig);
    renderSigBox(3, "HEAD OF PRODUCTION (HOF)", hofSig);

    // Page 2 Footer
    doc.font("Helvetica").fontSize(6.5).fillColor('#6b7280')
      .text(effectiveQf, startX, 568, { width: fullWidth, align: 'center' });

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
  getPartSets,
  getQcEightDReports,
  getPeEightDReports,
  getHofEightDReports,
  signQcEightDApproval,
  signPeEightDApproval,
  signHofEightDApproval
};