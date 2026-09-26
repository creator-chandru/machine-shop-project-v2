const sql = require('../db');

// Helper to sanitize time values for SQL TIME data type
const sanitizeTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.trim()) {
        return null;
    }
    return timeStr.trim();
};

// ============================================================
// Helper: Generate Part Traceability Code
// Format: YEAR + MONTH + DAY + SHIFT - LINE
// Example: 2026-09-26, Shift II, M3L002 => S9S2-2
//          2026-09-26, Shift II, M3L01A => S9S2-1A
//          2026-09-26, Shift II, M3L36A => S9S2-36A
// ============================================================
const generatePartTraceability = async (transaction, lineCode, checkDate, shift) => {
    if (!lineCode || !checkDate || !shift) {
        return '';
    }

    // Extract digits and optional letter suffix at the end of lineCode
    // M3L001 -> 1
    // M3L01A -> 1A
    // M3L36A -> 36A
    const lineMatch = String(lineCode).match(/(\d+)([A-Za-z]*)$/);

    if (!lineMatch) {
        return '';
    }

    const digits = parseInt(lineMatch[1], 10);
    const suffix = lineMatch[2] ? lineMatch[2].toUpperCase() : '';
    const lineIdentifier = `${digits}${suffix}`;

    // Convert shift I / II / III or 1 / 2 / 3
    const shiftMap = {
        I: 1,
        II: 2,
        III: 3,
        '1': 1,
        '2': 2,
        '3': 3,
    };

    const shiftNumber = shiftMap[String(shift).trim().toUpperCase()];

    if (!shiftNumber) {
        return '';
    }

    // Handle date parsing safely without timezone shifts
    let year, month, day;
    if (typeof checkDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(checkDate)) {
        const parts = checkDate.split('T')[0].split('-');
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
    } else {
        const dateObj = new Date(checkDate);
        if (isNaN(dateObj.getTime())) {
            return '';
        }
        year = dateObj.getFullYear();
        month = dateObj.getMonth() + 1;
        day = dateObj.getDate();
    }

    const request = transaction.request();

    request.input('yearValue', sql.Int, year);
    request.input('monthValue', sql.Int, month);
    request.input('dayValue', sql.Int, day);
    request.input('shiftValue', sql.Int, shiftNumber);

    const result = await request.query(`
        SELECT
            (SELECT CodeValue
             FROM TraceabilityCodeMapping
             WHERE MappingType = 'YEAR'
               AND SourceValue = @yearValue) AS yearCode,

            (SELECT CodeValue
             FROM TraceabilityCodeMapping
             WHERE MappingType = 'MONTH'
               AND SourceValue = @monthValue) AS monthCode,

            (SELECT CodeValue
             FROM TraceabilityCodeMapping
             WHERE MappingType = 'DAY'
               AND SourceValue = @dayValue) AS dayCode,

            (SELECT CodeValue
             FROM TraceabilityCodeMapping
             WHERE MappingType = 'SHIFT'
               AND SourceValue = @shiftValue) AS shiftCode
    `);

    const mapping = result.recordset[0];

    if (
        !mapping ||
        !mapping.yearCode ||
        !mapping.monthCode ||
        !mapping.dayCode ||
        !mapping.shiftCode
    ) {
        return '';
    }

    return `${mapping.yearCode}${mapping.monthCode}${mapping.dayCode}${mapping.shiftCode}-${lineIdentifier}`;
};

