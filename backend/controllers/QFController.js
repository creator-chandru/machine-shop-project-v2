const sql = require("../db");

exports.getFormSettings = async (req, res) => {
    try {
        const result = await sql.query`
            SELECT id, formName, qfValue, date FROM (
                SELECT id, formName, qfValue, date, ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM PreOperationQFvalues
            ) t1 WHERE rn = 1
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error("getFormSettings error:", err);
        res.status(500).json({ error: "Failed to fetch form settings", details: err.message });
    }
};

exports.updateFormSettings = async (req, res) => {
    const { setting } = req.body; 

    if (!setting) return res.status(400).json({ error: "No setting data provided" });

    const safeDate = (setting.date && setting.date.trim() !== '') ? setting.date : null;

    try {
        if (setting.formName === 'pre-operation-checklist') {
            await sql.query`
                INSERT INTO PreOperationQFvalues (formName, qfValue, date)
                VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})
            `;
        } else {
            return res.status(400).json({ error: "Unknown form name" });
        }
        
        res.json({ message: "New QF value record created successfully" });
    } catch (err) {
        console.error("updateFormSettings error:", err);
        res.status(500).json({ error: "Failed to save new form setting", details: err.message });
    }
};