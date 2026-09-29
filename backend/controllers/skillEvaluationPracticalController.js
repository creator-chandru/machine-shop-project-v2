const sql = require('../db');

// ============================================================
// SAVE SKILL EVALUATION PRACTICAL
// ============================================================
// Behavior:
// - Stores each daily row directly into the single table SkillEvaluationPractical.
// - All header info, summary totals, and evaluation criteria are recorded per row.
// ============================================================

const saveSkillEvaluationPractical = async (req, res) => {
    const {
        header,
        rows,
        evaluationCriteria
    } = req.body;

    const rowList = rows || [];

    if (!header || !header.name || !header.empNo) {
        return res.status(400).json({
            error: 'Header details (Name, Emp No, and Part Name) are required.'
        });
    }

    if (rowList.length === 0) {
        return res.status(400).json({
            error: 'At least one evaluation entry row is required.'
        });
    }

    let transaction;

    try {
        transaction = new sql.Transaction();
        await transaction.begin();

        // Extract criteria per level
        const criteriaMap = {};
        (evaluationCriteria || []).forEach(c => {
            if (c.level) {
                const key = c.level.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(); // e.g. "level2", "level3", "level4"
                criteriaMap[key] = c;
            }
        });

        const l2 = criteriaMap['level2'] || {};
        const l3 = criteriaMap['level3'] || {};
        const l4 = criteriaMap['level4'] || {};

        for (const row of rowList) {
            // Skip empty rows
            if (!row.rowDate && !row.proTarget && !row.proAchieved && !row.evaluatorSignature) {
                continue;
            }

            const request = new sql.Request(transaction);

            request
                .input('machineShop', sql.Int, parseInt(header.machineShop || 3))
                .input('name', sql.NVarChar(150), header.name)
                .input('empNo', sql.NVarChar(50), header.empNo)
                .input('skillLevel', sql.NVarChar(50), header.skillLevel || '')
                .input('topLevel', sql.NVarChar(50), header.topLevel || '')
                .input('partName', sql.NVarChar(200), header.partName || '')
                .input('operationNo', sql.NVarChar(255), header.operationNo || '')
                .input('evaluationFromDate', sql.Date, header.evaluationFromDate)
                .input('evaluationToDate', sql.Date, header.evaluationToDate)
                .input('machineNo', sql.NVarChar(100), header.machineNo || '')

                // Row columns
                .input('rowDate', sql.Date, row.rowDate || header.evaluationFromDate)
                .input('proTarget', sql.Int, row.proTarget ? parseInt(row.proTarget) : null)
                .input('proAchieved', sql.Int, row.proAchieved ? parseInt(row.proAchieved) : null)
                .input('targetAchievedPercent', sql.NVarChar(20), row.targetAchievedPercent || '')
                .input('qtyOk', sql.Int, row.qtyOk ? parseInt(row.qtyOk) : null)
                .input('qtyRejected', sql.NVarChar(50), row.qtyRejected || '')
                .input('rejectionPercent', sql.NVarChar(20), row.rejectionPercent || '')
                .input('evaluatorSignature', sql.NVarChar(100), row.evaluatorSignature || '')
                .input('efficiency', sql.NVarChar(50), row.efficiency || '')
                .input('remarks', sql.NVarChar(255), row.remarks || '')

                // Summary totals
                .input('totalProTarget', sql.Int, header.totalProTarget ? parseInt(header.totalProTarget) : null)
                .input('totalProAchieved', sql.Int, header.totalProAchieved ? parseInt(header.totalProAchieved) : null)
                .input('totalTargetPercent', sql.NVarChar(20), header.totalTargetPercent || '')
                .input('totalQtyOk', sql.Int, header.totalQtyOk ? parseInt(header.totalQtyOk) : null)
                .input('totalQtyRejected', sql.Int, header.totalQtyRejected ? parseInt(header.totalQtyRejected) : null)
                .input('totalRejectionPercent', sql.NVarChar(20), header.totalRejectionPercent || '')

                // Criteria Level 2
                .input('level2ProAchievedPercent', sql.NVarChar(50), l2.proAchievedPercent || '')
                .input('level2QualityAchievedPercent', sql.NVarChar(50), l2.qualityLevelAchievedPercent || '')
                .input('level2Remarks', sql.NVarChar(255), l2.remarks || '')

                // Criteria Level 3
                .input('level3ProAchievedPercent', sql.NVarChar(50), l3.proAchievedPercent || '')
                .input('level3QualityAchievedPercent', sql.NVarChar(50), l3.qualityLevelAchievedPercent || '')
                .input('level3Remarks', sql.NVarChar(255), l3.remarks || '')

                // Criteria Level 4
                .input('level4ProAchievedPercent', sql.NVarChar(50), l4.proAchievedPercent || '')
                .input('level4QualityAchievedPercent', sql.NVarChar(50), l4.qualityLevelAchievedPercent || '')
                .input('level4Remarks', sql.NVarChar(255), l4.remarks || '');

            await request.query(`
                INSERT INTO SkillEvaluationPractical
                (
                    machineShop,
                    name,
                    empNo,
                    skillLevel,
                    topLevel,
                    partName,
                    operationNo,
                    evaluationFromDate,
                    evaluationToDate,
                    machineNo,
                    rowDate,
                    proTarget,
                    proAchieved,
                    targetAchievedPercent,
                    qtyOk,
                    qtyRejected,
                    rejectionPercent,
                    evaluatorSignature,
                    efficiency,
                    remarks,
                    totalProTarget,
                    totalProAchieved,
                    totalTargetPercent,
                    totalQtyOk,
                    totalQtyRejected,
                    totalRejectionPercent,
                    level2ProAchievedPercent,
                    level2QualityAchievedPercent,
                    level2Remarks,
                    level3ProAchievedPercent,
                    level3QualityAchievedPercent,
                    level3Remarks,
                    level4ProAchievedPercent,
                    level4QualityAchievedPercent,
                    level4Remarks
                )
                VALUES
                (
                    @machineShop,
                    @name,
                    @empNo,
                    @skillLevel,
                    @topLevel,
                    @partName,
                    @operationNo,
                    @evaluationFromDate,
                    @evaluationToDate,
                    @machineNo,
                    @rowDate,
                    @proTarget,
                    @proAchieved,
                    @targetAchievedPercent,
                    @qtyOk,
                    @qtyRejected,
                    @rejectionPercent,
                    @evaluatorSignature,
                    @efficiency,
                    @remarks,
                    @totalProTarget,
                    @totalProAchieved,
                    @totalTargetPercent,
                    @totalQtyOk,
                    @totalQtyRejected,
                    @totalRejectionPercent,
                    @level2ProAchievedPercent,
                    @level2QualityAchievedPercent,
                    @level2Remarks,
                    @level3ProAchievedPercent,
                    @level3QualityAchievedPercent,
                    @level3Remarks,
                    @level4ProAchievedPercent,
                    @level4QualityAchievedPercent,
                    @level4Remarks
                )
            `);
        }

        await transaction.commit();

        return res.status(201).json({
            message: 'Skill Evaluation Practical sheet saved successfully'
        });

    } catch (err) {
        console.error('Error saving Skill Evaluation Practical sheet:', err);

        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackErr) {
                console.error('Rollback error:', rollbackErr);
            }
        }

        return res.status(500).json({
            error: 'Failed to save Skill Evaluation Practical sheet'
        });
    }
};