// ============================================================
// POST: Save Tool Change Record
// ============================================================
const saveToolChangeRecord = async (req, res) => {
    const { header, sections } = req.body;

    const machineShop = parseInt(header?.machineShop || req.body.machineShop || 3, 10);
    const lineCode = header?.lineCode || req.body.lineCode || '';
    const partName = header?.partName || req.body.partName || '';
    const headerDate = header?.date || req.body.date || null;

    if (!sections || !Array.isArray(sections)) {
        return res.status(400).json({
            error: 'Invalid Payload: sections array is required'
        });
    }

    if (!lineCode) {
        return res.status(400).json({
            error: 'Invalid Payload: Line Code is required'
        });
    }

    const transaction = new sql.Transaction();

    try {
        await transaction.begin();

        for (let secIdx = 0; secIdx < sections.length; secIdx++) {
            const sec = sections[secIdx];

            // Check if section has any data
            const hasData =
                sec.toolDescription ||
                sec.mcNo ||
                sec.machineNo ||
                sec.opNo ||
                sec.date ||
                sec.rows?.some(
                    (r) => r.controlSpec || r.before || r.after || r.beforeValue || r.afterValue
                ) ||
                sec.toolChangedBy?.signature ||
                sec.toolChangedBy?.name ||
                sec.verifiedByQc?.signature ||
                sec.verifiedByQc?.name ||
                (typeof sec.toolChangedBy === 'string' && sec.toolChangedBy.trim()) ||
                (typeof sec.verifiedByQc === 'string' && sec.verifiedByQc.trim());

            if (!hasData) continue;

            const toolDescription = sec.toolDescription || '';
            const machineNo = sec.mcNo || sec.machineNo || '';
            const opNo = sec.opNo || '';
            const checkDate = sec.date || headerDate || new Date().toISOString().split('T')[0];
            const shift = sec.shift || 'I';
            const fromTime = sanitizeTime(sec.from || sec.fromTime);
            const toTime = sanitizeTime(sec.to || sec.toTime);

            let partTraceability = sec.partTraceability || '';

            if (!partTraceability.trim()) {
                partTraceability = await generatePartTraceability(
                    transaction,
                    lineCode,
                    checkDate,
                    shift
                );
            }
            const toolChangedBySignature = (typeof sec.toolChangedBy === 'object' ? sec.toolChangedBy?.signature : sec.toolChangedBy) || '';
            const verifiedByQcSignature = (typeof sec.verifiedByQc === 'object' ? sec.verifiedByQc?.signature : sec.verifiedByQc) || '';

            const rows = sec.rows && Array.isArray(sec.rows) ? sec.rows : [];

            if (rows.length === 0) {
                await transaction.request()
                    .input('machineShop', sql.Int, machineShop)
                    .input('lineCode', sql.NVarChar(100), lineCode)
                    .input('partName', sql.NVarChar(100), partName)
                    .input('partTraceability', sql.NVarChar(100), partTraceability)
                    .input('toolDescription', sql.NVarChar(255), toolDescription)
                    .input('machineNo', sql.NVarChar(100), machineNo)
                    .input('opNo', sql.NVarChar(100), opNo)
                    .input('checkDate', sql.Date, checkDate)
                    .input('shift', sql.NVarChar(20), shift)
                    .input('fromTime', sql.VarChar(10), fromTime)
                    .input('toTime', sql.VarChar(10), toTime)
                    .input('slNo', sql.Int, 1)
                    .input('controlSpec', sql.NVarChar(255), '')
                    .input('beforeValue', sql.NVarChar(255), '')
                    .input('afterValue', sql.NVarChar(255), '')
                    .input('toolChangedBySignature', sql.NVarChar(100), toolChangedBySignature)
                    .input('verifiedByQcSignature', sql.NVarChar(100), verifiedByQcSignature)
                    .query(`
                        INSERT INTO ToolChangeRecord (
                            machineShop,
                            lineCode,
                            partName,
                            partTraceability,
                            toolDescription,
                            machineNo,
                            opNo,
                            checkDate,
                            shift,
                            fromTime,
                            toTime,
                            slNo,
                            controlSpec,
                            beforeValue,
                            afterValue,
                            toolChangedBySignature,
                            verifiedByQcSignature
                        )
                        VALUES (
                            @machineShop,
                            @lineCode,
                            @partName,
                            @partTraceability,
                            @toolDescription,
                            @machineNo,
                            @opNo,
                            @checkDate,
                            @shift,
                            @fromTime,
                            @toTime,
                            @slNo,
                            @controlSpec,
                            @beforeValue,
                            @afterValue,
                            @toolChangedBySignature,
                            @verifiedByQcSignature
                        )
                    `);
            } else {
                for (let rIdx = 0; rIdx < rows.length; rIdx++) {
                    const row = rows[rIdx];
                    const controlSpec = row.controlSpec || '';
                    const beforeValue = row.before || row.beforeValue || '';
                    const afterValue = row.after || row.afterValue || '';

                    await transaction.request()
                        .input('machineShop', sql.Int, machineShop)
                        .input('lineCode', sql.NVarChar(100), lineCode)
                        .input('partName', sql.NVarChar(100), partName)
                        .input('partTraceability', sql.NVarChar(100), partTraceability)
                        .input('toolDescription', sql.NVarChar(255), toolDescription)
                        .input('machineNo', sql.NVarChar(100), machineNo)
                        .input('opNo', sql.NVarChar(100), opNo)
                        .input('checkDate', sql.Date, checkDate)
                        .input('shift', sql.NVarChar(20), shift)
                        .input('fromTime', sql.VarChar(10), fromTime)
                        .input('toTime', sql.VarChar(10), toTime)
                        .input('slNo', sql.Int, rIdx + 1)
                        .input('controlSpec', sql.NVarChar(255), controlSpec)
                        .input('beforeValue', sql.NVarChar(255), beforeValue)
                        .input('afterValue', sql.NVarChar(255), afterValue)
                        .input('toolChangedBySignature', sql.NVarChar(100), toolChangedBySignature)
                        .input('verifiedByQcSignature', sql.NVarChar(100), verifiedByQcSignature)
                        .query(`
                            INSERT INTO ToolChangeRecord (
                                machineShop,
                                lineCode,
                                partName,
                                partTraceability,
                                toolDescription,
                                machineNo,
                                opNo,
                                checkDate,
                                shift,
                                fromTime,
                                toTime,
                                slNo,
                                controlSpec,
                                beforeValue,
                                afterValue,
                                toolChangedBySignature,
                                verifiedByQcSignature
                            )
                            VALUES (
                                @machineShop,
                                @lineCode,
                                @partName,
                                @partTraceability,
                                @toolDescription,
                                @machineNo,
                                @opNo,
                                @checkDate,
                                @shift,
                                @fromTime,
                                @toTime,
                                @slNo,
                                @controlSpec,
                                @beforeValue,
                                @afterValue,
                                @toolChangedBySignature,
                                @verifiedByQcSignature
                            )
                        `);
                }
            }
        }

        await transaction.commit();

        return res.status(201).json({
            message: 'Tool change record saved successfully'
        });

    } catch (err) {
        console.error('Error saving Tool change record:', err);

        try {
            await transaction.rollback();
        } catch (rollbackErr) {
            console.error('Rollback failed:', rollbackErr);
        }

        return res.status(500).json({
            error: 'Failed to save Tool change record'
        });
    }
};

