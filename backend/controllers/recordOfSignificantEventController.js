const sql = require('../db');

// POST: Save Record of Significant Event
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

        // 1. Insert Header and Signature Record
        const recordResult = await transaction.request()
            .input('month', sql.NVarChar, header.month || '')
            .input('partName', sql.NVarChar, header.partName || '')
            .input('lineName', sql.NVarChar, header.lineName || '')
            .input('event', sql.NVarChar, header.event || '')
            .input('mcNo', sql.NVarChar, header.mcNo || '')
            .input('opNo', sql.NVarChar, header.opNo || '')
            .input(
                'recordDate',
                header.date ? sql.Date : sql.NVarChar,
                header.date || null
            )
            .input('shift', sql.NVarChar, header.shift || 'I')
            .input('fromTime', sql.NVarChar, header.from || '')
            .input('toTime', sql.NVarChar, header.to || '')
            .input(
                'prodnIncharge',
                sql.NVarChar,
                signatures?.prodnIncharge || ''
            )
            .input(
                'qcIncharge',
                sql.NVarChar,
                signatures?.qcIncharge || ''
            )
            .input(
                'prodnHofSign',
                sql.NVarChar,
                signatures?.prodnHofSign || ''
            )
            .query(`
                INSERT INTO SignificantEventRecords
                (
                    month,
                    partName,
                    lineName,
                    event,
                    mcNo,
                    opNo,
                    recordDate,
                    shift,
                    fromTime,
                    toTime,
                    prodnIncharge,
                    qcIncharge,
                    prodnHofSign
                )
                OUTPUT INSERTED.id
                VALUES
                (
                    @month,
                    @partName,
                    @lineName,
                    @event,
                    @mcNo,
                    @opNo,
                    @recordDate,
                    @shift,
                    @fromTime,
                    @toTime,
                    @prodnIncharge,
                    @qcIncharge,
                    @prodnHofSign
                )
            `);

        const recordId = recordResult.recordset[0].id;

        // 2. Insert Traceability
        if (traceability) {

            for (const type of ['casting', 'machining']) {

                const item = traceability[type];

                if (item) {

                    await transaction.request()
                        .input('recordId', sql.Int, recordId)
                        .input('traceType', sql.NVarChar, type)
                        .input(
                            'beforePart1',
                            sql.NVarChar,
                            item.before?.part1 || ''
                        )
                        .input(
                            'beforePart2',
                            sql.NVarChar,
                            item.before?.part2 || ''
                        )
                        .input(
                            'beforePart3',
                            sql.NVarChar,
                            item.before?.part3 || ''
                        )
                        .input(
                            'afterPart1',
                            sql.NVarChar,
                            item.after?.part1 || ''
                        )
                        .input(
                            'afterPart2',
                            sql.NVarChar,
                            item.after?.part2 || ''
                        )
                        .input(
                            'afterPart3',
                            sql.NVarChar,
                            item.after?.part3 || ''
                        )
                        .query(`
                            INSERT INTO SignificantEventTraceability
                            (
                                recordId,
                                traceType,
                                beforePart1,
                                beforePart2,
                                beforePart3,
                                afterPart1,
                                afterPart2,
                                afterPart3
                            )
                            VALUES
                            (
                                @recordId,
                                @traceType,
                                @beforePart1,
                                @beforePart2,
                                @beforePart3,
                                @afterPart1,
                                @afterPart2,
                                @afterPart3
                            )
                        `);
                }
            }
        }

        // 3. Insert Dynamic Measurement Rows
        if (rows && Array.isArray(rows)) {

            for (let rIdx = 0; rIdx < rows.length; rIdx++) {

                const row = rows[rIdx];

                const hasRowData =
                    row.controlSpec ||
                    row.inspectionGauge ||
                    row.before?.part1 ||
                    row.before?.part2 ||
                    row.before?.part3 ||
                    row.after?.part1 ||
                    row.after?.part2 ||
                    row.after?.part3;

                if (hasRowData) {

                    await transaction.request()
                        .input('recordId', sql.Int, recordId)
                        .input('rowIdx', sql.Int, rIdx + 1)
                        .input(
                            'controlSpec',
                            sql.NVarChar,
                            row.controlSpec || ''
                        )
                        .input(
                            'inspectionGauge',
                            sql.NVarChar,
                            row.inspectionGauge || ''
                        )
                        .input(
                            'beforePart1',
                            sql.NVarChar,
                            row.before?.part1 || ''
                        )
                        .input(
                            'beforePart2',
                            sql.NVarChar,
                            row.before?.part2 || ''
                        )
                        .input(
                            'beforePart3',
                            sql.NVarChar,
                            row.before?.part3 || ''
                        )
                        .input(
                            'afterPart1',
                            sql.NVarChar,
                            row.after?.part1 || ''
                        )
                        .input(
                            'afterPart2',
                            sql.NVarChar,
                            row.after?.part2 || ''
                        )
                        .input(
                            'afterPart3',
                            sql.NVarChar,
                            row.after?.part3 || ''
                        )
                        .query(`
                            INSERT INTO SignificantEventSpecs
                            (
                                recordId,
                                rowIdx,
                                controlSpec,
                                inspectionGauge,
                                beforePart1,
                                beforePart2,
                                beforePart3,
                                afterPart1,
                                afterPart2,
                                afterPart3
                            )
                            VALUES
                            (
                                @recordId,
                                @rowIdx,
                                @controlSpec,
                                @inspectionGauge,
                                @beforePart1,
                                @beforePart2,
                                @beforePart3,
                                @afterPart1,
                                @afterPart2,
                                @afterPart3
                            )
                        `);
                }
            }
        }

        await transaction.commit();

        res.status(201).json({
            message: 'Record of significant event saved successfully'
        });

    } catch (err) {

        console.error(
            'Error saving significant event record:',
            err
        );

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

        let query = `
            SELECT
                r.*,
                s.rowIdx,
                s.controlSpec,
                s.inspectionGauge,
                s.beforePart1,
                s.beforePart2,
                s.beforePart3,
                s.afterPart1,
                s.afterPart2,
                s.afterPart3
            FROM SignificantEventRecords r
            LEFT JOIN SignificantEventSpecs s
                ON r.id = s.recordId
            WHERE 1=1
        `;

        const request = new sql.Request();

        if (date) {

            request.input('date', sql.Date, date);

            query += `
                AND r.recordDate = @date
            `;
        }

        if (partName) {

            request.input(
                'partName',
                sql.NVarChar,
                `%${partName}%`
            );

            query += `
                AND r.partName LIKE @partName
            `;
        }

        if (lineName) {

            request.input(
                'lineName',
                sql.NVarChar,
                `%${lineName}%`
            );

            query += `
                AND r.lineName LIKE @lineName
            `;
        }

        query += `
            ORDER BY r.id DESC, s.rowIdx ASC
        `;

        const result = await request.query(query);

        res.json(result.recordset);

    } catch (err) {

        console.error(
            'Error fetching records:',
            err
        );

        res.status(500).json({
            error: 'Failed to fetch significant event records'
        });
    }
};


module.exports = {
    saveSignificantEvent,
    getSignificantEventRecords
};