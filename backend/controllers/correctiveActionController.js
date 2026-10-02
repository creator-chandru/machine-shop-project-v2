const sql = require('../db');


// ============================================================
// GET ALL CORRECTIVE ACTION RECORDS
// ============================================================

const getCorrectiveActionRecords = async (req, res) => {
    try {

        const { shopId } = req.params;
        const { lineCode, fromDate, toDate } = req.query;

        const request = new sql.Request();

        request.input('machineShop', sql.Int, shopId);

        let query = `
            SELECT
                id,
                machineShop,
                lineCode,
                recordDate,
                partName,
                problemDescription,
                problemCategory,
                quantity,
                rootCause,
                correctiveAction,
                result,
                operatorSignature,
                shiftInchargeSignature,
                createdAt,
                updatedAt
            FROM CorrectiveActionRegister
            WHERE machineShop = @machineShop
        `;

        if (lineCode) {
            request.input(
                'lineCode',
                sql.NVarChar(100),
                lineCode
            );

            query += `
                AND lineCode = @lineCode
            `;
        }

        if (fromDate) {
            request.input(
                'fromDate',
                sql.Date,
                fromDate
            );

            query += `
                AND recordDate >= @fromDate
            `;
        }

        if (toDate) {
            request.input(
                'toDate',
                sql.Date,
                toDate
            );

            query += `
                AND recordDate <= @toDate
            `;
        }

        query += `
            ORDER BY recordDate DESC, id DESC
        `;

        const result = await request.query(query);

        res.status(200).json(result.recordset);

    } catch (err) {

        console.error(
            'Error fetching corrective action records:',
            err
        );

        res.status(500).json({
            error: 'Failed to fetch corrective action records'
        });
    }
};


// ============================================================
// GET ONE CORRECTIVE ACTION RECORD
// ============================================================

