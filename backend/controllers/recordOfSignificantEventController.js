const sql = require('../db');
const PDFDocument = require("pdfkit");
const fs = require('fs');
const path = require('path');

// POST: Save Record of Significant Event into single table
const saveSignificantEvent = async (req, res) => {
    const { header, traceability, rows, signatures } = req.body;

    if (!header) {
        return res.status(400).json({ error: 'Invalid payload: Header information is required' });
    }

    const transaction = new sql.Transaction();

    try {
        await transaction.begin();

        const rowsToInsert = (rows && rows.length > 0) ? rows : [{}];

        for (let rIdx = 0; rIdx < rowsToInsert.length; rIdx++) {
            const row = rowsToInsert[rIdx];

            await transaction.request()
                .input('machineShop', sql.Int, header.machineShop || 3) // Required by your DB Schema
                .input('month', sql.NVarChar, header.month || '')
                .input('partName', sql.NVarChar, header.partName || '')
                .input('lineCode', sql.NVarChar, header.lineCode || '') // Fixed from lineName
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
                .input('prodnIncharge', sql.NVarChar, signatures?.prodnIncharge ? `Pending [${signatures.prodnIncharge}]` : '')
                .input('qcIncharge', sql.NVarChar, signatures?.qcIncharge ? `Pending [${signatures.qcIncharge}]` : '')
                .input('prodnHofSign', sql.NVarChar, signatures?.prodnHofSign ? `Pending [${signatures.prodnHofSign}]` : '')
                .query(`
                    INSERT INTO SignificantEventRecord
                    (
                        machineShop, month, partName, lineCode, event, mcNo, opNo,
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
                        @machineShop, @month, @partName, @lineCode, @event, @mcNo, @opNo,
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
        res.status(201).json({ message: 'Record of significant event saved successfully' });
    } catch (err) {
        console.error('Error saving significant event record:', err);
        try { await transaction.rollback(); } catch (rollbackErr) { }
        res.status(500).json({ error: 'Failed to save significant event record' });
    }
};

// GET: Fetch Records by Date, Part Name, or Line Code
const getSignificantEventRecords = async (req, res) => {
    const { date, partName, lineCode } = req.query;

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
        if (lineCode) {
            request.input('lineCode', sql.NVarChar, `%${lineCode}%`);
            query += ` AND lineCode LIKE @lineCode`;
        }

        query += ` ORDER BY id DESC, rowIdx ASC`;
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch significant event records' });
    }
};

// 1. Fetch Users for Dropdowns
const getMachineShopUsers = async (req, res) => {
    try {
        const result = await sql.query`
            SELECT username, role 
            FROM dbo.MachineShopUsers 
            WHERE role IN ('productengineer', 'qc', 'hof')
            ORDER BY username ASC
        `;
        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

// 2. Fetch Pending Approvals
const getPendingSignificantEvents = async (req, res) => {
    try {
        const { role, username } = req.params;
        const pendingString = `Pending [${username.trim()}]`;
        const request = new sql.Request();
        request.input('pendingUser', sql.NVarChar(255), pendingString);

        let columnToFilter = '';
        if (role === 'pe') columnToFilter = 'prodnIncharge';
        else if (role === 'qc') columnToFilter = 'qcIncharge';
        else if (role === 'hof') columnToFilter = 'prodnHofSign';
        else return res.status(400).json({ error: 'Invalid role' });

        const query = `
            SELECT 
                partName, lineCode, event, CONVERT(varchar, recordDate, 23) as recordDate, shift
            FROM SignificantEventRecord
            WHERE ${columnToFilter} = @pendingUser
            GROUP BY partName, lineCode, event, recordDate, shift
            ORDER BY recordDate DESC
        `;
        
        const result = await request.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch pending reports' });
    }
};

// 3. Sign Approval
const signSignificantEvent = async (req, res) => {
    try {
        const { role, username, partName, lineCode, recordDate, event, shift } = req.body;
        const request = new sql.Request();
        
        request.input('partName', sql.NVarChar, partName);
        request.input('lineCode', sql.NVarChar, lineCode);
        request.input('recordDate', sql.Date, recordDate);
        request.input('event', sql.NVarChar, event);
        request.input('shift', sql.NVarChar, shift);
        request.input('approvedStr', sql.NVarChar(255), `Approved (${username})`);
        request.input('pendingStr', sql.NVarChar(255), `Pending [${username}]`);

        let columnToUpdate = '';
        if (role === 'pe') columnToUpdate = 'prodnIncharge';
        else if (role === 'qc') columnToUpdate = 'qcIncharge';
        else if (role === 'hof') columnToUpdate = 'prodnHofSign';

        const result = await request.query(`
            UPDATE SignificantEventRecord 
            SET ${columnToUpdate} = @approvedStr
            WHERE partName = @partName AND lineCode = @lineCode 
              AND recordDate = @recordDate AND event = @event AND shift = @shift
              AND ${columnToUpdate} = @pendingStr
        `);

        res.status(200).json({ success: true, message: 'Report signed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to sign report' });
    }
};

// 4. Generate PDF Report
const generateSignificantEventPDF = async (req, res) => {
    try {
        const { partName, lineCode, date, event, shift } = req.query; 
        const request = new sql.Request();
        request.input('partName', sql.NVarChar, partName)
               .input('lineCode', sql.NVarChar, lineCode)
               .input('recordDate', sql.Date, date) 
               .input('event', sql.NVarChar, event)
               .input('shift', sql.NVarChar, shift);

        const result = await request.query(`
            SELECT * FROM SignificantEventRecord 
            WHERE partName = @partName AND lineCode = @lineCode 
              AND recordDate = @recordDate AND event = @event AND shift = @shift
            ORDER BY rowIdx ASC
        `);

        if (result.recordset.length === 0) return res.status(404).json({ error: "No records found." });
        const records = result.recordset;
        const header = records[0];

        const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=SignificantEvent_${lineCode}.pdf`);
        doc.pipe(res);

        const startX = 20;
        let currentY = 20;
        const fullW = doc.page.width - 40;

        doc.lineWidth(1).strokeColor('black');

        // Header Title
        doc.rect(startX, currentY, 120, 40).stroke();
        
        // --- ADD LOGO HERE ---
        const logoPath = path.join(__dirname, 'logo.jpg');
        if (fs.existsSync(logoPath)) {
            // Fit the logo beautifully inside the 120x40 px box
            doc.image(logoPath, startX + 5, currentY + 5, { 
                fit: [110, 30], 
                align: 'center', 
                valign: 'center' 
            });
        } else {
            // Fallback text if logo.jpg is missing from the controllers folder
            doc.font("Helvetica-Bold").fontSize(12).text("SAKTHI AUTO", startX, currentY + 15, { width: 120, align: "center" });
        }

        doc.rect(startX + 120, currentY, fullW - 120, 40).stroke();
        doc.fillColor('black').fontSize(16).text("RECORD OF SIGNIFICANT EVENT (MACHINE SHOP)", startX + 120, currentY + 15, { width: fullW - 120, align: "center" });
        currentY += 40;

        // Header details
        const halfW = fullW / 2;
        const drawField = (label, val, x, w, y) => {
            doc.rect(x, y, w, 20).stroke();
            doc.font("Helvetica-Bold").fontSize(9).text(`${label}:`, x + 5, y + 6);
            // Increased offset from 60 to 105 so the signature doesn't overlap the label!
            doc.font("Helvetica").text(val || '', x + 105, y + 6); 
        };

        drawField("PART NAME", header.partName, startX, halfW, currentY);
        drawField("LINE NAME", header.lineCode, startX + halfW, halfW, currentY); // Displayed as LINE NAME, using lineCode
        currentY += 20;
        drawField("EVENT", header.event, startX, halfW, currentY);
        drawField("EVENT", header.event, startX + halfW, halfW, currentY);
        currentY += 20;
        
        doc.rect(startX, currentY, halfW, 20).stroke();
        doc.font("Helvetica-Bold").text(`M/C No : ${header.mcNo || ''}`, startX + 5, currentY + 6);
        doc.text(`OP No : ${header.opNo || ''}`, startX + 150, currentY + 6);
        doc.rect(startX + halfW, currentY, halfW, 20).stroke();
        doc.text(`M/C No : ${header.mcNo || ''}`, startX + halfW + 5, currentY + 6);
        currentY += 20;

        const dateStr = header.recordDate ? new Date(header.recordDate).toLocaleDateString('en-GB') : '';
        drawField("DATE", dateStr, startX, halfW, currentY);
        drawField("SHIFT", header.shift, startX + halfW, halfW, currentY);
        currentY += 20;
        drawField("FROM", header.fromTime, startX, halfW, currentY);
        drawField("TO", header.toTime, startX + halfW, halfW, currentY);
        currentY += 20;

        // Table Headers
        const c1 = 120, c2 = 120;
        const ptW = (fullW - c1 - c2) / 6; 
        const rowH = 20;

        doc.rect(startX, currentY, c1, rowH * 2).fillAndStroke('#e5e7eb', 'black');
        doc.fillColor('black').font("Helvetica-Bold").text("CONTROL SPEC", startX, currentY + 12, { width: c1, align: "center" });
        doc.rect(startX + c1, currentY, c2, rowH * 2).fillAndStroke('#e5e7eb', 'black');
        doc.fillColor('black').text("INSPECTION INST / GAUGE", startX + c1, currentY + 8, { width: c2, align: "center" });
        
        doc.rect(startX + c1 + c2, currentY, ptW * 3, rowH).fillAndStroke('#d1d5db', 'black');
        doc.fillColor('black').text("BEFORE OCCURANCE", startX + c1 + c2, currentY + 6, { width: ptW * 3, align: "center" });
        doc.rect(startX + c1 + c2 + (ptW * 3), currentY, ptW * 3, rowH).fillAndStroke('#d1d5db', 'black');
        doc.fillColor('black').text("AFTER CORRECTION", startX + c1 + c2 + (ptW * 3), currentY + 6, { width: ptW * 3, align: "center" });

        currentY += rowH;
        for (let i = 0; i < 6; i++) {
            doc.rect(startX + c1 + c2 + (i * ptW), currentY, ptW, rowH).fillAndStroke('#e5e7eb', 'black');
            doc.fillColor('black').text(`PART ${i % 3 + 1}`, startX + c1 + c2 + (i * ptW), currentY + 6, { width: ptW, align: "center" });
        }
        currentY += rowH;

        // Rows
        const drawRow = (col1, col2, b1, b2, b3, a1, a2, a3) => {
            doc.rect(startX, currentY, c1, rowH).stroke(); doc.font("Helvetica").text(col1 || '', startX + 2, currentY + 6);
            doc.rect(startX + c1, currentY, c2, rowH).stroke(); doc.text(col2 || '', startX + c1 + 2, currentY + 6);
            [b1, b2, b3, a1, a2, a3].forEach((val, idx) => {
                doc.rect(startX + c1 + c2 + (idx * ptW), currentY, ptW, rowH).stroke();
                doc.text(val || '', startX + c1 + c2 + (idx * ptW), currentY + 6, { width: ptW, align: "center" });
            });
            currentY += rowH;
        };

        drawRow("1) Part Traceability - Casting", "", header.castingBeforePart1, header.castingBeforePart2, header.castingBeforePart3, header.castingAfterPart1, header.castingAfterPart2, header.castingAfterPart3);
        drawRow("2) Part Traceability - Machining", "", header.machiningBeforePart1, header.machiningBeforePart2, header.machiningBeforePart3, header.machiningAfterPart1, header.machiningAfterPart2, header.machiningAfterPart3);

        records.forEach(r => {
            drawRow(r.controlSpec, r.inspectionGauge, r.beforePart1, r.beforePart2, r.beforePart3, r.afterPart1, r.afterPart2, r.afterPart3);
        });

        // Signatures
        currentY += 10;
        drawField("PRODN INCHARGE", header.prodnIncharge, startX, halfW, currentY);
        drawField("PRODN INCHARGE", header.prodnIncharge, startX + halfW, halfW, currentY);
        currentY += 20;
        drawField("QC INCHARGE", header.qcIncharge, startX, halfW, currentY);
        drawField("QC INCHARGE", header.qcIncharge, startX + halfW, halfW, currentY);
        currentY += 20;
        drawField("PRODN HOF SIGN", header.prodnHofSign, startX, halfW, currentY);
        drawField("PRODN HOF SIGN", header.prodnHofSign, startX + halfW, halfW, currentY);
        currentY += 20;

        doc.rect(startX, currentY, fullW, 20).stroke();
        doc.font("Helvetica-Bold").text("Applicable Events: Significant Machine Break Downs & Other unusual situation and applicable 4M change.", startX + 5, currentY + 6);

        doc.end();
    } catch (err) {
        console.error("PDF generation error:", err); // Added error logging so you can see exact issues next time!
        res.status(500).json({ error: "Failed to generate PDF" });
    }
};

module.exports = {
    saveSignificantEvent,
    getSignificantEventRecords,
    getMachineShopUsers,
    getPendingSignificantEvents,
    signSignificantEvent,
    generateSignificantEventPDF
};