const sql = require('../db');
const PDFDocument = require("pdfkit");
const fs = require('fs');
const path = require('path');

// Helper to sanitize time values for SQL TIME/VARCHAR data type
const sanitizeTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.trim()) {
        return null;
    }
    return timeStr.trim();
};

// ============================================================
// DYNAMIC QF HELPERS
// ============================================================
const fetchQfHistory = async () => {
    try {
        const res = await sql.query(`
            SELECT id, formName, qfValue, date 
            FROM ToolChangeRecordQFvalues 
            ORDER BY date DESC, id DESC
        `);
        return res.recordset || [];
    } catch (e) {
        console.error("Warning: Could not fetch ToolChangeRecordQFvalues:", e.message);
        return [];
    }
};

const getEffectiveQfValue = (qfHistory, recordDateStr) => {
    const fallback = "QF/07/MPD-32, Rev.No: 02 dt 10.01.2023";
    if (!qfHistory || qfHistory.length === 0) return fallback;

    if (recordDateStr) {
        const targetDate = new Date(recordDateStr);
        targetDate.setHours(0, 0, 0, 0);

        for (let qf of qfHistory) {
            if (!qf.date) continue;
            const qfDate = new Date(qf.date);
            qfDate.setHours(0, 0, 0, 0);

            if (qfDate <= targetDate) {
                return qf.qfValue;
            }
        }
    }
    return qfHistory[0]?.qfValue || fallback;
};

