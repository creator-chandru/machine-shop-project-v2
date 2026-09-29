const sql = require('../db');

// ============================================================
// SAVE OPERATOR OBSERVATION SHEET
// ============================================================
const saveOperatorObservationSheet = async (req, res) => {
    const {
        header,
        sections,
        footer
    } = req.body;

    if (!header || !header.employeeName || !header.employeeCode) {
        return res.status(400).json({
            error: 'Employee Name and Employee Code are required.'
        });
    }

    let transaction;

    try {
        transaction = new sql.Transaction();
        await transaction.begin();

        const sectionList = sections || [];

        for (const sec of sectionList) {
            const items = sec.items || [];

            for (const item of items) {
                const request = new sql.Request(transaction);

                request
                    .input('machineShop', sql.Int, parseInt(header.machineShop || 3))
                    .input('employeeName', sql.NVarChar(150), header.employeeName)
                    .input('employeeCode', sql.NVarChar(50), header.employeeCode)
                    .input('department', sql.NVarChar(100), header.department || '')
                    .input('testDate', sql.Date, header.testDate)
                    .input('marksPercentage', sql.NVarChar(20), header.marksPercentage || '')
                    .input('totalMarksObtained', sql.Int, header.totalMarksObtained || 0)
                    .input('maxMarks', sql.Int, header.maxMarks || 125)
                    .input('method', sql.NVarChar(100), header.method || 'Practical & Demo')

                    // Item level values
                    .input('sectionId', sql.Int, sec.id)
                    .input('sectionName', sql.NVarChar(150), sec.title)
                    .input('slNo', sql.Int, item.slNo)
                    .input('parameterText', sql.NVarChar(500), item.parameter)
                    .input('rating', sql.NVarChar(50), item.rating || '')
                    .input('score', sql.Int, item.score !== undefined ? item.score : 0)

                    // Footer values
                    .input('operatorFeedback', sql.NVarChar(sql.MAX), footer?.operatorFeedback || '')
                    .input('reviewedBy', sql.NVarChar(100), footer?.reviewedBy || '')
                    .input('approvedBy', sql.NVarChar(100), footer?.approvedBy || '')
                    .input('reviewDate', sql.Date, footer?.reviewDate || header.testDate);

                await request.query(`
                    INSERT INTO OperatorObservationSheet
                    (
                        machineShop,
                        employeeName,
                        employeeCode,
                        department,
                        testDate,
                        marksPercentage,
                        totalMarksObtained,
                        maxMarks,
                        method,
                        sectionId,
                        sectionName,
                        slNo,
                        parameterText,
                        rating,
                        score,
                        operatorFeedback,
                        reviewedBy,
                        approvedBy,
                        reviewDate
                    )
                    VALUES
                    (
                        @machineShop,
                        @employeeName,
                        @employeeCode,
                        @department,
                        @testDate,
                        @marksPercentage,
                        @totalMarksObtained,
                        @maxMarks,
                        @method,
                        @sectionId,
                        @sectionName,
                        @slNo,
                        @parameterText,
                        @rating,
                        @score,
                        @operatorFeedback,
                        @reviewedBy,
                        @approvedBy,
                        @reviewDate
                    )
                `);
            }
        }

        await transaction.commit();

        return res.status(201).json({
            message: 'Operator Observation Sheet saved successfully'
        });

    } catch (err) {
        console.error('Error saving Operator Observation Sheet:', err);

        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackErr) {
                console.error('Rollback error:', rollbackErr);
            }
        }

        return res.status(500).json({
            error: 'Failed to save Operator Observation Sheet'
        });
    }
};

// ============================================================
// GET SAVED OPERATOR OBSERVATION SHEET DATA
// ============================================================
const getOperatorObservationSheet = async (req, res) => {
    const { machineShop, employeeCode, testDate } = req.query;

    try {
        let query = `
            SELECT
                id,
                machineShop,
                employeeName,
                employeeCode,
                department,
                testDate,
                marksPercentage,
                totalMarksObtained,
                maxMarks,
                method,
                sectionId,
                sectionName,
                slNo,
                parameterText,
                rating,
                score,
                operatorFeedback,
                reviewedBy,
                approvedBy,
                reviewDate,
                createdAt
            FROM OperatorObservationSheet
            WHERE 1 = 1
        `;

        const request = new sql.Request();

        if (machineShop) {
            query += ` AND machineShop = @machineShop`;
            request.input('machineShop', sql.Int, parseInt(machineShop));
        }

        if (employeeCode) {
            query += ` AND employeeCode = @employeeCode`;
            request.input('employeeCode', sql.NVarChar(50), employeeCode);
        }

        if (testDate) {
            query += ` AND testDate = @testDate`;
            request.input('testDate', sql.Date, testDate);
        }

        query += ` ORDER BY testDate DESC, sectionId ASC, slNo ASC`;

        const result = await request.query(query);

        return res.status(200).json(result.recordset);

    } catch (err) {
        console.error('Error fetching Operator Observation Sheet:', err);
        return res.status(500).json({
            error: 'Failed to fetch Operator Observation Sheet data'
        });
    }
};

module.exports = {
    saveOperatorObservationSheet,
    getOperatorObservationSheet
};