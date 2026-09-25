const sql = require('../db');

// ============================================================
// SAVE AIR GAP SENSOR CHECK SHEET
// ============================================================
// Behavior:
// - Only saves shifts that contain actual data.
// - Does NOT create empty rows for unfilled shifts.
// - Existing saved shifts are not inserted again.
// - Data is stored directly in AirGapSensorCheckSheet.
// ============================================================

const saveAirGapSensor = async (req, res) => {
    const {
        header,
        blocks,
        shiftProdSignatures
    } = req.body;

    const blockList = blocks || [];

    if (!header) {
        return res.status(400).json({
            error: 'Header data is required'
        });
    }

    let transaction;

    try {
        transaction = new sql.Transaction();
        await transaction.begin();

        const shifts = ['I', 'II', 'III'];

        for (const block of blockList) {

            const checkDate = header.date;
            const dateChecks = block.dailyChecks?.[checkDate] || {};
            const lineSignatures =
                block.lineInchargeSignatures?.[checkDate] || {};

            const parameters = block.parameters || [];

            for (const shift of shifts) {

                // ------------------------------------------------
                // Check whether this shift actually contains data
                // ------------------------------------------------

                const shiftHasStatus = parameters.some((_, paramIdx) => {
                    const status =
                        dateChecks[paramIdx]?.[shift] || '';

                    return status !== '';
                });

                const lineInchargeSignature =
                    lineSignatures[shift] || '';

                const productionSignature =
                    shiftProdSignatures?.[checkDate]?.[shift] || '';

                const shiftHasData =
                    shiftHasStatus ||
                    lineInchargeSignature !== '' ||
                    productionSignature !== '';

                // Nothing entered for this shift.
                // Do not insert anything.
                if (!shiftHasData) {
                    continue;
                }

                // ------------------------------------------------
                // Check whether this shift is already saved
                // ------------------------------------------------

                const existingRequest = new sql.Request(transaction);

                existingRequest
                    .input(
                        'machineShop',
                        sql.Int,
                        parseInt(header.machineShop)
                    )
                    .input(
                        'lineCode',
                        sql.NVarChar(50),
                        header.lineCode
                    )
                    .input(
                        'partNo',
                        sql.NVarChar(100),
                        header.partNo
                    )
                    .input(
                        'checkDate',
                        sql.Date,
                        checkDate
                    )
                    .input(
                        'machineNo',
                        sql.NVarChar(50),
                        block.machineNo || ''
                    )
                    .input(
                        'shift',
                        sql.NVarChar(10),
                        shift
                    );

                const existingResult =
                    await existingRequest.query(`
                        SELECT COUNT(*) AS count
                        FROM AirGapSensorCheckSheet
                        WHERE machineShop = @machineShop
                          AND lineCode = @lineCode
                          AND partNo = @partNo
                          AND checkDate = @checkDate
                          AND machineNo = @machineNo
                          AND shift = @shift
                    `);

                const alreadySaved =
                    existingResult.recordset[0].count > 0;

                // Existing shift must not be inserted again.
                if (alreadySaved) {
                    continue;
                }

                // ------------------------------------------------
                // Insert one row for every parameter
                // ------------------------------------------------

                for (
                    let paramIdx = 0;
                    paramIdx < parameters.length;
                    paramIdx++
                ) {
                    const param = parameters[paramIdx];

                    const status =
                        dateChecks[paramIdx]?.[shift] || '';

                    const request =
                        new sql.Request(transaction);

                    request
                        .input(
                            'machineShop',
                            sql.Int,
                            parseInt(header.machineShop)
                        )
                        .input(
                            'lineCode',
                            sql.NVarChar(50),
                            header.lineCode
                        )
                        .input(
                            'partName',
                            sql.NVarChar(200),
                            header.partName || ''
                        )
                        .input(
                            'partNo',
                            sql.NVarChar(100),
                            header.partNo || ''
                        )
                        .input(
                            'checkDate',
                            sql.Date,
                            checkDate
                        )
                        .input(
                            'machineNo',
                            sql.NVarChar(50),
                            block.machineNo || ''
                        )
                        .input(
                            'errorProofNo',
                            sql.NVarChar(100),
                            block.errorProofNo || ''
                        )
                        .input(
                            'parameter',
                            sql.NVarChar(255),
                            param.masterPosition || ''
                        )
                        .input(
                            'expectedStatus',
                            sql.NVarChar(255),
                            param.expectedStatus || ''
                        )
                        .input(
                            'shift',
                            sql.NVarChar(10),
                            shift
                        )
                        .input(
                            'status',
                            sql.NVarChar(10),
                            status
                        )
                        .input(
                            'lineInchargeSignature',
                            sql.NVarChar(255),
                            lineInchargeSignature
                        )
                        .input(
                            'productionSignature',
                            sql.NVarChar(255),
                            productionSignature
                        );

                    await request.query(`
                        INSERT INTO AirGapSensorCheckSheet
                        (
                            machineShop,
                            lineCode,
                            partName,
                            partNo,
                            checkDate,
                            machineNo,
                            errorProofNo,
                            parameter,
                            expectedStatus,
                            shift,
                            status,
                            lineInchargeSignature,
                            productionSignature
                        )
                        VALUES
                        (
                            @machineShop,
                            @lineCode,
                            @partName,
                            @partNo,
                            @checkDate,
                            @machineNo,
                            @errorProofNo,
                            @parameter,
                            @expectedStatus,
                            @shift,
                            @status,
                            @lineInchargeSignature,
                            @productionSignature
                        )
                    `);
                }
            }
        }

        await transaction.commit();

        return res.status(201).json({
            message: 'Air Gap Sensor Check Sheet saved successfully'
        });

    } catch (err) {

        console.error(
            'Error saving Air Gap Sensor Check Sheet:',
            err
        );

        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackErr) {
                console.error(
                    'Rollback error:',
                    rollbackErr
                );
            }
        }

        return res.status(500).json({
            error: 'Failed to save Air Gap Sensor Check Sheet'
        });
    }
};