// ============================================================
// Helper: Generate Part Traceability Code (Internal)
// ============================================================
const generatePartTraceability = async (transaction, lineCode, checkDate, shift) => {
    if (!lineCode || !checkDate || !shift) return '';

    const lineMatch = String(lineCode).match(/(\d+)([A-Za-z]*)$/);
    if (!lineMatch) return '';

    const digits = parseInt(lineMatch[1], 10);
    const suffix = lineMatch[2] ? lineMatch[2].toUpperCase() : '';
    const lineIdentifier = `${digits}${suffix}`;

    const shiftMap = {
        I: 1, II: 2, III: 3,
        '1': 1, '2': 2, '3': 3,
    };

    const shiftNumber = shiftMap[String(shift).trim().toUpperCase()];
    if (!shiftNumber) return '';

    let year, month, day;
    if (typeof checkDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(checkDate)) {
        const parts = checkDate.split('T')[0].split('-');
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
    } else {
        const dateObj = new Date(checkDate);
        if (isNaN(dateObj.getTime())) return '';
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
            (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'YEAR' AND SourceValue = @yearValue) AS yearCode,
            (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'MONTH' AND SourceValue = @monthValue) AS monthCode,
            (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'DAY' AND SourceValue = @dayValue) AS dayCode,
            (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'SHIFT' AND SourceValue = @shiftValue) AS shiftCode
    `);

    const mapping = result.recordset[0];
    if (!mapping || !mapping.yearCode || !mapping.monthCode || !mapping.dayCode || !mapping.shiftCode) {
        return '';
    }

    return `${mapping.yearCode}${mapping.monthCode}${mapping.dayCode}${mapping.shiftCode}-${lineIdentifier}`;
};

// ============================================================
// 1. GET: Part Traceability API Route Handler
// ============================================================
const getPartTraceability = async (req, res) => {
    const { lineCode, date, shift } = req.query;

    if (!lineCode || !date || !shift) {
        return res.status(400).json({ error: 'lineCode, date and shift are required' });
    }

    const transaction = new sql.Transaction();
    try {
        await transaction.begin();
        const partTraceability = await generatePartTraceability(transaction, lineCode, date, shift);
        await transaction.commit();
        return res.status(200).json({ partTraceability: partTraceability || '' });
    } catch (err) {
        console.error('Error generating Part Traceability:', err);
        try { await transaction.rollback(); } catch (e) {}
        return res.status(500).json({ error: 'Failed to generate Part Traceability' });
    }
};

// ============================================================
// 2. GET: QC Incharges (List for Shift Incharge dropdown)
// ============================================================
const getIncharges = async (req, res) => {
    try {
        const qcRes = await sql.query`
            SELECT username AS name, username, employeeId 
            FROM dbo.MachineShopUsers 
            WHERE LOWER(role) IN ('qc', 'qualitycontroller') 
            ORDER BY username ASC
        `;

        const list = qcRes.recordset.length > 0 
            ? qcRes.recordset 
            : [{ name: 'qc', username: 'qc', employeeId: 'qc' }];

        return res.status(200).json({ qcList: list });
    } catch (err) {
        console.error('Error fetching QC incharges:', err);
        return res.status(500).json({ error: 'Failed to fetch QC list' });
    }
};

// ============================================================
// 3. POST: Save / Update Tool Change Record (Shift Incharge)
// ============================================================
const saveToolChangeRecord = async (req, res) => {
    const { header, sections, status } = req.body;

    const machineShop = parseInt(header?.machineShop || req.body.machineShop || 3, 10);
    const lineCode = header?.lineCode || req.body.lineCode || '';
    const partName = header?.partName || req.body.partName || '';
    const partNo = header?.partNo || req.body.partNo || '';
    const headerDate = header?.date || req.body.date || new Date().toISOString().split('T')[0];

    if (!sections || !Array.isArray(sections)) {
        return res.status(400).json({ error: 'Invalid Payload: sections array is required' });
    }

    if (!lineCode) {
        return res.status(400).json({ error: 'Invalid Payload: Line Code is required' });
    }

    const transaction = new sql.Transaction();

    try {
        await transaction.begin();

        const cleanDate = String(headerDate).split('T')[0];

        // Replace the same line/date records only for machines included in this submission.
        const targetMachineNumbers = [...new Set(
            sections
                .map((sec) => String(sec.mcNo || sec.machineNo || header?.machineNo || '').trim())
                .filter(Boolean)
        )];
        const machineParams = targetMachineNumbers.map((_, idx) => `@targetMachine${idx}`);
        const machineFilter = machineParams.length
            ? `AND machineNo IN (${machineParams.join(', ')})`
            : 'AND 1 = 0';

        const deleteRequest = transaction.request()
            .input('lineCode', sql.NVarChar(100), lineCode)
            .input('checkDate', sql.NVarChar(50), cleanDate)
            .input('machineShop', sql.Int, machineShop);
        targetMachineNumbers.forEach((machineNo, idx) => {
            deleteRequest.input(`targetMachine${idx}`, sql.NVarChar(100), machineNo);
        });
        await deleteRequest.query(`
            DELETE FROM ToolChangeRecord
            WHERE lineCode = @lineCode
              AND (CONVERT(date, checkDate) = CONVERT(date, @checkDate) OR FORMAT(checkDate, 'yyyy-MM-dd') = @checkDate)
              AND machineShop = @machineShop
              ${machineFilter}
        `);

        for (let secIdx = 0; secIdx < sections.length; secIdx++) {
            const sec = sections[secIdx];

            const toolDescription = sec.toolDescription || '';
            const machineNo = sec.mcNo || sec.machineNo || header?.machineNo || '';
            const opNo = sec.opNo || header?.opNo || '';
            const checkDate = sec.date || headerDate;
            const shift = sec.shift || 'I';
            const fromTime = sanitizeTime(sec.from || sec.fromTime);
            const toTime = sanitizeTime(sec.to || sec.toTime);
            const assignedQc = sec.assignedQc || '';
            let partTraceability = sec.partTraceability || '';
            if (!partTraceability.trim()) {
                partTraceability = await generatePartTraceability(transaction, lineCode, checkDate, shift);
            }

            const toolChangedBySignature = (typeof sec.toolChangedBy === 'object' ? sec.toolChangedBy?.signature : sec.toolChangedBy) || 'Approved';
            const verifiedByQcSignature = (typeof sec.verifiedByQc === 'object' ? sec.verifiedByQc?.signature : sec.verifiedByQc) || '';
            const recordStatus = (verifiedByQcSignature && verifiedByQcSignature !== 'Pending') ? 'Completed' : (status || 'Pending');

            const rows = sec.rows && Array.isArray(sec.rows) && sec.rows.length > 0
                ? sec.rows
                : [{ controlSpec: '', units: '', unitType: '', before: '', after: '' }];

            for (let rIdx = 0; rIdx < rows.length; rIdx++) {
                const row = rows[rIdx];
                const controlSpec = row.controlSpec || (row.nominalValue && row.toleranceValue ? `${row.nominalValue} ${row.operatorSymbol || '±'} ${row.toleranceValue}` : row.nominalValue || '');
                const beforeValue = row.before || row.beforeValue || '';
                const afterValue = row.after || row.afterValue || '';
                const units = row.units || '';
                const unitType = row.unitType || '';

                await transaction.request()
                    .input('machineShop', sql.Int, machineShop)
                    .input('lineCode', sql.NVarChar(100), lineCode)
                    .input('partName', sql.NVarChar(100), partName)
                    .input('partNo', sql.NVarChar(100), partNo)
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
                    .input('units', sql.NVarChar(20), units)
                    .input('unitType', sql.NVarChar(100), unitType)
                    .input('beforeValue', sql.NVarChar(255), beforeValue)
                    .input('afterValue', sql.NVarChar(255), afterValue)
                    .input('toolChangedBySignature', sql.NVarChar(100), toolChangedBySignature)
                    .input('verifiedByQcSignature', sql.NVarChar(100), verifiedByQcSignature)
                    .input('assignedQc', sql.NVarChar(100), assignedQc)
                    .input('status', sql.NVarChar(50), recordStatus)
                    .query(`
                        INSERT INTO ToolChangeRecord (
                            machineShop, lineCode, partName, partNo, partTraceability, toolDescription,
                            machineNo, opNo, checkDate, shift, fromTime, toTime,
                            slNo, controlSpec, units, unitType, beforeValue, afterValue,
                            toolChangedBySignature, verifiedByQcSignature, assignedQc, status
                        )
                        VALUES (
                            @machineShop, @lineCode, @partName, @partNo, @partTraceability, @toolDescription,
                            @machineNo, @opNo, @checkDate, @shift, @fromTime, @toTime,
                            @slNo, @controlSpec, @units, @unitType, @beforeValue, @afterValue,
                            @toolChangedBySignature, @verifiedByQcSignature, @assignedQc, @status
                        )
                    `);
            }
        }

        await transaction.commit();
        return res.status(201).json({ success: true, message: 'Tool change record saved and assigned to QC successfully!' });
    } catch (err) {
        console.error('Error saving Tool change record:', err);
        try { await transaction.rollback(); } catch (e) {}
        return res.status(500).json({ error: 'Failed to save Tool change record' });
    }
};

// ============================================================
// 4. GET: QC Dashboard Pending Reports
// ============================================================
const getQcReports = async (req, res) => {
    try {
        const { name } = req.params;
        const shopId = parseInt(req.query.shopId, 10);

        const request = new sql.Request();
        request.input('qcName', sql.NVarChar(100), String(name || '').trim());

        let shopFilter = '';
        if (!isNaN(shopId)) {
            request.input('machineShop', sql.Int, shopId);
            shopFilter = ' AND machineShop = @machineShop';
        }

        const result = await request.query(`
            SELECT 
                MIN(id) AS id,
                machineShop,
                lineCode,
                MAX(partName) AS partName,
                MAX(partNo) AS partNo,
                machineNo,
                FORMAT(checkDate, 'yyyy-MM-dd') AS reportDate,
                MAX(assignedQc) AS assignedQc,
                MAX(toolChangedBySignature) AS toolChangedBySignature,
                MAX(verifiedByQcSignature) AS verifiedByQcSignature,
                'Pending' AS status
            FROM ToolChangeRecord
            WHERE (verifiedByQcSignature IS NULL OR verifiedByQcSignature = '' OR verifiedByQcSignature = 'Pending')
              AND LOWER(LTRIM(RTRIM(assignedQc))) = LOWER(@qcName)
              ${shopFilter}
            GROUP BY machineShop, lineCode, checkDate, machineNo
            ORDER BY checkDate DESC, MIN(id) DESC
        `);
        return res.status(200).json(result.recordset);
    } catch (err) {
        console.error('QC Dashboard Fetch Error:', err);
        return res.status(500).json({ message: 'DB error' });
    }
};

// ============================================================
// 5. POST: QC Sign and Approve
// ============================================================
const signQcApproval = async (req, res) => {
    try {
        const { lineCode, date, machineNo, signature, qcUsername } = req.body;

        if (!lineCode || !date || !machineNo || !qcUsername) {
            return res.status(400).json({ message: 'Missing lineCode, date, machineNo or qcUsername' });
        }

        const signVal = signature || qcUsername;
        let cleanDate = String(date).split('T')[0];
        if (cleanDate.includes('/')) {
            const p = cleanDate.split('/');
            cleanDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }

        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(100), lineCode);
        request.input('machineNo', sql.NVarChar(100), machineNo);
        request.input('checkDate', sql.NVarChar(50), cleanDate);
        request.input('signature', sql.NVarChar(100), signVal);
        request.input('qcName', sql.NVarChar(100), String(qcUsername).trim());

        const result = await request.query(`
            UPDATE ToolChangeRecord 
            SET verifiedByQcSignature = @signature, status = 'Completed', updatedAt = GETDATE()
            WHERE lineCode = @lineCode 
              AND machineNo = @machineNo
              AND CONVERT(date, checkDate) = CONVERT(date, @checkDate)
              AND (verifiedByQcSignature IS NULL OR verifiedByQcSignature = '' OR verifiedByQcSignature = 'Pending')
              AND LOWER(LTRIM(RTRIM(assignedQc))) = LOWER(@qcName)
        `);

        if (!result.rowsAffected[0]) {
            return res.status(404).json({ message: 'No pending rows assigned to you for this record' });
        }

        return res.status(200).json({ success: true, message: 'Tool change record approved successfully!' });
    } catch (err) {
        console.error('Sign QC Error:', err);
        return res.status(500).json({ message: 'Failed to approve record' });
    }
};

// ============================================================
// 6. GET: Fetch Records (Query by lineCode, date, machineNo, shift)
// ============================================================
const parseControlSpec = (spec) => {
    const tokens = String(spec || '').trim().split(/\s+/).filter(Boolean);
    const isSym = (t) => t === '±' || t === '+' || t === '-';
    if (tokens.length === 0) return { nominalValue: '', operatorSymbol: '±', toleranceValue: '' };
    if (tokens.length >= 3 && isSym(tokens[1])) {
        return { nominalValue: tokens[0], operatorSymbol: tokens[1], toleranceValue: tokens.slice(2).join(' ') };
    }
    if (tokens.length === 2) {
        if (isSym(tokens[0])) return { nominalValue: '', operatorSymbol: tokens[0], toleranceValue: tokens[1] };
        if (isSym(tokens[1])) return { nominalValue: tokens[0], operatorSymbol: tokens[1], toleranceValue: '' };
    }
    return { nominalValue: tokens[0], operatorSymbol: '±', toleranceValue: '' };
};

const getToolChangeRecords = async (req, res) => {
    const { machineShop, lineCode, partName, date, machineNo, shift } = req.query;

    try {
        let query = `
            SELECT
                id,
                machineShop,
                lineCode,
                partName,
                partNo,
                partTraceability,
                toolDescription,
                machineNo,
                opNo,
                FORMAT(checkDate, 'yyyy-MM-dd') AS checkDate,
                shift,
                CONVERT(VARCHAR(5), fromTime, 108) AS fromTime,
                CONVERT(VARCHAR(5), toTime, 108) AS toTime,
                slNo,
                controlSpec,
                units,
                unitType,
                beforeValue,
                afterValue,
                toolChangedBySignature,
                verifiedByQcSignature,
                assignedQc,
                status,
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
            request.input('lineCode', sql.NVarChar(100), lineCode.trim());
            query += ` AND LTRIM(RTRIM(lineCode)) = @lineCode`;
        }
        if (machineNo) {
            request.input('machineNo', sql.NVarChar(100), machineNo.trim());
            query += ` AND LTRIM(RTRIM(machineNo)) = @machineNo`;
        }
        if (partName) {
            request.input('partName', sql.NVarChar(100), `%${partName}%`);
            query += ` AND partName LIKE @partName`;
        }
        if (date) {
            let cleanDate = String(date).split('T')[0];
            if (cleanDate.includes('/')) {
                const p = cleanDate.split('/');
                cleanDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
            }
            request.input('checkDate', sql.NVarChar(50), cleanDate);
            query += ` AND (CONVERT(date, checkDate) = CONVERT(date, @checkDate) OR FORMAT(checkDate, 'yyyy-MM-dd') = @checkDate)`;
        }
        if (shift) {
            request.input('shift', sql.NVarChar(20), shift.trim());
            query += ` AND LTRIM(RTRIM(shift)) = @shift`;
        }

        query += ` ORDER BY machineNo ASC, checkDate DESC, id ASC`;

        const result = await request.query(query);
        const rows = result.recordset;

        if (rows.length === 0) {
            return res.status(200).json([]);
        }

        // Group rows into sections: a new section starts when machineNo changes, shift changes, or slNo === 1
        const sectionList = [];
        let current = null;
        let lastKey = null;

        rows.forEach((r) => {
            const rowKey = `${r.machineNo}_${r.shift}_${r.opNo || ''}`;
            if (!current || Number(r.slNo) === 1 || rowKey !== lastKey) {
                current = {
                    partTraceability: r.partTraceability || '',
                    toolDescription: r.toolDescription || '',
                    mcNo: r.machineNo || '',
                    opNo: r.opNo || '',
                    date: r.checkDate || '',
                    shift: r.shift || 'I',
                    from: r.fromTime || '',
                    to: r.toTime || '',
                    assignedQc: r.assignedQc || '',
                    toolChangedBy: { signature: r.toolChangedBySignature || '' },
                    verifiedByQc: { signature: r.verifiedByQcSignature || '' },
                    rows: []
                };
                sectionList.push(current);
                lastKey = rowKey;
            }

            current.rows.push({
                ...parseControlSpec(r.controlSpec),
                controlSpec: r.controlSpec || '',
                units: r.units || '',
                unitType: r.unitType || '',
                before: r.beforeValue || '',
                after: r.afterValue || ''
            });
        });

        const firstRow = rows[0];
        const structuredRecord = {
            id: firstRow.id,
            header: {
                machineShop: firstRow.machineShop,
                lineCode: firstRow.lineCode,
                partName: firstRow.partName,
                partNo: firstRow.partNo,
                machineNo: machineNo || firstRow.machineNo,
                opNo: firstRow.opNo,
                date: firstRow.checkDate,
            },
            sections: sectionList,
            status: rows.some(r => r.verifiedByQcSignature && r.verifiedByQcSignature !== '' && r.verifiedByQcSignature !== 'Pending') ? 'Completed' : 'Pending'
        };

        return res.status(200).json([structuredRecord]);
    } catch (err) {
        console.error('Error fetching records:', err);
        return res.status(500).json({ error: 'Failed to fetch Tool change records' });
    }
};

