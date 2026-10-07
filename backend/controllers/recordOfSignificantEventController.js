const sql = require('../db');
const PDFDocument = require("pdfkit");
const fs = require('fs');
const path = require('path');

// POST: Save Record of Significant Event
const saveSignificantEvent = async (req, res) => {
    const { header, traceability, rows, signatures } = req.body;

    if (!header || !header.lineCode || !header.mcNo || !header.date) {
        return res.status(400).json({ error: 'Line Code, M/C No, and Date are required' });
    }

    const transaction = new sql.Transaction();

    try {
        await transaction.begin();

        const cleanDate = String(header.date).split('T')[0];

        // Clear existing draft entries for this lineCode + mcNo + date combination
        const delReq = transaction.request();
        delReq.input('machineShop', sql.Int, header.machineShop || 3);
        delReq.input('lineCode', sql.NVarChar, header.lineCode || '');
        delReq.input('mcNo', sql.NVarChar, header.mcNo || '');
        delReq.input('recordDate', sql.Date, cleanDate);

        await delReq.query(`
            DELETE FROM SignificantEventRecord
            WHERE machineShop = @machineShop
              AND lineCode = @lineCode
              AND mcNo = @mcNo
              AND CONVERT(date, recordDate) = CONVERT(date, @recordDate)
        `);

        const rowsToInsert = (rows && rows.length > 0) ? rows : [{}];

        for (let rIdx = 0; rIdx < rowsToInsert.length; rIdx++) {
            const row = rowsToInsert[rIdx];

            await transaction.request()
                .input('machineShop', sql.Int, header.machineShop || 3)
                .input('month', sql.NVarChar, header.month || '')
                .input('partName', sql.NVarChar, header.partName || '')
                .input('lineCode', sql.NVarChar, header.lineCode || '')
                .input('event', sql.NVarChar, header.event || '')
                .input('mcNo', sql.NVarChar, header.mcNo || '')
                .input('opNo', sql.NVarChar, header.opNo || '')
                .input('recordDate', sql.Date, cleanDate)
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
        res.status(201).json({ message: 'Record of Significant Event saved successfully' });
    } catch (err) {
        console.error('Error saving significant event record:', err);
        try { await transaction.rollback(); } catch (rollbackErr) { }
        res.status(500).json({ error: 'Failed to save significant event record' });
    }
};

// GET: Fetch Records (Exact or partial match for lineCode + mcNo + date)
const getSignificantEventRecords = async (req, res) => {
    const { date, partName, lineCode, mcNo, shift } = req.query;

    try {
        let query = `SELECT * FROM SignificantEventRecord WHERE 1=1`;
        const request = new sql.Request();

        if (date) {
            const cleanDate = String(date).split('T')[0];
            request.input('date', sql.Date, cleanDate);
            query += ` AND CONVERT(date, recordDate) = CONVERT(date, @date)`;
        }
        if (partName) {
            request.input('partName', sql.NVarChar, `%${partName}%`);
            query += ` AND partName LIKE @partName`;
        }
        if (lineCode) {
            request.input('lineCode', sql.NVarChar, lineCode);
            query += ` AND lineCode = @lineCode`;
        }
        if (mcNo) {
            request.input('mcNo', sql.NVarChar, mcNo);
            query += ` AND mcNo = @mcNo`;
        }
        if (shift) {
            request.input('shift', sql.NVarChar, shift);
            query += ` AND shift = @shift`;
        }

        query += ` ORDER BY id ASC, rowIdx ASC`;
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Fetch error:', err);
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

        await request.query(`
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

// 4. Generate PDF Report (Properly aligned, auto-wrapping, no overlapping text)
const generateSignificantEventPDF = async (req, res) => {
    try {
        const { lineCode, mcNo, date, shift } = req.query;

        if (!lineCode || !date) {
            return res.status(400).send("lineCode and date are required.");
        }

        const cleanDate = String(date).split('T')[0];
        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar, lineCode);
        request.input('recordDate', sql.Date, cleanDate);

        let query = `
            SELECT * FROM SignificantEventRecord 
            WHERE lineCode = @lineCode 
              AND CONVERT(date, recordDate) = CONVERT(date, @recordDate)
        `;

        if (mcNo) {
            request.input('mcNo', sql.NVarChar, mcNo);
            query += ` AND mcNo = @mcNo`;
        }
        if (shift) {
            request.input('shift', sql.NVarChar, shift);
            query += ` AND shift = @shift`;
        }

        query += ` ORDER BY rowIdx ASC`;

        const result = await request.query(query);
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "No records found for the selected parameters." });
        }

        const records = result.recordset;
        const header = records[0];

        // Safe Date Formatter (DD/MM/YYYY)
        const formatDisplayDate = (rawDate) => {
            if (!rawDate) return '-';
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                return `${day}/${month}/${year}`;
            }
            const parts = String(rawDate).split('T')[0].split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return String(rawDate);
        };

        const displayDate = formatDisplayDate(header.recordDate || cleanDate);

        const doc = new PDFDocument({ 
            margin: 25, 
            size: "A4", 
            layout: "landscape", 
            bufferPages: true, 
            autoPageBreak: false 
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=SignificantEvent_${lineCode}_${header.mcNo || ''}.pdf`);
        doc.pipe(res);

        const startX = 25;
        let currentY = 25;
        const totalWidth = doc.page.width - 50;

        // ============================================================
        // 1. TOP TITLE BLOCK
        // ============================================================
        const topHeaderH = 42;
        doc.lineWidth(1).strokeColor('black');

        // Logo Box
        doc.rect(startX, currentY, 110, topHeaderH).stroke();
        const logoPath = path.join(__dirname, 'logo.jpg');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, startX + 5, currentY + 5, { fit: [100, 32], align: 'center', valign: 'center' });
        } else {
            doc.font("Helvetica-Bold").fontSize(11).fillColor('black').text("SAKTHI AUTO", startX, currentY + 15, { width: 110, align: "center" });
        }

        // Title Box
        const titleW = totalWidth - 110 - 150;
        doc.rect(startX + 110, currentY, titleW, topHeaderH).stroke();
        doc.fillColor('black').font("Helvetica-Bold").fontSize(13).text("RECORD OF SIGNIFICANT EVENT (MACHINE SHOP)", startX + 110, currentY + 14, { width: titleW, align: "center" });

        // Meta Info Box (Doc code, Shift, Date)
        doc.rect(startX + totalWidth - 150, currentY, 150, topHeaderH).stroke();
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor('black').text("DOC: QF/07/MPD-02 | REV: 07", startX + totalWidth - 150, currentY + 6, { width: 150, align: "center" });
        doc.font("Helvetica").fontSize(7.5).text(`LINE: ${lineCode} | SHIFT: ${header.shift || 'I'}`, startX + totalWidth - 150, currentY + 18, { width: 150, align: "center" });
        doc.text(`DATE: ${displayDate}`, startX + totalWidth - 150, currentY + 29, { width: 150, align: "center" });

        currentY += topHeaderH;

        // ============================================================
        // 2. HEADER DETAILS GRID
        // ============================================================
        doc.lineWidth(0.5);

        // Row 1: Line Code (35%) & Part Name (65%) with adaptive height for multiline part names
        const partNameText = header.partName ? String(header.partName).trim() : "-";
        const partNameW = (totalWidth * 0.65) - 95;
        doc.font("Helvetica").fontSize(7.5);
        const partNameH = doc.heightOfString(partNameText, { width: partNameW });
        const row1H = Math.max(22, partNameH + 8);

        // LINE CODE cell
        doc.rect(startX, currentY, totalWidth * 0.35, row1H).stroke();
        doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text("LINE CODE:", startX + 6, currentY + (row1H / 2) - 4);
        doc.font("Helvetica").fontSize(8).text(header.lineCode || '-', startX + 75, currentY + (row1H / 2) - 4);

        // PART NAME cell
        doc.rect(startX + (totalWidth * 0.35), currentY, totalWidth * 0.65, row1H).stroke();
        doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text("PART NAME:", startX + (totalWidth * 0.35) + 6, currentY + 5);
        doc.font("Helvetica").fontSize(7.5).text(partNameText, startX + (totalWidth * 0.35) + 85, currentY + 5, { width: partNameW });

        currentY += row1H;

        // Row 2: Event (Full width)
        const eventText = header.event ? String(header.event).trim() : "-";
        doc.font("Helvetica").fontSize(8);
        const eventTextH = doc.heightOfString(eventText, { width: totalWidth - 85 });
        const row2H = Math.max(20, eventTextH + 8);

        doc.rect(startX, currentY, totalWidth, row2H).stroke();
        doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text("EVENT:", startX + 6, currentY + 5);
        doc.font("Helvetica").fontSize(8).text(eventText, startX + 75, currentY + 5, { width: totalWidth - 85 });

        currentY += row2H;

        // Helper for two-column 20px rows
        const halfW = totalWidth / 2;
        const draw2ColRow = (l1, v1, l2, v2) => {
            const h = 20;
            doc.rect(startX, currentY, halfW, h).stroke();
            doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text(`${l1}:`, startX + 6, currentY + 5);
            doc.font("Helvetica").fontSize(8).text(v1 ? String(v1) : '-', startX + 75, currentY + 5);

            doc.rect(startX + halfW, currentY, halfW, h).stroke();
            doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text(`${l2}:`, startX + halfW + 6, currentY + 5);
            doc.font("Helvetica").fontSize(8).text(v2 ? String(v2) : '-', startX + halfW + 75, currentY + 5);
            currentY += h;
        };

        // Row 3: M/C No & OP No
        draw2ColRow("M/C NO", header.mcNo, "OP NO", header.opNo);

        // Row 4: Time From & Time To
        draw2ColRow("TIME FROM", header.fromTime, "TIME TO", header.toTime);

        currentY += 6; // Spacing before table

        // ============================================================
        // 3. MEASUREMENTS & SPECIFICATIONS TABLE
        // ============================================================
        const c1 = 145; // Control Spec
        const c2 = 135; // Inspection Gauge
        const ptW = (totalWidth - c1 - c2) / 6; // ~85px each for Part 1-3
        const headerRowH = 18;

        // Header Row 1
        doc.rect(startX, currentY, c1, headerRowH * 2).fillAndStroke('#e5e7eb', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("CONTROL SPEC", startX, currentY + 12, { width: c1, align: "center" });

        doc.rect(startX + c1, currentY, c2, headerRowH * 2).fillAndStroke('#e5e7eb', 'black');
        doc.fillColor('black').text("INSPECTION GAUGE", startX + c1, currentY + 12, { width: c2, align: "center" });

        doc.rect(startX + c1 + c2, currentY, ptW * 3, headerRowH).fillAndStroke('#d1d5db', 'black');
        doc.fillColor('black').text("BEFORE OCCURRENCE", startX + c1 + c2, currentY + 5, { width: ptW * 3, align: "center" });

        doc.rect(startX + c1 + c2 + (ptW * 3), currentY, ptW * 3, headerRowH).fillAndStroke('#d1d5db', 'black');
        doc.fillColor('black').text("AFTER CORRECTION", startX + c1 + c2 + (ptW * 3), currentY + 5, { width: ptW * 3, align: "center" });

        currentY += headerRowH;

        // Header Row 2 (Part 1, 2, 3)
        for (let i = 0; i < 6; i++) {
            const xPos = startX + c1 + c2 + (i * ptW);
            doc.rect(xPos, currentY, ptW, headerRowH).fillAndStroke('#e5e7eb', 'black');
            doc.fillColor('black').fontSize(7.5).text(`PART ${(i % 3) + 1}`, xPos, currentY + 5, { width: ptW, align: "center" });
        }
        currentY += headerRowH;

        // Row renderer
        const drawTableRow = (title, gauge, b1, b2, b3, a1, a2, a3, isBoldTitle = false) => {
            const rowH = 19;
            const vals = [b1, b2, b3, a1, a2, a3];

            // Col 1: Title / Spec
            doc.rect(startX, currentY, c1, rowH).stroke();
            doc.fillColor('black').font(isBoldTitle ? "Helvetica-Bold" : "Helvetica").fontSize(7.5)
               .text(title || '-', startX + 5, currentY + 5, { width: c1 - 10, align: 'left', ellipsis: true });

            // Col 2: Gauge
            doc.rect(startX + c1, currentY, c2, rowH).stroke();
            doc.font("Helvetica").fontSize(7.5)
               .text(gauge || '-', startX + c1 + 5, currentY + 5, { width: c2 - 10, align: 'center', ellipsis: true });

            // Cols 3-8: Before & After measurements
            vals.forEach((v, idx) => {
                const xPos = startX + c1 + c2 + (idx * ptW);
                doc.rect(xPos, currentY, ptW, rowH).stroke();
                doc.font("Helvetica").fontSize(7.5)
                   .text(v ? String(v) : '-', xPos, currentY + 5, { width: ptW, align: 'center' });
            });

            currentY += rowH;
        };

        // 1) Part Traceability - Casting
        drawTableRow(
            "1) Part Traceability - Casting", "-",
            header.castingBeforePart1, header.castingBeforePart2, header.castingBeforePart3,
            header.castingAfterPart1, header.castingAfterPart2, header.castingAfterPart3,
            true
        );

        // 2) Part Traceability - Machining
        drawTableRow(
            "2) Part Traceability - Machining", "-",
            header.machiningBeforePart1, header.machiningBeforePart2, header.machiningBeforePart3,
            header.machiningAfterPart1, header.machiningAfterPart2, header.machiningAfterPart3,
            true
        );

        // Dynamic Inspection Custom Rows
        records.forEach((r) => {
            drawTableRow(
                r.controlSpec, r.inspectionGauge,
                r.beforePart1, r.beforePart2, r.beforePart3,
                r.afterPart1, r.afterPart2, r.afterPart3,
                false
            );
        });

        currentY += 8;

        // ============================================================
        // 4. SIGNATURES BLOCK
        // ============================================================
        const sigWidth = totalWidth / 3;
        const sigHeaderH = 18;
        const sigBoxH = 34;

        const drawSigBox = (title, sigVal, x) => {
            // Header
            doc.rect(x, currentY, sigWidth, sigHeaderH).fillAndStroke('#e5e7eb', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text(title, x, currentY + 5, { width: sigWidth, align: 'center' });

            // Content
            doc.rect(x, currentY + sigHeaderH, sigWidth, sigBoxH).stroke();
            const textY = currentY + sigHeaderH + 11;

            if (sigVal && sigVal.includes('Approved')) {
                doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(8.5).text(sigVal, x, textY, { width: sigWidth, align: 'center' });
            } else if (sigVal && sigVal.includes('Pending')) {
                doc.fillColor('red').font('Helvetica').fontSize(8.5).text(sigVal, x, textY, { width: sigWidth, align: 'center' });
            } else if (sigVal) {
                doc.fillColor('black').font('Helvetica-Bold').fontSize(8.5).text(sigVal, x, textY, { width: sigWidth, align: 'center' });
            } else {
                doc.fillColor('gray').font('Helvetica').fontSize(8.5).text("Pending", x, textY, { width: sigWidth, align: 'center' });
            }
        };

        drawSigBox("PRODN INCHARGE", header.prodnIncharge, startX);
        drawSigBox("QC INCHARGE", header.qcIncharge, startX + sigWidth);
        drawSigBox("PRODN HOF SIGN", header.prodnHofSign, startX + (sigWidth * 2));

        currentY += sigHeaderH + sigBoxH + 6;

        // ============================================================
        // 5. APPLICABLE EVENTS FOOTER
        // ============================================================
        doc.rect(startX, currentY, totalWidth, 18).stroke();
        doc.fillColor('black').font("Helvetica-Bold").fontSize(7.5).text("Applicable Events:", startX + 6, currentY + 5);
        doc.font("Helvetica").fontSize(7.5).text("Significant Machine Break Downs & Other unusual situation and applicable 4M change.", startX + 85, currentY + 5);

        doc.end();
    } catch (err) {
        console.error("PDF generation error:", err);
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to generate PDF" });
        } else {
            res.end();
        }
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