const getCorrectiveActionRecordById = async (req, res) => {

    try {

        const { id } = req.params;

        const result = await sql
            .request()
            .input(
                'id',
                sql.Int,
                id
            )
            .query(`
                SELECT
                    id,
                    machineShop,
                    lineCode,
                    recordDate,
                    partName,
                    problemDescription,
                    problemCategory,
                    quantity,
                    rootCause,
                    correctiveAction,
                    result,
                    operatorSignature,
                    shiftInchargeSignature,
                    createdAt,
                    updatedAt
                FROM CorrectiveActionRegister
                WHERE id = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Corrective action record not found'
            });
        }

        res.status(200).json(result.recordset[0]);

    } catch (err) {

        console.error(
            'Error fetching corrective action record:',
            err
        );

        res.status(500).json({
            error: 'Failed to fetch corrective action record'
        });
    }
};


// ============================================================
// SAVE CORRECTIVE ACTION RECORD
// ============================================================

const saveCorrectiveActionRecord = async (req, res) => {

    let transaction;

    try {

        const {
            machineShop,
            lineCode,
            recordDate,
            partName,
            problemDescription,
            problemCategory,
            quantity,
            rootCause,
            correctiveAction,
            result,
            operatorSignature,
            shiftInchargeSignature
        } = req.body;


        // ========================================================
        // VALIDATION
        // ========================================================

        if (!machineShop) {
            return res.status(400).json({
                error: 'Machine shop is required'
            });
        }

        if (!lineCode) {
            return res.status(400).json({
                error: 'Line code is required'
            });
        }

        if (!recordDate) {
            return res.status(400).json({
                error: 'Date is required'
            });
        }

        if (!problemDescription) {
            return res.status(400).json({
                error: 'Problem description is required'
            });
        }

        if (!problemCategory) {
            return res.status(400).json({
                error: 'Problem category is required'
            });
        }

        if (!['A', 'B', 'C', 'D', 'E'].includes(problemCategory)) {
            return res.status(400).json({
                error: 'Invalid problem category'
            });
        }

        if (!quantity || Number(quantity) <= 0) {
            return res.status(400).json({
                error: 'Quantity must be greater than zero'
            });
        }


        // ========================================================
        // START TRANSACTION
        // ========================================================

        transaction = new sql.Transaction();

        await transaction.begin();


        // ========================================================
        // INSERT RECORD
        // ========================================================

        await transaction
            .request()

            .input(
                'machineShop',
                sql.Int,
                machineShop
            )

            .input(
                'lineCode',
                sql.NVarChar(100),
                lineCode
            )

            .input(
                'recordDate',
                sql.Date,
                recordDate
            )

            .input(
                'partName',
                sql.NVarChar(200),
                partName || ''
            )

            .input(
                'problemDescription',
                sql.NVarChar(sql.MAX),
                problemDescription
            )

            .input(
                'problemCategory',
                sql.NVarChar(10),
                problemCategory
            )

            .input(
                'quantity',
                sql.Int,
                Number(quantity)
            )

            .input(
                'rootCause',
                sql.NVarChar(sql.MAX),
                rootCause || ''
            )

            .input(
                'correctiveAction',
                sql.NVarChar(sql.MAX),
                correctiveAction || ''
            )

            .input(
                'result',
                sql.NVarChar(50),
                result || ''
            )

            .input(
                'operatorSignature',
                sql.NVarChar(100),
                operatorSignature || ''
            )

            .input(
                'shiftInchargeSignature',
                sql.NVarChar(100),
                shiftInchargeSignature || ''
            )

            .query(`
                INSERT INTO CorrectiveActionRegister
                (
                    machineShop,
                    lineCode,
                    recordDate,
                    partName,
                    problemDescription,
                    problemCategory,
                    quantity,
                    rootCause,
                    correctiveAction,
                    result,
                    operatorSignature,
                    shiftInchargeSignature
                )
                VALUES
                (
                    @machineShop,
                    @lineCode,
                    @recordDate,
                    @partName,
                    @problemDescription,
                    @problemCategory,
                    @quantity,
                    @rootCause,
                    @correctiveAction,
                    @result,
                    @operatorSignature,
                    @shiftInchargeSignature
                )
            `);


        // ========================================================
        // COMMIT
        // ========================================================

        await transaction.commit();

        res.status(201).json({
            message: 'Corrective action record saved successfully'
        });

    } catch (err) {

        console.error(
            'Error saving corrective action record:',
            err
        );

        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(
                    'Rollback error:',
                    rollbackError
                );
            }
        }

        res.status(500).json({
            error: 'Failed to save corrective action record'
        });
    }
};


// ============================================================
// UPDATE CORRECTIVE ACTION RECORD
// ============================================================

const updateCorrectiveActionRecord = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            recordDate,
            partName,
            problemDescription,
            problemCategory,
            quantity,
            rootCause,
            correctiveAction,
            result,
            operatorSignature,
            shiftInchargeSignature
        } = req.body;


        if (!recordDate ||
            !problemDescription ||
            !problemCategory ||
            !quantity) {

            return res.status(400).json({
                error: 'Required fields are missing'
            });
        }


        await sql
            .request()

            .input(
                'id',
                sql.Int,
                id
            )

            .input(
                'recordDate',
                sql.Date,
                recordDate
            )

            .input(
                'partName',
                sql.NVarChar(200),
                partName || ''
            )

            .input(
                'problemDescription',
                sql.NVarChar(sql.MAX),
                problemDescription
            )

            .input(
                'problemCategory',
                sql.NVarChar(10),
                problemCategory
            )

            .input(
                'quantity',
                sql.Int,
                Number(quantity)
            )

            .input(
                'rootCause',
                sql.NVarChar(sql.MAX),
                rootCause || ''
            )

            .input(
                'correctiveAction',
                sql.NVarChar(sql.MAX),
                correctiveAction || ''
            )

            .input(
                'result',
                sql.NVarChar(50),
                result || ''
            )

            .input(
                'operatorSignature',
                sql.NVarChar(100),
                operatorSignature || ''
            )

            .input(
                'shiftInchargeSignature',
                sql.NVarChar(100),
                shiftInchargeSignature || ''
            )

            .query(`
                UPDATE CorrectiveActionRegister

                SET
                    recordDate = @recordDate,
                    partName = @partName,
                    problemDescription = @problemDescription,
                    problemCategory = @problemCategory,
                    quantity = @quantity,
                    rootCause = @rootCause,
                    correctiveAction = @correctiveAction,
                    result = @result,
                    operatorSignature = @operatorSignature,
                    shiftInchargeSignature = @shiftInchargeSignature,
                    updatedAt = GETDATE()

                WHERE id = @id
            `);


        res.status(200).json({
            message: 'Corrective action record updated successfully'
        });

    } catch (err) {

        console.error(
            'Error updating corrective action:',
            err
        );

        res.status(500).json({
            error: 'Failed to update corrective action record'
        });
    }
};


// ============================================================
// DELETE CORRECTIVE ACTION RECORD
// ============================================================

const deleteCorrectiveActionRecord = async (req, res) => {

    try {

        const { id } = req.params;

        const result = await sql
            .request()
            .input(
                'id',
                sql.Int,
                id
            )
            .query(`
                DELETE FROM CorrectiveActionRegister
                WHERE id = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                error: 'Record not found'
            });
        }

        res.status(200).json({
            message: 'Corrective action record deleted successfully'
        });

    } catch (err) {

        console.error(
            'Error deleting corrective action:',
            err
        );

        res.status(500).json({
            error: 'Failed to delete corrective action record'
        });
    }
};


module.exports = {
    getCorrectiveActionRecords,
    getCorrectiveActionRecordById,
    saveCorrectiveActionRecord,
    updateCorrectiveActionRecord,
    deleteCorrectiveActionRecord
};