// ============================================================
// GET PENDING AIR GAP DATA FROM ERROR PROOFING
// ============================================================

const getPendingAirGapData = async (req, res) => {

    const {
        shopId,
        lineCode
    } = req.query;

    try {

        let query = `
            SELECT TOP 50
                machineShop,
                lineCode,
                partName,
                partNo,
                checkDate,
                machineNo,
                errorProofNo,
                errorProofName
            FROM ErrorProofingCheckSheet
            WHERE 1 = 1
        `;

        const request = new sql.Request();

        if (shopId) {

            query += `
                AND machineShop = @shopId
            `;

            request.input(
                'shopId',
                sql.Int,
                parseInt(shopId)
            );
        }

        if (lineCode) {

            query += `
                AND lineCode = @lineCode
            `;

            request.input(
                'lineCode',
                sql.NVarChar(50),
                lineCode
            );
        }

        query += `
            ORDER BY id DESC
        `;

        const result =
            await request.query(query);

        if (result.recordset.length === 0) {

            return res.status(200).json({
                header: {},
                airGapRows: []
            });
        }

        const latestRecord =
            result.recordset[0];

        const header = {
            lineCode: latestRecord.lineCode,
            partName: latestRecord.partName,
            partNo: latestRecord.partNo,
            date: latestRecord.checkDate
        };

        const seen = new Set();
        const airGapRows = [];

        for (const row of result.recordset) {

            const key =
                `${row.machineNo}_${row.errorProofNo}`;

            if (
                row.machineNo &&
                !seen.has(key)
            ) {

                seen.add(key);

                airGapRows.push({
                    machineNo: row.machineNo,
                    errorProofNo:
                        row.errorProofNo || ''
                });
            }
        }

        return res.status(200).json({
            header,
            airGapRows
        });

    } catch (err) {

        console.error(
            'Error fetching pending Air Gap data:',
            err
        );

        return res.status(500).json({
            error: 'Failed to fetch pending Air Gap data'
        });
    }
};


// ============================================================
// GET SAVED AIR GAP SENSOR CHECK SHEET DATA
// ============================================================
// Used by frontend when reopening the form for a date.
//
// Example:
// GET /api/air-gap-sensor
//     ?lineCode=LINE1
//     &partNo=PART001
//     &date=2026-09-18
//
// Returns all saved shifts for that date.
// ============================================================

const getAirGapSensorCheckSheet = async (req, res) => {

    const {
        machineShop,
        lineCode,
        partNo,
        date
    } = req.query;

    try {

        let query = `
            SELECT
                id,
                machineShop,
                lineCode,
                partName,
                partNo,
                checkDate,
                machineNo,
                errorProofNo,
                parameter,
                expectedStatus,
                shift,
                status,
                lineInchargeSignature,
                productionSignature,
                createdAt
            FROM AirGapSensorCheckSheet
            WHERE 1 = 1
        `;

        const request = new sql.Request();

        if (machineShop) {

            query += `
                AND machineShop = @machineShop
            `;

            request.input(
                'machineShop',
                sql.Int,
                parseInt(machineShop)
            );
        }

        if (lineCode) {

            query += `
                AND lineCode = @lineCode
            `;

            request.input(
                'lineCode',
                sql.NVarChar(50),
                lineCode
            );
        }

        if (partNo) {

            query += `
                AND partNo = @partNo
            `;

            request.input(
                'partNo',
                sql.NVarChar(100),
                partNo
            );
        }

        if (date) {

            query += `
                AND checkDate = @checkDate
            `;

            request.input(
                'checkDate',
                sql.Date,
                date
            );
        }

        query += `
            ORDER BY
                machineNo,
                parameter,
                shift
        `;

        const result =
            await request.query(query);

        return res.status(200).json(
            result.recordset
        );

    } catch (err) {

        console.error(
            'Error fetching Air Gap Sensor data:',
            err
        );

        return res.status(500).json({
            error: 'Failed to fetch Air Gap Sensor data'
        });
    }
};


module.exports = {
    saveAirGapSensor,
    getPendingAirGapData,
    getAirGapSensorCheckSheet
};