const sql = require("../db");

// Map each form name to its dedicated SQL table
const FORM_QF_TABLES = {
  "pre-operation-checklist": "PreOperationQFvalues",
  "error-proofing-checksheet": "ErrorProofingQFvalues",
  "air-gap-sensor": "AirGapSensorQFvalues",
  "level1-maintenance-checklist": "Level1MaintenanceQFvalues",
  "four-m-change-monitoring": "FourMChangeMonitoringQFvalues",
  "significant-event-record": "SignificantEventQFvalues",
  "daily-production-report": "DailyProductionReportQFvalues",
  "daily-production-idle-time": "DailyProductionIdleTimeQFvalues",
  "breakdown-intimation-report": "BreakdownIntimationQFvalues",
  "operator-observation-sheet": "OperatorObservationQFvalues",
  "competency-evaluation-form": "CompetencyEvaluationQFvalues",
  "corrective-action-register": "CorrectiveActionQFvalues",
  "eight-d-report": "EightDReportQFvalues",
  "job-setup-verification": "JobSetupVerificationQFvalues",
  "operator-allotment": "OperatorAllotmentQFvalues",
  "operator-observation-plan": "OperatorObservationQFvalues",
  "tool-change-record" : "ToolChangeRecordQFvalues",
  "lpa-bottom": "LPAQFvalues" // Unified Table Name
};

// Forms that extract date from qfValue and store a reason + history
const REASON_ENABLED_FORMS = [
  "pre-operation-checklist",
  "error-proofing-checksheet",
  "air-gap-sensor",
  "level1-maintenance-checklist",
  "four-m-change-monitoring",
  "significant-event-record",
  "daily-production-report",
  "daily-production-idle-time",
  "breakdown-intimation-report",
  "operator-observation-sheet",
  "competency-evaluation-form",
  "corrective-action-register"
];

// Helper to extract date (e.g. "31.01.2025") from qfValue and convert to "YYYY-MM-DD"
const extractDateFromQfValue = (qfValue) => {
  if (!qfValue) return null;
  // Matches DD.MM.YYYY, DD-MM-YYYY, or DD/MM/YYYY
  const match = qfValue.match(/(\d{2})[.\-/](\d{2})[.\-/](\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  return null;
};

// GET /api/qf-values: Returns the latest QF setting for each configured form
const getFormSettings = async (req, res) => {
  try {
    const results = [];

    for (const [formName, tableName] of Object.entries(FORM_QF_TABLES)) {
      try {
        const isReasonEnabled = REASON_ENABLED_FORMS.includes(formName);
        const query = isReasonEnabled
          ? `SELECT TOP 1 id, '${formName}' as formName, qfValue, date, reason FROM ${tableName} ORDER BY date DESC, id DESC`
          : `SELECT TOP 1 id, '${formName}' as formName, qfValue, date FROM ${tableName} ORDER BY date DESC, id DESC`;

        const result = await sql.query(query);

        if (result.recordset.length > 0) {
          results.push({
            ...result.recordset[0],
            reason: "" // Keep input field blank in UI for entering a new reason on next update
          });
        } else {
          results.push({
            id: null,
            formName,
            qfValue: "Not Set",
            date: null,
            reason: ""
          });
        }
      } catch (tableErr) {
        results.push({
          id: null,
          formName,
          qfValue: "Not Set",
          date: null,
          reason: ""
        });
      }
    }

    res.json(results);
  } catch (err) {
    console.error("getFormSettings error:", err);
    res.status(500).json({ error: "Failed to fetch form settings", details: err.message });
  }
};

// PUT /api/qf-values: Inserts new QF version record into the respective table
const updateFormSettings = async (req, res) => {
  const { setting } = req.body;

  if (!setting || !setting.formName) {
    return res.status(400).json({ error: "No setting data provided" });
  }

  const tableName = FORM_QF_TABLES[setting.formName];
  if (!tableName) {
    return res.status(400).json({ error: `Unknown form name: ${setting.formName}` });
  }

  const isReasonEnabled = REASON_ENABLED_FORMS.includes(setting.formName);

  // If reason-enabled form, extract the date directly from qfValue
  let safeDate = null;
  if (isReasonEnabled) {
    safeDate = extractDateFromQfValue(setting.qfValue);
    if (!safeDate) {
      return res.status(400).json({
        error: "Could not extract a valid date (DD.MM.YYYY) from the QF Value."
      });
    }
  } else {
    safeDate = setting.date && setting.date.trim() !== "" ? setting.date : null;
  }

  try {
    const request = new sql.Request();
    request.input("formName", sql.NVarChar, setting.formName);
    request.input("qfValue", sql.NVarChar, setting.qfValue);
    request.input("safeDate", sql.Date, safeDate);

    if (isReasonEnabled) {
      request.input("reason", sql.NVarChar, setting.reason || "");
      await request.query(`
        INSERT INTO ${tableName} (formName, qfValue, date, reason)
        VALUES (@formName, @qfValue, @safeDate, @reason)
      `);
    } else {
      await request.query(`
        INSERT INTO ${tableName} (formName, qfValue, date)
        VALUES (@formName, @qfValue, @safeDate)
      `);
    }

    res.json({ message: `New QF value record for ${setting.formName} created successfully` });
  } catch (err) {
    console.error("updateFormSettings error:", err);
    res.status(500).json({ error: "Failed to save new form setting", details: err.message });
  }
};

// GET /api/qf-values/history/:formName
const getFormQfHistory = async (req, res) => {
  const { formName } = req.params;
  const tableName = FORM_QF_TABLES[formName];

  if (!tableName) {
    return res.status(400).json({ error: `Unknown form name: ${formName}` });
  }

  const isReasonEnabled = REASON_ENABLED_FORMS.includes(formName);

  try {
    const query = isReasonEnabled
      ? `SELECT id, formName, qfValue, date, reason FROM ${tableName} ORDER BY date DESC, id DESC`
      : `SELECT id, formName, qfValue, date FROM ${tableName} ORDER BY date DESC, id DESC`;

    const result = await sql.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error("getFormQfHistory error:", err);
    res.status(500).json({ error: "Failed to fetch QF history", details: err.message });
  }
};

module.exports = {
  getFormSettings,
  updateFormSettings,
  getFormQfHistory
};