// ============================================================
// GET: Generate Part Traceability
// ============================================================
const getPartTraceability = async (req, res) => {
    const { lineCode, date, shift } = req.query;

    if (!lineCode || !date || !shift) {
        return res.status(400).json({
            error: 'lineCode, date and shift are required'
        });
    }

    const transaction = new sql.Transaction();

    try {
        await transaction.begin();

        const partTraceability = await generatePartTraceability(
            transaction,
            lineCode,
            date,
            shift
        );

        await transaction.commit();

        return res.status(200).json({
            partTraceability: partTraceability || ''
        });

    } catch (err) {
        console.error('Error generating Part Traceability:', err);

        try {
            await transaction.rollback();
        } catch (rollbackErr) {
            console.error('Rollback failed:', rollbackErr);
        }

        return res.status(500).json({
            error: 'Failed to generate Part Traceability'
        });
    }
};

// ============================================================
// GET: Fetch records by filters
// ============================================================
const getToolChangeRecords = async (req, res) => {
    const { machineShop, lineCode, partName, date, machineNo } = req.query;

    try {
        let query = `
            SELECT
                id,
                machineShop,
                lineCode,
                partName,
                partTraceability,
                toolDescription,
                machineNo,
                opNo,
                checkDate,
                shift,
                CONVERT(VARCHAR(5), fromTime, 108) AS fromTime,
                CONVERT(VARCHAR(5), toTime, 108) AS toTime,
                slNo,
                controlSpec,
                beforeValue,
                afterValue,
                toolChangedBySignature,
                verifiedByQcSignature,
                createdAt
            FROM ToolChangeRecord
            WHERE 1=1
        `;

        const request = new sql.Request();

        if (machineShop) {
            request.input('machineShop', sql.Int, parseInt(machineShop, 10));
            query += ` AND machineShop = @machineShop`;
        }

        if (lineCode) {
            request.input('lineCode', sql.NVarChar(100), lineCode);
            query += ` AND lineCode = @lineCode`;
        }

        if (partName) {
            request.input('partName', sql.NVarChar(100), `%${partName}%`);
            query += ` AND partName LIKE @partName`;
        }

        if (date) {
            request.input('date', sql.Date, date);
            query += ` AND checkDate = @date`;
        }

        if (machineNo) {
            request.input('machineNo', sql.NVarChar(100), machineNo);
            query += ` AND machineNo = @machineNo`;
        }

        query += ` ORDER BY checkDate DESC, id ASC, slNo ASC`;

        const result = await request.query(query);

        return res.status(200).json(result.recordset);

    } catch (err) {
        console.error('Error fetching records:', err);

        return res.status(500).json({
            error: 'Failed to fetch Tool change records'
        });
    }
};

module.exports = {
    saveToolChangeRecord,
    getToolChangeRecords,
    getPartTraceability
};