// ============================================================
// GET SAVED SKILL EVALUATION PRACTICAL DATA
// ============================================================
const getSkillEvaluationPractical = async (req, res) => {
    const { machineShop, empNo, partName, date } = req.query;

    try {
        let query = `
            SELECT
                id,
                machineShop,
                name,
                empNo,
                skillLevel,
                topLevel,
                partName,
                operationNo,
                evaluationFromDate,
                evaluationToDate,
                machineNo,
                rowDate,
                proTarget,
                proAchieved,
                targetAchievedPercent,
                qtyOk,
                qtyRejected,
                rejectionPercent,
                evaluatorSignature,
                efficiency,
                remarks,
                totalProTarget,
                totalProAchieved,
                totalTargetPercent,
                totalQtyOk,
                totalQtyRejected,
                totalRejectionPercent,
                level2ProAchievedPercent,
                level2QualityAchievedPercent,
                level2Remarks,
                level3ProAchievedPercent,
                level3QualityAchievedPercent,
                level3Remarks,
                level4ProAchievedPercent,
                level4QualityAchievedPercent,
                level4Remarks,
                createdAt
            FROM SkillEvaluationPractical
            WHERE 1 = 1
        `;

        const request = new sql.Request();

        if (machineShop) {
            query += ` AND machineShop = @machineShop`;
            request.input('machineShop', sql.Int, parseInt(machineShop));
        }

        if (empNo) {
            query += ` AND empNo = @empNo`;
            request.input('empNo', sql.NVarChar(50), empNo);
        }

        if (partName) {
            query += ` AND partName = @partName`;
            request.input('partName', sql.NVarChar(200), partName);
        }

        if (date) {
            query += ` AND @date BETWEEN evaluationFromDate AND evaluationToDate`;
            request.input('date', sql.Date, date);
        }

        query += ` ORDER BY evaluationFromDate DESC, rowDate ASC, id ASC`;

        const result = await request.query(query);

        return res.status(200).json(result.recordset);

    } catch (err) {
        console.error('Error fetching Skill Evaluation Practical data:', err);
        return res.status(500).json({
            error: 'Failed to fetch Skill Evaluation Practical data'
        });
    }
};

module.exports = {
    saveSkillEvaluationPractical,
    getSkillEvaluationPractical
};