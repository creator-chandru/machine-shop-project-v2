const sql = require('../db');

// POST: Save Record of Significant Event into single table
const saveSignificantEvent = async (req, res) => {
    const { header, traceability, rows, signatures } = req.body;

    if (!header) {
        return res.status(400).json({
            error: 'Invalid payload: Header information is required'
        });
    }

    const transaction = new sql.Transaction();

    try {
        await transaction.begin();

        const rowsToInsert = (rows && rows.length > 0) ? rows : [{}];

        for (let rIdx = 0; rIdx < rowsToInsert.length; rIdx++) {
            const row = rowsToInsert[rIdx];

            await transaction.request()
                .input('month', sql.NVarChar, header.month || '')
                .input('partName', sql.NVarChar, header.partName || '')
                .input('lineName', sql.NVarChar, header.lineName || '')
                .input('event', sql.NVarChar, header.event || '')
                .input('mcNo', sql.NVarChar, header.mcNo || '')
                .input('opNo', sql.NVarChar, header.opNo || '')
                .input('recordDate', header.date ? sql.Date : sql.NVarChar, header.date || null)
                .input('shift', sql.NVarChar, header.shift || 'I')
                .input('fromTime', sql.NVarChar, header.from || '')
                .input('toTime', sql.NVarChar, header.to || '')
                .input('rowIdx', sql.Int, rIdx + 1)
                .input('controlSpec', sql.NVarChar, row.controlSpec || '')
                .input('inspectionGauge', sql.NVarChar, row.inspectionGauge || '')
                .input('beforePart1', sql.NVarChar, row.before?.part1 || '')
                .input('beforePart2', sql.NVarChar, row.before?.part2 || '')
                .input('beforePart3', sql.NVarChar, row.before?.part3 || '')
                .input('afterPart1', sql.NVarChar, row.after?.part1 || '')
                .input('afterPart2', sql.NVarChar, row.after?.part2 || '')
                .input('afterPart3', sql.NVarChar, row.after?.part3 || '')
                .input('castingBeforePart1', sql.NVarChar, traceability?.casting?.before?.part1 || '')
                .input('castingBeforePart2', sql.NVarChar, traceability?.casting?.before?.part2 || '')
                .input('castingBeforePart3', sql.NVarChar, traceability?.casting?.before?.part3 || '')
                .input('castingAfterPart1', sql.NVarChar, traceability?.casting?.after?.part1 || '')
                .input('castingAfterPart2', sql.NVarChar, traceability?.casting?.after?.part2 || '')
                .input('castingAfterPart3', sql.NVarChar, traceability?.casting?.after?.part3 || '')
                .input('machiningBeforePart1', sql.NVarChar, traceability?.machining?.before?.part1 || '')
                .input('machiningBeforePart2', sql.NVarChar, traceability?.machining?.before?.part2 || '')
                .input('machiningBeforePart3', sql.NVarChar, traceability?.machining?.before?.part3 || '')
                .input('machiningAfterPart1', sql.NVarChar, traceability?.machining?.after?.part1 || '')
                .input('machiningAfterPart2', sql.NVarChar, traceability?.machining?.after?.part2 || '')
                .input('machiningAfterPart3', sql.NVarChar, traceability?.machining?.after?.part3 || '')
                .input('prodnIncharge', sql.NVarChar, signatures?.prodnIncharge || '')
                .input('qcIncharge', sql.NVarChar, signatures?.qcIncharge || '')
                .input('prodnHofSign', sql.NVarChar, signatures?.prodnHofSign || '')
                .query(`
                    INSERT INTO SignificantEventRecord
                    (
                        month, partName, lineName, event, mcNo, opNo,
                        recordDate, shift, fromTime, toTime,
                        rowIdx, controlSpec, inspectionGauge,
                        beforePart1, beforePart2, beforePart3,
                        afterPart1, afterPart2, afterPart3,
                        castingBeforePart1, castingBeforePart2, castingBeforePart3,
                        castingAfterPart1, castingAfterPart2, castingAfterPart3,
                        machiningBeforePart1, machiningBeforePart2, machiningBeforePart3,
                        machiningAfterPart1, machiningAfterPart2, machiningAfterPart3,
                        prodnIncharge, qcIncharge, prodnHofSign
                    )
                    VALUES
                    (
                        @month, @partName, @lineName, @event, @mcNo, @opNo,
                        @recordDate, @shift, @fromTime, @toTime,
                        @rowIdx, @controlSpec, @inspectionGauge,
                        @beforePart1, @beforePart2, @beforePart3,
                        @afterPart1, @afterPart2, @afterPart3,
                        @castingBeforePart1, @castingBeforePart2, @castingBeforePart3,
                        @castingAfterPart1, @castingAfterPart2, @castingAfterPart3,
                        @machiningBeforePart1, @machiningBeforePart2, @machiningBeforePart3,
                        @machiningAfterPart1, @machiningAfterPart2, @machiningAfterPart3,
                        @prodnIncharge, @qcIncharge, @prodnHofSign
                    )
                `);
        }

        await transaction.commit();

        res.status(201).json({
            message: 'Record of significant event saved successfully'
        });

    } catch (err) {
        console.error('Error saving significant event record:', err);
        try {
            await transaction.rollback();
        } catch (rollbackErr) {
            console.error('Rollback failed:', rollbackErr);
        }

        res.status(500).json({
            error: 'Failed to save significant event record'
        });
    }
};

// GET: Fetch Records by Date, Part Name, or Line Name
const getSignificantEventRecords = async (req, res) => {
    const { date, partName, lineName } = req.query;

    try {
        let query = `SELECT * FROM SignificantEventRecord WHERE 1=1`;
        const request = new sql.Request();

        if (date) {
            request.input('date', sql.Date, date);
            query += ` AND recordDate = @date`;
        }

        if (partName) {
            request.input('partName', sql.NVarChar, `%${partName}%`);
            query += ` AND partName LIKE @partName`;
        }

        if (lineName) {
            request.input('lineName', sql.NVarChar, `%${lineName}%`);
            query += ` AND lineName LIKE @lineName`;
        }

        query += ` ORDER BY id DESC, rowIdx ASC`;

        const result = await request.query(query);
        res.json(result.recordset);

    } catch (err) {
        console.error('Error fetching records:', err);
        res.status(500).json({
            error: 'Failed to fetch significant event records'
        });
    }
};

module.exports = {
    saveSignificantEvent,
    getSignificantEventRecords
};