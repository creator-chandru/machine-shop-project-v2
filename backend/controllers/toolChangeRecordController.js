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

        // Clear previous draft rows for this lineCode + date if re-submitting
        await transaction.request()
            .input('lineCode', sql.NVarChar(100), lineCode)
            .input('checkDate', sql.NVarChar(50), cleanDate)
            .input('machineShop', sql.Int, machineShop)
            .query(`
                DELETE FROM ToolChangeRecord 
                WHERE lineCode = @lineCode 
                  AND (CONVERT(date, checkDate) = CONVERT(date, @checkDate) OR FORMAT(checkDate, 'yyyy-MM-dd') = @checkDate)
                  AND machineShop = @machineShop 
                  AND (verifiedByQcSignature IS NULL OR verifiedByQcSignature = '' OR verifiedByQcSignature = 'Pending')
            `);
        // Sections already approved by QC stay in the DB untouched; don't re-insert them
        const verifiedRes = await transaction.request()
            .input('lineCode', sql.NVarChar(100), lineCode)
            .input('checkDate', sql.NVarChar(50), cleanDate)
            .input('machineShop', sql.Int, machineShop)
            .query(`
                SELECT DISTINCT
                    ISNULL(machineNo, '') AS machineNo,
                    ISNULL(shift, '') AS shift,
                    ISNULL(toolDescription, '') AS toolDescription
                FROM ToolChangeRecord
                WHERE lineCode = @lineCode
                  AND machineShop = @machineShop
                  AND CONVERT(date, checkDate) = CONVERT(date, @checkDate)
                  AND verifiedByQcSignature IS NOT NULL
                  AND verifiedByQcSignature <> ''
                  AND verifiedByQcSignature <> 'Pending'
            `);
        const verifiedKeys = new Set(
            verifiedRes.recordset.map((r) => `${r.machineNo}|${r.shift}|${r.toolDescription}`)
        );

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
            if (verifiedKeys.has(`${machineNo}|${shift}|${toolDescription}`)) {
                continue;
            }
            let partTraceability = sec.partTraceability || '';
            if (!partTraceability.trim()) {
                partTraceability = await generatePartTraceability(transaction, lineCode, checkDate, shift);
            }

            const toolChangedBySignature = (typeof sec.toolChangedBy === 'object' ? sec.toolChangedBy?.signature : sec.toolChangedBy) || 'Approved';
            const verifiedByQcSignature = (typeof sec.verifiedByQc === 'object' ? sec.verifiedByQc?.signature : sec.verifiedByQc) || '';
            const recordStatus = (verifiedByQcSignature && verifiedByQcSignature !== 'Pending') ? 'Completed' : (status || 'Pending');

            const rows = sec.rows && Array.isArray(sec.rows) && sec.rows.length > 0
                ? sec.rows
                : [{ controlSpec: '', before: '', after: '' }];

            for (let rIdx = 0; rIdx < rows.length; rIdx++) {
                const row = rows[rIdx];
                const controlSpec = row.controlSpec || (row.nominalValue && row.toleranceValue ? `${row.nominalValue} ${row.operatorSymbol || '±'} ${row.toleranceValue}` : row.nominalValue || '');
                const beforeValue = row.before || row.beforeValue || '';
                const afterValue = row.after || row.afterValue || '';

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
                            slNo, controlSpec, beforeValue, afterValue,
                            toolChangedBySignature, verifiedByQcSignature, assignedQc, status
                        )
                        VALUES (
                            @machineShop, @lineCode, @partName, @partNo, @partTraceability, @toolDescription,
                            @machineNo, @opNo, @checkDate, @shift, @fromTime, @toTime,
                            @slNo, @controlSpec, @beforeValue, @afterValue,
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
                MAX(machineNo) AS machineNo,
                FORMAT(checkDate, 'yyyy-MM-dd') AS reportDate,
                MAX(assignedQc) AS assignedQc,
                MAX(toolChangedBySignature) AS toolChangedBySignature,
                MAX(verifiedByQcSignature) AS verifiedByQcSignature,
                'Pending' AS status
            FROM ToolChangeRecord
            WHERE (verifiedByQcSignature IS NULL OR verifiedByQcSignature = '' OR verifiedByQcSignature = 'Pending')
              AND LOWER(LTRIM(RTRIM(assignedQc))) = LOWER(@qcName)
              ${shopFilter}
            GROUP BY machineShop, lineCode, checkDate
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
        const { lineCode, date, signature, qcUsername } = req.body;

        if (!lineCode || !date || !qcUsername) {
            return res.status(400).json({ message: 'Missing lineCode, date or qcUsername' });
        }

        const signVal = signature || qcUsername;
        let cleanDate = String(date).split('T')[0];
        if (cleanDate.includes('/')) {
            const p = cleanDate.split('/');
            cleanDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }

        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(100), lineCode);
        request.input('checkDate', sql.NVarChar(50), cleanDate);
        request.input('signature', sql.NVarChar(100), signVal);
        request.input('qcName', sql.NVarChar(100), String(qcUsername).trim());

        // Only rows assigned to this QC and still pending
        const result = await request.query(`
            UPDATE ToolChangeRecord 
            SET verifiedByQcSignature = @signature, status = 'Completed', updatedAt = GETDATE()
            WHERE lineCode = @lineCode 
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
// 6. GET: Fetch Records (Query by lineCode and date)
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
    const { machineShop, lineCode, partName, date, machineNo } = req.query;

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
            request.input('lineCode', sql.NVarChar(100), lineCode);
            query += ` AND lineCode = @lineCode`;
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
        if (machineNo) {
            request.input('machineNo', sql.NVarChar(100), machineNo);
            query += ` AND machineNo = @machineNo`;
        }

        query += ` ORDER BY checkDate DESC, id ASC`;

        const result = await request.query(query);
        const rows = result.recordset;

        if (rows.length === 0) {
            return res.status(200).json([]);
        }

        // A new section (column) starts every time slNo restarts at 1
        const sectionList = [];
        let current = null;
        rows.forEach((r) => {
            if (!current || Number(r.slNo) === 1) {
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
            }

            current.rows.push({
                ...parseControlSpec(r.controlSpec),
                controlSpec: r.controlSpec || '',
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
                machineNo: firstRow.machineNo,
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
// 7. GET: PDF Generator Endpoint
// ============================================================
const generateReport = async (req, res) => {
    try {
        const { lineCode, date, machineNo, shopId } = req.query;

        const request = new sql.Request();
        let query = `SELECT * FROM ToolChangeRecord WHERE 1=1`;

        if (lineCode) {
            request.input('lineCode', sql.NVarChar(100), lineCode);
            query += ` AND lineCode = @lineCode`;
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
        if (machineNo) {
            request.input('machineNo', sql.NVarChar(100), machineNo);
            query += ` AND machineNo = @machineNo`;
        }

        query += ` ORDER BY shift ASC, slNo ASC`;
        const result = await request.query(query);
        const records = result.recordset;

        if (records.length === 0) {
            return res.status(404).send("No records found for the selected parameters.");
        }

        const doc = new PDFDocument({ margin: 25, size: "A4", layout: "landscape", bufferPages: true, autoPageBreak: false });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline; filename=Tool_Change_Record.pdf");
        doc.pipe(res);

        const startX = 25;
        const headerY = 25;
        const totalWidth = doc.page.width - 50;

        doc.lineWidth(1);
        doc.rect(startX, headerY, 100, 35).stroke();
        doc.font("Helvetica-Bold").fontSize(12).fillColor('black').text("SAKTHI\nAUTO", startX, headerY + 8, { width: 100, align: "center" });

        doc.rect(startX + 100, headerY, totalWidth - 250, 35).stroke();
        doc.font("Helvetica-Bold").fontSize(13).text("TOOL CHANGE RECORD", startX + 100, headerY + 12, { width: totalWidth - 250, align: "center" });

        doc.rect(startX + totalWidth - 150, headerY, 150, 35).stroke();
        doc.font("Helvetica-Bold").fontSize(9).text(`Line: ${lineCode || records[0].lineCode}`, startX + totalWidth - 150, headerY + 6, { width: 150, align: "center" });
        doc.font("Helvetica").fontSize(8).text(`Date: ${records[0].checkDate ? new Date(records[0].checkDate).toLocaleDateString('en-GB') : '-'}`, startX + totalWidth - 150, headerY + 20, { width: 150, align: "center" });

        const sigY = doc.page.height - 70;
        doc.font("Helvetica-Bold").fontSize(9).fillColor('black');

        doc.text("Tool Changed By (Shift Incharge)", startX + 20, sigY);
        doc.rect(startX + 20, sigY + 12, 180, 30).stroke();

        const opSig = records[0].toolChangedBySignature;
        if (opSig === "Approved" || opSig === "APPROVED" || (opSig && !opSig.includes('Pending'))) {
            doc.lineWidth(1.5).strokeColor('#16a34a').moveTo(startX + 40, sigY + 28).lineTo(startX + 44, sigY + 33).lineTo(startX + 52, sigY + 21).stroke();
            doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(10).text(`APPROVED (${opSig})`, startX + 58, sigY + 23);
        } else {
            doc.fillColor('red').font('Helvetica').fontSize(9).text("Pending Approval", startX + 60, sigY + 23);
        }

        const qcX = startX + totalWidth - 220;
        doc.fillColor('black').font("Helvetica-Bold").fontSize(9).text("Verified By QC", qcX, sigY);
        doc.rect(qcX, sigY + 12, 180, 30).stroke();

        const qcSig = records[0].verifiedByQcSignature;
        const assignedQc = records[0].assignedQc || 'QC';
        if (qcSig === "Approved" || qcSig === "APPROVED" || (qcSig && !qcSig.includes('Pending'))) {
            doc.lineWidth(1.5).strokeColor('#16a34a').moveTo(qcX + 20, sigY + 28).lineTo(qcX + 24, sigY + 33).lineTo(qcX + 32, sigY + 21).stroke();
            doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(10).text(`APPROVED BY ${qcSig.toUpperCase()}`, qcX + 38, sigY + 23);
        } else {
            doc.fillColor('red').font('Helvetica-Bold').fontSize(9).text(`Pending [${assignedQc.toUpperCase()}]`, qcX + 40, sigY + 23);
        }

        doc.end();
    } catch (err) {
        console.error("PDF generation error:", err);
        res.status(500).json({ message: "PDF generation failed" });
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