// ============================================================
// 7. GET: PDF Generator Endpoint (Attractive & High-Clarity)
// ============================================================
const generateReport = async (req, res) => {
    try {
        const { lineCode, date, shopId } = req.query;
        const machineNos = String(req.query.machineNos || req.query.machineNo || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);

        if (!lineCode || !date) {
            return res.status(400).send('lineCode and date are required.');
        }

        let cleanDate = String(date).split('T')[0];
        if (cleanDate.includes('/')) {
            const parts = cleanDate.split('/');
            cleanDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }

        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(100), lineCode);
        request.input('checkDate', sql.NVarChar(50), cleanDate);
        const machineParams = machineNos.map((machineNo, index) => {
            const paramName = `reportMachine${index}`;
            request.input(paramName, sql.NVarChar(100), machineNo);
            return `@${paramName}`;
        });

        let query = `
            SELECT
                id, machineShop, lineCode, partName, partNo, partTraceability, toolDescription,
                machineNo, opNo, FORMAT(checkDate, 'yyyy-MM-dd') AS checkDate,
                shift, CONVERT(VARCHAR(5), fromTime, 108) AS fromTime,
                CONVERT(VARCHAR(5), toTime, 108) AS toTime,
                slNo, controlSpec, units, unitType, beforeValue, afterValue,
                toolChangedBySignature, verifiedByQcSignature, assignedQc
            FROM ToolChangeRecord
            WHERE lineCode = @lineCode
              AND CONVERT(date, checkDate) = CONVERT(date, @checkDate)
        `;
        if (machineParams.length) {
            query += ` AND machineNo IN (${machineParams.join(', ')})`;
        }
        if (shopId && !isNaN(parseInt(shopId, 10))) {
            request.input('machineShop', sql.Int, parseInt(shopId, 10));
            query += ' AND machineShop = @machineShop';
        }
        query += ' ORDER BY id ASC';

        const result = await request.query(query);
        const records = result.recordset;
        if (records.length === 0) {
            return res.status(404).send('No records found for the selected line, date and machine(s).');
        }

        const qfHistory = await fetchQfHistory();
        const effectiveQf = getEffectiveQfValue(qfHistory, cleanDate);

        const sections = [];
        let current = null;
        for (const row of records) {
            if (!current || Number(row.slNo) === 1) {
                current = {
                    partTraceability: row.partTraceability || '',
                    toolDescription: row.toolDescription || '',
                    machineNo: row.machineNo || '',
                    opNo: row.opNo || '',
                    date: row.checkDate || cleanDate,
                    shift: row.shift || 'I',
                    from: row.fromTime || '',
                    to: row.toTime || '',
                    assignedQc: row.assignedQc || '',
                    toolChangedBy: row.toolChangedBySignature || '',
                    rows: [],
                };
                sections.push(current);
            }
            current.rows.push({
                controlSpec: row.controlSpec || '',
                units: row.units || '',
                unitType: row.unitType || '',
                before: row.beforeValue || '',
                after: row.afterValue || '',
                verifiedByQc: row.verifiedByQcSignature || '',
            });
        }

        const first = records[0];
        const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape', bufferPages: true, autoPageBreak: false });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=Tool_Change_Record.pdf');
        doc.pipe(res);

        const left = 20;
        const tableWidth = doc.page.width - 40;
        const pageBottom = doc.page.height - 24;
        const cellPad = 4;
        let y = 20;

        // Visual Theme Palette
        const COLORS = {
            headerDark: '#1e293b',       // Deep slate navy
            accentNavy: '#0f172a',
            subHeader: '#334155',
            sectionHeader: '#0284c7',    // Sky blue accent
            sectionBg: '#f0f9ff',        // Soft sky tint
            tableHeader: '#e2e8f0',      // Clean slate grey
            borderDark: '#334155',       // Crisp borders
            borderLight: '#cbd5e1',
            rowEven: '#ffffff',
            rowOdd: '#f8fafc',
            textDark: '#0f172a',
            textMuted: '#475569',
            badgeOk: '#16a34a',          // Emerald Green
            badgeWarn: '#dc2626',        // Crimson Red
            metaBg: '#f8fafc'
        };

        const drawCells = (values, ratios, top, options = {}) => {
            const fontSize = options.fontSize || 8;
            const widths = ratios.map((ratio) => ratio * tableWidth);
            let rowHeight = options.minHeight || 18;

            values.forEach((value, index) => {
                const bold = options.bold || (options.boldFirst && index === 0);
                doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
                const textHeight = doc.heightOfString(String(value ?? '-'), {
                    width: Math.max(1, widths[index] - cellPad * 2),
                    align: options.align || (index === 0 && options.labelLeft ? 'left' : 'center'),
                });
                rowHeight = Math.max(rowHeight, textHeight + cellPad * 2);
            });

            if (top + rowHeight > pageBottom) {
                doc.addPage();
                top = 20;
                drawPageHeading();
            }

            let x = left;
            values.forEach((value, index) => {
                const isFirstCol = index === 0;
                const bold = options.bold || (options.boldFirst && isFirstCol);
                const fillColor = options.fill || COLORS.rowEven;
                const borderColor = options.borderColor || COLORS.borderDark;

                doc.lineWidth(0.5);
                doc.rect(x, top, widths[index], rowHeight).fillAndStroke(fillColor, borderColor);

                // Text styling
                let textColor = options.textColor || COLORS.textDark;
                if (options.colorMap && options.colorMap[index]) {
                    textColor = options.colorMap[index];
                }

                doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
                   .fontSize(fontSize)
                   .fillColor(textColor);

                doc.text(String(value ?? '-'), x + cellPad, top + (rowHeight - (fontSize + 4)) / 2 + 1, {
                    width: Math.max(1, widths[index] - cellPad * 2),
                    align: options.align || (isFirstCol && options.labelLeft ? 'left' : 'center'),
                    valign: 'center',
                    lineBreak: true
                });
                x += widths[index];
            });

            return top + rowHeight;
        };

        const drawPageHeading = () => {
            // Main Top Header Bar
            doc.rect(left, y, tableWidth, 28).fillAndStroke(COLORS.headerDark, COLORS.headerDark);
            
            // Company Logo / Title
            const logoPath = path.join(__dirname, 'logo.jpg');
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, left + 6, y + 4, { fit: [90, 20], align: 'left', valign: 'center' });
            } else {
                doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff')
                   .text('SAKTHI AUTO', left + 8, y + 7, { align: 'left' });
            }

            doc.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff')
               .text('TOOL CHANGE RECORD', left, y + 7, { width: tableWidth, align: 'center' });

            y += 28;

            // Info Metadata Grid
            const metaHeights = 20;
            const metaCols = [0.22, 0.28, 0.28, 0.22];

            y = drawCells([
                `LINE CODE: ${lineCode}`,
                `PART NO: ${first.partNo || '-'}`,
                `PART NAME: ${first.partName || '-'}`,
                `DATE: ${cleanDate}`
            ], metaCols, y, {
                bold: true,
                fontSize: 8,
                minHeight: metaHeights,
                fill: COLORS.metaBg,
                borderColor: COLORS.borderDark,
                align: 'center'
            });
        };

        drawPageHeading();

        // 4 Columns for measurement data: CONTROL SPEC (wider), UNITS, BEFORE, AFTER
        const measurementWidths = [0.46, 0.18, 0.18, 0.18];

        sections.forEach((section, sectionIndex) => {
            const requiredH = 110 + (section.rows.length * 19);
            if (y + requiredH > pageBottom) {
                doc.addPage();
                y = 20;
                drawPageHeading();
            }

            // Section Pill Header
            y = drawCells([`MACHINE COLUMN ${sectionIndex + 1} — (M/C: ${section.machineNo || '-'}, OP: ${section.opNo || '-'})`], [1], y, {
                bold: true,
                fontSize: 8.5,
                minHeight: 20,
                fill: COLORS.sectionBg,
                textColor: COLORS.sectionHeader,
                borderColor: COLORS.sectionHeader,
                align: 'center'
            });

            // Metadata rows for this column
            const metaSplit = [0.22, 0.78];
            y = drawCells(['PART TRACEABILITY:', section.partTraceability || '-'], metaSplit, y, {
                boldFirst: true, labelLeft: true, fontSize: 8, minHeight: 18, fill: '#ffffff'
            });
            y = drawCells(['TOOL DESCRIPTION:', section.toolDescription || '-'], metaSplit, y, {
                boldFirst: true, labelLeft: true, fontSize: 8, minHeight: 18, fill: '#ffffff'
            });

            const subSplit = [0.25, 0.25, 0.25, 0.25];
            y = drawCells([
                `M/C NO:  ${section.machineNo || '-'}`,
                `OP NO:  ${section.opNo || '-'}`,
                `DATE:  ${section.date || cleanDate}`,
                `SHIFT:  ${section.shift || 'I'}`
            ], subSplit, y, { bold: true, fontSize: 8, minHeight: 18, fill: '#f8fafc' });

            y = drawCells([
                `FROM TIME:  ${section.from || '-'}`,
                `TO TIME:  ${section.to || '-'}`,
                '', ''
            ], subSplit, y, { boldFirst: true, fontSize: 8, minHeight: 18, fill: '#ffffff' });

            // Table Column Headers (Clean Slate Theme)
            y = drawCells(['CONTROL SPEC', 'UNITS', 'BEFORE', 'AFTER'], measurementWidths, y, {
                bold: true,
                fontSize: 7.5,
                minHeight: 20,
                fill: COLORS.tableHeader,
                textColor: COLORS.textDark,
                borderColor: COLORS.borderDark,
                align: 'center'
            });

            // Data Rows (Striped with Clear Formatting)
            section.rows.forEach((row, rIdx) => {
                const combinedControlSpec = row.unitType 
                    ? `[${row.unitType}]  ${row.controlSpec || '-'}` 
                    : (row.controlSpec || '-');

                const rowBg = rIdx % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd;

                y = drawCells([
                    combinedControlSpec,
                    row.units || '-',
                    row.before || '-',
                    row.after || '-'
                ], measurementWidths, y, {
                    fontSize: 7.5,
                    minHeight: 19,
                    fill: rowBg,
                    bold: false,
                    align: 'center',
                    borderColor: COLORS.borderLight
                });
            });

            // Signatures: TOOL CHANGED BY
            const tcApproved = Boolean(section.toolChangedBy && section.toolChangedBy.toLowerCase() !== 'pending');
            const tcSignatureText = tcApproved ? `Approved ✓ (${section.toolChangedBy})` : 'Pending Shift Incharge';
            const tcColor = tcApproved ? COLORS.badgeOk : COLORS.badgeWarn;

            y = drawCells(
                ['TOOL CHANGED BY:', tcSignatureText],
                [0.25, 0.75],
                y,
                {
                    bold: true,
                    labelLeft: true,
                    fontSize: 8,
                    minHeight: 20,
                    fill: '#f8fafc',
                    colorMap: { 1: tcColor }
                }
            );

            // Signatures: VERIFIED BY QC
            const allRowsQcApproved = section.rows.length > 0 && section.rows.every((row) => {
                const signature = String(row.verifiedByQc || '').trim();
                return signature !== '' && signature.toLowerCase() !== 'pending';
            });

            const qcApproved = allRowsQcApproved || (section.rows[0]?.verifiedByQc && section.rows[0].verifiedByQc !== 'Pending');
            const qcSignature = qcApproved 
                ? `Verified ✓ (${section.rows[0]?.verifiedByQc || 'QC'})` 
                : `Pending QC Review${section.assignedQc ? ` [Assigned: ${section.assignedQc}]` : ''}`;
            const qcColor = qcApproved ? COLORS.badgeOk : COLORS.badgeWarn;

            y = drawCells(
                ['VERIFIED BY QC:', qcSignature],
                [0.25, 0.75],
                y,
                {
                    bold: true,
                    labelLeft: true,
                    fontSize: 8,
                    minHeight: 20,
                    fill: '#ffffff',
                    colorMap: { 1: qcColor }
                }
            );

            // Spacing between columns if multiple on same page
            y += 4;
        });

        // Applicable Events Box
        if (y + 36 > pageBottom) {
            doc.addPage();
            y = 20;
            drawPageHeading();
        }

        y = drawCells(
            [
                'APPLICABLE EVENTS:',
                'New cutting tool (Tool holder, Drill, Reamer, Tap, Milling cutters, Milling inserts, Spot facing cutter etc.), Tool change after tool regrinding / tool repair.'
            ],
            [0.20, 0.80],
            y,
            {
                boldFirst: true,
                labelLeft: true,
                fontSize: 7.5,
                minHeight: 24,
                fill: '#f1f5f9',
                borderColor: COLORS.borderDark
            }
        );

        // QF Stamp on the footer
        doc.font('Helvetica-Bold')
           .fontSize(7.5)
           .fillColor(COLORS.textMuted)
           .text(effectiveQf, left, y + 6, { align: 'left' });

        doc.end();
    } catch (err) {
        console.error('PDF generation error:', err);
        if (!res.headersSent) {
            res.status(500).json({ message: 'PDF generation failed' });
        } else {
            res.end();
        }
    }
};

module.exports = {
    getIncharges,
    saveToolChangeRecord,
    getToolChangeRecords,
    getQcReports,
    signQcApproval,
    generateReport,
    getPartTraceability
};