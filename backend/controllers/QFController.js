const sql = require("../db");

// Configuration: Map each form name to its dedicated SQL table
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
  "operator-observation-sheet": "OperatorObservationQFvalues" // <-- ADDED
};

// GET /api/qf-values: Returns the latest QF setting for each configured form
exports.getFormSettings = async (req, res) => {
  try {
    const results = [];

    for (const [formName, tableName] of Object.entries(FORM_QF_TABLES)) {
      const query = `
        SELECT TOP 1 id, '${formName}' as formName, qfValue, date 
        FROM ${tableName} 
        ORDER BY date DESC, id DESC
      `;
      const result = await sql.query(query);

      if (result.recordset.length > 0) {
        results.push(result.recordset[0]);
      } else {
        results.push({
          id: null,
          formName,
          qfValue: "Not Set",
          date: null
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
exports.updateFormSettings = async (req, res) => {
  const { setting } = req.body;

  if (!setting || !setting.formName) {
    return res.status(400).json({ error: "No setting data provided" });
  }

  const tableName = FORM_QF_TABLES[setting.formName];
  if (!tableName) {
    return res.status(400).json({ error: `Unknown form name: ${setting.formName}` });
  }

  const safeDate = setting.date && setting.date.trim() !== "" ? setting.date : null;

  try {
    const request = new sql.Request();
    request.input("formName", sql.NVarChar, setting.formName);
    request.input("qfValue", sql.NVarChar, setting.qfValue);
    request.input("safeDate", sql.Date, safeDate);

    await request.query(`
      INSERT INTO ${tableName} (formName, qfValue, date)
      VALUES (@formName, @qfValue, @safeDate)
    `);

    res.json({ message: `New QF value record for ${setting.formName} created successfully` });
  } catch (err) {
    console.error("updateFormSettings error:", err);
    res.status(500).json({ error: "Failed to save new form setting", details: err.message });
  }
};

// GET /api/qf-values/history/:formName: Returns history for the form to calculate QF by effective date
exports.getFormQfHistory = async (req, res) => {
  const { formName } = req.params;
  const tableName = FORM_QF_TABLES[formName];

  if (!tableName) {
    return res.status(400).json({ error: `Unknown form name: ${formName}` });
  }

  try {
    const query = `
      SELECT id, formName, qfValue, date 
      FROM ${tableName} 
      ORDER BY date DESC, id DESC
    `;
    const result = await sql.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error("getFormQfHistory error:", err);
    res.status(500).json({ error: "Failed to fetch QF history", details: err.message });
  }
};