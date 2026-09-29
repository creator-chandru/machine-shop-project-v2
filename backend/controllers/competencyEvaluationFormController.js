const sql = require('../db');

// ============================================================
// SAVE COMPETENCY EVALUATION FORM
// ============================================================
const saveCompetencyEvaluationForm = async (req, res) => {
    const {
        header,
        questions,
        overallMark,
        signatures
    } = req.body;

    if (!header || !header.name || !header.employeeNo) {
        return res.status(400).json({
            error: 'Employee Name and Employee No are required.'
        });
    }

    const questionList = questions || [];
    if (questionList.length === 0) {
        return res.status(400).json({
            error: 'At least one evaluation question is required.'
        });
    }

    let transaction;

    try {
        transaction = new sql.Transaction();
        await transaction.begin();

        for (const q of questionList) {
            const request = new sql.Request(transaction);

            request
                .input('machineShop', sql.Int, parseInt(header.machineShop || 3))
                .input('name', sql.NVarChar(150), header.name)
                .input('employeeNo', sql.NVarChar(50), header.employeeNo)
                .input('qualification', sql.NVarChar(100), header.qualification || '')
                .input('evalDate', sql.Date, header.date)
                .input('doj', sql.Date, header.doj || null)
                .input('line', sql.NVarChar(100), header.line || '')
                .input('levelBadge', sql.NVarChar(50), header.levelBadge || 'LEVEL - 3')

                // Question row
                .input('qNo', sql.Int, q.qNo)
                .input('questionText', sql.NVarChar(500), q.questionText)
                .input('rating', sql.NVarChar(20), q.rating || '')
                .input('mark', sql.Int, q.mark !== null && q.mark !== undefined ? q.mark : null)

                // Overall Mark & Result
                .input('writtenExamMark', sql.Int, overallMark?.writtenExamMark ? parseInt(overallMark.writtenExamMark) : null)
                .input('writtenExamPercentage', sql.NVarChar(20), overallMark?.writtenExamPercentage || '')
                .input('practicalExamMark', sql.Int, overallMark?.practicalExamMark ? parseInt(overallMark.practicalExamMark) : null)
                .input('practicalExamPercentage', sql.NVarChar(20), overallMark?.practicalExamPercentage || '')
                .input('status', sql.NVarChar(20), overallMark?.status || '')

                // Signatures
                .input('inchargeSign', sql.NVarChar(100), signatures?.inchargeSign || '')
                .input('evaluatedBy', sql.NVarChar(100), signatures?.evaluatedBy || '')
                .input('hodSign', sql.NVarChar(100), signatures?.hodSign || '');

            await request.query(`
                INSERT INTO CompetencyEvaluationForm
                (
                    machineShop,
                    name,
                    employeeNo,
                    qualification,
                    evalDate,
                    doj,
                    line,
                    levelBadge,
                    qNo,
                    questionText,
                    rating,
                    mark,
                    writtenExamMark,
                    writtenExamPercentage,
                    practicalExamMark,
                    practicalExamPercentage,
                    status,
                    inchargeSign,
                    evaluatedBy,
                    hodSign
                )
                VALUES
                (
                    @machineShop,
                    @name,
                    @employeeNo,
                    @qualification,
                    @evalDate,
                    @doj,
                    @line,
                    @levelBadge,
                    @qNo,
                    @questionText,
                    @rating,
                    @mark,
                    @writtenExamMark,
                    @writtenExamPercentage,
                    @practicalExamMark,
                    @practicalExamPercentage,
                    @status,
                    @inchargeSign,
                    @evaluatedBy,
                    @hodSign
                )
            `);
        }

        await transaction.commit();

        return res.status(201).json({
            message: 'Competency Evaluation Form saved successfully'
        });

    } catch (err) {
        console.error('Error saving Competency Evaluation Form:', err);

        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackErr) {
                console.error('Rollback error:', rollbackErr);
            }
        }

        return res.status(500).json({
            error: 'Failed to save Competency Evaluation Form'
        });
    }
};

// ============================================================
// GET ALL COMPETENCY EVALUATION FORMS
// ============================================================
const getCompetencyEvaluationForms = async (req, res) => {
    const { machineShop, employeeNo, date } = req.query;

    try {
        let query = `
            SELECT DISTINCT
                name,
                employeeNo,
                qualification,
                evalDate,
                doj,
                line,
                levelBadge,
                writtenExamMark,
                practicalExamMark,
                status,
                createdAt
            FROM CompetencyEvaluationForm
            WHERE 1 = 1
        `;

        const request = new sql.Request();

        if (machineShop) {
            query += ` AND machineShop = @machineShop`;
            request.input('machineShop', sql.Int, parseInt(machineShop));
        }

        if (employeeNo) {
            query += ` AND employeeNo = @employeeNo`;
            request.input('employeeNo', sql.NVarChar(50), employeeNo);
        }

        if (date) {
            query += ` AND evalDate = @date`;
            request.input('date', sql.Date, date);
        }

        query += ` ORDER BY evalDate DESC`;

        const result = await request.query(query);

        return res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching Competency Evaluation Forms:', err);
        return res.status(500).json({
            error: 'Failed to fetch Competency Evaluation Forms'
        });
    }
};

// ============================================================
// GET SPECIFIC FORM BY EMPLOYEE NO & DATE
// ============================================================
const getCompetencyEvaluationFormByEmp = async (req, res) => {
    const { employeeNo } = req.params;
    const { date } = req.query;

    try {
        let query = `
            SELECT *
            FROM CompetencyEvaluationForm
            WHERE employeeNo = @employeeNo
        `;

        const request = new sql.Request();
        request.input('employeeNo', sql.NVarChar(50), employeeNo);

        if (date) {
            query += ` AND evalDate = @date`;
            request.input('date', sql.Date, date);
        }

        query += ` ORDER BY qNo ASC`;

        const result = await request.query(query);

        return res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching evaluation form for employee:', err);
        return res.status(500).json({
            error: 'Failed to fetch evaluation form'
        });
    }
};

module.exports = {
    saveCompetencyEvaluationForm,
    getCompetencyEvaluationForms,
    getCompetencyEvaluationFormByEmp
};