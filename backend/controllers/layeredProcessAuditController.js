const sql = require('../db');
const PDFDocument = require("pdfkit");
const fs = require('fs');
const path = require('path');

// Helper to format Date objects or ISO strings cleanly to DD/MM/YYYY
const formatDateDisplay = (dateVal) => {
    if (!dateVal) return '';
    if (dateVal instanceof Date) {
        const dd = String(dateVal.getDate()).padStart(2, '0');
        const mm = String(dateVal.getMonth() + 1).padStart(2, '0');
        const yyyy = dateVal.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }
    const str = String(dateVal).split('T')[0].trim();
    const parts = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (parts) {
        return `${parts[3]}/${parts[2]}/${parts[1]}`;
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }
    return str;
};

// Helper to extract clean YYYY-MM-DD for grouping
const getDateISO = (dateVal) => {
    if (!dateVal) return '';
    if (dateVal instanceof Date) {
        const dd = String(dateVal.getDate()).padStart(2, '0');
        const mm = String(dateVal.getMonth() + 1).padStart(2, '0');
        const yyyy = dateVal.getFullYear();
        return `${yyyy}-${mm}-${dd}`;
    }
    const str = String(dateVal).split('T')[0].trim();
    const parts = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (parts) return parts[0];
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${yyyy}-${mm}-${dd}`;
    }
    return str;
};

// Helper to resolve dynamic QF value based on record date
const fetchQfHistory = async () => {
    try {
        const res = await sql.query(`
            SELECT id, formName, qfValue, date 
            FROM LPAQFvalues 
            ORDER BY date DESC, id DESC
        `);
        return res.recordset || [];
    } catch (e) {
        console.error("Warning: Could not fetch LPAQFvalues:", e.message);
        return [];
    }
};

const getEffectiveQfValue = (qfHistory, recordDateStr) => {
    const fallback = "QF/08/MRO - 18, Rev No: 02 dt 01.01.2022";
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
// 1. GET HOF USERS FOR DROPDOWN
// ============================================================
const getHOFUsers = async (req, res) => {
    try {
        const hofRes = await sql.query`
            SELECT username AS name, username, employeeId 
            FROM dbo.MachineShopUsers 
            WHERE role IN ('hof', 'headofproduction', 'admin')
            ORDER BY username ASC
        `;
        const list = hofRes.recordset.length > 0 ? hofRes.recordset : [];
        return res.status(200).json({ hofList: list });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch HOF list' });
    }
};

// ============================================================
// 2. SAVE LAYERED PROCESS AUDIT BOTTOM LEVEL
// ============================================================
const saveLPABottomLevel = async (req, res) => {
    const { header, checks, supervisorSignature, hofSignature } = req.body;
    const checkList = checks || [];

    if (!header || !header.lineCode || !header.date) {
        return res.status(400).json({ error: 'Header data with Line Code and Date is required' });
    }

    let transaction;
    try {
        transaction = new sql.Transaction();
        await transaction.begin();

        const checkDate = header.date;

        let formattedHofSign = hofSignature || '';
        if (formattedHofSign && !formattedHofSign.startsWith('Pending [') && !formattedHofSign.startsWith('Approved (')) {
            formattedHofSign = `Pending [${formattedHofSign}]`;
        }

        for (const item of checkList) {
            const status = item.status || '';
            const remarks = item.remarks || '';
            const checkPointText = item.checkPoint || item.text || '';

            // Check if record already exists for this shop, line, date and sNo
            const existingRequest = new sql.Request(transaction);
            existingRequest.input('machineShop', sql.Int, parseInt(header.machineShop))
                .input('lineCode', sql.NVarChar(50), header.lineCode)
                .input('checkDate', sql.Date, checkDate)
                .input('sNo', sql.Int, item.sNo);

            const existingResult = await existingRequest.query(`
                SELECT COUNT(*) AS count 
                FROM LayeredProcessAuditBottomLevel
                WHERE machineShop = @machineShop 
                  AND lineCode = @lineCode 
                  AND checkDate = @checkDate 
                  AND sNo = @sNo
            `);

            const alreadyExists = existingResult.recordset[0].count > 0;
            const request = new sql.Request(transaction);

            request.input('machineShop', sql.Int, parseInt(header.machineShop))
                .input('lineCode', sql.NVarChar(50), header.lineCode)
                .input('partName', sql.NVarChar(200), header.partName || '')
                .input('partNo', sql.NVarChar(100), header.partNo || '')
                .input('checkDate', sql.Date, checkDate)
                .input('sNo', sql.Int, item.sNo)
                .input('checkPoint', sql.NVarChar(500), checkPointText)
                .input('status', sql.NVarChar(10), status)
                .input('remarks', sql.NVarChar(500), remarks)
                .input('supervisorSignature', sql.NVarChar(255), supervisorSignature || '')
                .input('hofSignature', sql.NVarChar(255), formattedHofSign);

            if (alreadyExists) {
                await request.query(`
                    UPDATE LayeredProcessAuditBottomLevel
                    SET [checkPoint] = CASE WHEN @checkPoint <> '' THEN @checkPoint ELSE [checkPoint] END,
                        status = CASE WHEN @status <> '' THEN @status ELSE status END,
                        remarks = CASE WHEN @remarks <> '' THEN @remarks ELSE remarks END,
                        supervisorSignature = CASE WHEN @supervisorSignature <> '' THEN @supervisorSignature ELSE supervisorSignature END,
                        hofSignature = CASE WHEN @hofSignature <> '' THEN @hofSignature ELSE hofSignature END
                    WHERE machineShop = @machineShop 
                      AND lineCode = @lineCode 
                      AND checkDate = @checkDate 
                      AND sNo = @sNo
                `);
            } else {
                await request.query(`
                    INSERT INTO LayeredProcessAuditBottomLevel
                    (machineShop, lineCode, partName, partNo, checkDate, sNo, [checkPoint], status, remarks, supervisorSignature, hofSignature)
                    VALUES
                    (@machineShop, @lineCode, @partName, @partNo, @checkDate, @sNo, @checkPoint, @status, @remarks, @supervisorSignature, @hofSignature)
                `);
            }
        }

        await transaction.commit();
        return res.status(201).json({ message: 'Layered Process Audit Check Sheet saved successfully' });
    } catch (err) {
        if (transaction) try { await transaction.rollback(); } catch (e) { }
        console.error("Save LPA error:", err);
        return res.status(500).json({ error: 'Failed to save Layered Process Audit Check Sheet' });
    }
};

// ============================================================
// 3. GET PENDING FOR HOF
// ============================================================
const getPendingHOFLPAData = async (req, res) => {
    try {
        const { name } = req.params;
        const shopId = parseInt(req.query.shopId, 10);

        const request = new sql.Request();
        const pendingString = `Pending [${String(name || '').trim()}]`;
        request.input('hofName', sql.NVarChar(255), pendingString);

        let shopFilter = '';
        if (!isNaN(shopId)) {
            request.input('machineShop', sql.Int, shopId);
            shopFilter = ' AND machineShop = @machineShop';
        }

        const result = await request.query(`
            SELECT 
                machineShop, lineCode, MAX(partName) AS partName, MAX(partNo) AS partNo,
                FORMAT(checkDate, 'yyyy-MM-dd') AS reportDate,
                MAX(supervisorSignature) AS supervisorSignature,
                MAX(hofSignature) AS hofSignature
            FROM LayeredProcessAuditBottomLevel
            WHERE hofSignature = @hofName
              ${shopFilter}
            GROUP BY machineShop, lineCode, checkDate
            ORDER BY checkDate DESC
        `);
        return res.status(200).json(result.recordset);
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch pending HOF data' });
    }
};

// ============================================================
// 4. POST: HOF SIGN AND APPROVE
// ============================================================
const signHOFApproval = async (req, res) => {
    try {
        const { lineCode, date, signature } = req.body;
        if (!lineCode || !date || !signature) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        let cleanDate = String(date).split('T')[0];

        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(50), lineCode)
            .input('checkDate', sql.NVarChar(50), cleanDate)
            .input('approvedStr', sql.NVarChar(255), `Approved (${signature})`)
            .input('pendingStr', sql.NVarChar(255), `Pending [${signature}]`);

        const result = await request.query(`
            UPDATE LayeredProcessAuditBottomLevel 
            SET hofSignature = @approvedStr
            WHERE lineCode = @lineCode 
              AND CONVERT(date, checkDate) = CONVERT(date, @checkDate)
              AND hofSignature = @pendingStr
        `);

        if (!result.rowsAffected[0]) {
            return res.status(404).json({ error: 'No pending records found for your assignment' });
        }
        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to sign check sheet' });
    }
};

// ============================================================
// 5. GET SAVED LPA BOTTOM LEVEL DATA
// ============================================================
const getLPABottomLevel = async (req, res) => {
    const { machineShop, lineCode, date } = req.query;
    try {
        let query = `SELECT id, machineShop, lineCode, partName, partNo, checkDate, sNo, [checkPoint], status, remarks, supervisorSignature, hofSignature FROM LayeredProcessAuditBottomLevel WHERE 1 = 1`;
        const request = new sql.Request();

        if (machineShop) {
            query += ` AND machineShop = @machineShop`;
            request.input('machineShop', sql.Int, parseInt(machineShop));
        }
        if (lineCode) {
            query += ` AND lineCode = @lineCode`;
            request.input('lineCode', sql.NVarChar(50), lineCode);
        }
        if (date) {
            query += ` AND checkDate = @checkDate`;
            request.input('checkDate', sql.Date, date);
        }
        query += ` ORDER BY sNo ASC`;

        const result = await request.query(query);
        return res.status(200).json(result.recordset);
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch LPA data' });
    }
};

// ============================================================
// 6. PDF GENERATION - RANGE
// ============================================================
const generateLPAReport = async (req, res) => {
    try {
        const { fromDate, toDate, shopId } = req.query;

        if (!fromDate || !toDate) {
            return res.status(400).json({ error: "fromDate and toDate are required" });
        }

        const cleanFromDate = String(fromDate).split('T')[0];
        const cleanToDate = String(toDate).split('T')[0];
        const targetShopId = parseInt(shopId || 3, 10);

        const request = new sql.Request();
        request.input('fromDate', sql.Date, cleanFromDate);
        request.input('toDate', sql.Date, cleanToDate);
        request.input('machineShop', sql.Int, targetShopId);

        const query = `
            SELECT 
                a.id, a.machineShop, a.lineCode, a.partName, a.partNo, a.checkDate, a.sNo, a.[checkPoint], a.status, a.remarks, a.supervisorSignature, a.hofSignature,
                FORMAT(a.checkDate, 'yyyy-MM-dd') AS formattedDate,
                FORMAT(a.checkDate, 'dd/MM/yyyy') AS displayDateStr
            FROM LayeredProcessAuditBottomLevel a
            WHERE a.machineShop = @machineShop 
              AND CONVERT(date, a.checkDate) >= @fromDate 
              AND CONVERT(date, a.checkDate) <= @toDate
            ORDER BY a.checkDate ASC, a.lineCode ASC, a.sNo ASC
        `;

        const result = await request.query(query);
        const records = result.recordset;

        if (!records || records.length === 0) {
            return res.status(404).json({ error: "No records found for the selected date range." });
        }

        const qfHistory = await fetchQfHistory();

        // Group by lineCode + date
        const groupedMap = new Map();
        records.forEach(r => {
            const dateStr = r.formattedDate || getDateISO(r.checkDate);
            const groupKey = `${r.lineCode}_${dateStr}`;
            if (!groupedMap.has(groupKey)) {
                groupedMap.set(groupKey, []);
            }
            groupedMap.get(groupKey).push(r);
        });

        const groups = Array.from(groupedMap.values());

        const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true, autoPageBreak: false });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=LPA_Bottom_Report_${cleanFromDate}_to_${cleanToDate}.pdf`);
        doc.pipe(res);

        const startX = 20;
        const totalWidth = doc.page.width - 40;
        const pageBottom = doc.page.height - 20;
        const topMargin = 20;

        const wSno = 40;
        const wStatus = 120;
        const wCheckPoint = totalWidth - wSno - wStatus;

        const drawCheckMark = (centerX, centerY, size = 10) => {
            doc.save()
               .lineWidth(1.5)
               .strokeColor('#16a34a')
               .moveTo(centerX - size * 0.45, centerY)
               .lineTo(centerX - size * 0.1, centerY + size * 0.4)
               .lineTo(centerX + size * 0.45, centerY - size * 0.35)
               .stroke()
               .restore();
        };

        const drawCrossMark = (centerX, centerY, size = 9) => {
            const half = size / 2;
            doc.save()
               .lineWidth(1.5)
               .strokeColor('#dc2626')
               .moveTo(centerX - half, centerY - half)
               .lineTo(centerX + half, centerY + half)
               .moveTo(centerX + half, centerY - half)
               .lineTo(centerX - half, centerY + half)
               .stroke()
               .restore();
        };

        const computeEntryHeight = (itemCount) => {
            const headerH = 65;
            const tableHeaderH = 24;
            const rowsH = itemCount * 22;
            const signH = 26 * 2;
            const notesH = 50;
            const qfH = 20;
            return headerH + 6 + tableHeaderH + rowsH + signH + 6 + notesH + qfH + 10;
        };

        const drawEntry = (groupRecords, entryY) => {
            const first = groupRecords[0];
            const displayDate = first.displayDateStr || formatDateDisplay(first.checkDate);
            const effectiveQf = getEffectiveQfValue(qfHistory, first.checkDate);

            // 1. Header Box
            const headerH = 65;
            const metaBoxWidth = 290;
            const logoBoxWidth = 130;
            const titleBoxWidth = totalWidth - logoBoxWidth - metaBoxWidth;

            doc.lineWidth(0.6).strokeColor('black');

            // Logo
            doc.rect(startX, entryY, logoBoxWidth, headerH).stroke();
            const logoPath = path.join(__dirname, 'logo.jpg');
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, startX + 10, entryY + 12, { width: 110, height: 38, fit: [110, 38], align: 'center', valign: 'center' });
            } else {
                doc.font("Helvetica-Bold").fontSize(12).fillColor('black').text("SAKTHI AUTO", startX, entryY + 25, { width: logoBoxWidth, align: "center" });
            }

            // Title Box
            doc.rect(startX + logoBoxWidth, entryY, titleBoxWidth, headerH).stroke();
            doc.font("Helvetica-Bold").fontSize(13).fillColor('black').text("LAYERED PROCESS AUDIT - BOTTOM LEVEL", startX + logoBoxWidth, entryY + 26, { width: titleBoxWidth, align: "center" });

            // Metadata Box
            const metaX = startX + logoBoxWidth + titleBoxWidth;
            doc.rect(metaX, entryY, metaBoxWidth, headerH).stroke();
            doc.moveTo(metaX, entryY + 16).lineTo(metaX + metaBoxWidth, entryY + 16).stroke();
            doc.moveTo(metaX, entryY + 36).lineTo(metaX + metaBoxWidth, entryY + 36).stroke();
            doc.moveTo(metaX, entryY + 50).lineTo(metaX + metaBoxWidth, entryY + 50).stroke();

            doc.font("Helvetica-Bold").fontSize(8.5).fillColor('black');
            doc.text("PROCESS / LINE", metaX + 5, entryY + 4); doc.text(`:   ${first.lineCode || ''}`, metaX + 90, entryY + 4);
            doc.text("PART NAME", metaX + 5, entryY + 20);
            doc.font("Helvetica").fontSize(7.5).text(`:   ${first.partName || ''}`, metaX + 90, entryY + 19, { width: metaBoxWidth - 95, height: 16, ellipsis: true });

            doc.font("Helvetica-Bold").fontSize(8.5);
            doc.text("PART NO", metaX + 5, entryY + 38); doc.text(`:   ${first.partNo || ''}`, metaX + 90, entryY + 38);
            doc.text("DATE", metaX + 5, entryY + 52); doc.text(`:   ${displayDate}`, metaX + 90, entryY + 52);

            let currY = entryY + headerH + 4;

            // 2. Table Headers
            const thH = 22;
            doc.rect(startX, currY, wSno, thH).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("S.No", startX, currY + 6, { width: wSno, align: "center" });

            doc.rect(startX + wSno, currY, wCheckPoint, thH).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("Check Points", startX + wSno + 10, currY + 6, { width: wCheckPoint - 20, align: "left" });

            doc.rect(startX + wSno + wCheckPoint, currY, wStatus, thH).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("Status", startX + wSno + wCheckPoint, currY + 6, { width: wStatus, align: "center" });

            currY += thH;

            // 3. Table Rows
            const rowH = 22;
            doc.font("Helvetica").fontSize(7.5);

            groupRecords.forEach(item => {
                doc.rect(startX, currY, wSno, rowH).stroke();
                doc.font("Helvetica-Bold").fontSize(8).text(String(item.sNo), startX, currY + 6, { width: wSno, align: "center" });

                doc.rect(startX + wSno, currY, wCheckPoint, rowH).stroke();
                doc.font("Helvetica").fontSize(7.5).text(item.checkPoint, startX + wSno + 8, currY + 6, { width: wCheckPoint - 16, align: "left" });

                doc.rect(startX + wSno + wCheckPoint, currY, wStatus, rowH).stroke();
                const val = (item.status || '').trim();
                const cX = startX + wSno + wCheckPoint;
                const centerX = cX + (wStatus / 2);
                const centerY = currY + (rowH / 2);

                if (val === '✓' || val.toLowerCase() === 'ok') {
                    drawCheckMark(centerX, centerY, 10);
                } else if (val === 'X' || val === 'x' || val.toLowerCase() === 'notok') {
                    drawCrossMark(centerX, centerY, 9);
                } else if (val) {
                    doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text(val, cX, currY + 6, { width: wStatus, align: "center" });
                }

                currY += rowH;
            });

            // 4. Supervisor Sign Row
            const signH = 26;
            const leftColWidth = wSno + wCheckPoint;

            doc.rect(startX, currY, leftColWidth, signH).fillAndStroke('#f9fafb', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("Supervisor Sign", startX + 10, currY + 8);

            doc.rect(startX + leftColWidth, currY, wStatus, signH).stroke();
            if (first.supervisorSignature) {
                doc.font("Helvetica-Bold").fontSize(7).fillColor('#16a34a').text("Approved ✓", startX + leftColWidth, currY + 4, { width: wStatus, align: "center" });
                doc.fillColor('black').text(first.supervisorSignature.substring(0, 18), startX + leftColWidth, currY + 14, { width: wStatus, align: "center" });
            }
            currY += signH;

            // 5. HOF Sign Row
            doc.rect(startX, currY, leftColWidth, signH).fillAndStroke('#f9fafb', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("HOF Sign", startX + 10, currY + 8);

            doc.rect(startX + leftColWidth, currY, wStatus, signH).stroke();
            const hofSign = first.hofSignature || '';
            if (hofSign.startsWith('Approved (')) {
                const name = hofSign.replace('Approved (', '').replace(')', '');
                doc.font("Helvetica-Bold").fontSize(7).fillColor('#16a34a').text("Verified ✓", startX + leftColWidth, currY + 4, { width: wStatus, align: "center" });
                doc.fillColor('black').text(name.substring(0, 18), startX + leftColWidth, currY + 14, { width: wStatus, align: "center" });
            } else if (hofSign.startsWith('Pending [')) {
                doc.font("Helvetica-Bold").fontSize(7).fillColor('#dc2626').text("Pending HOF Review", startX + leftColWidth, currY + 9, { width: wStatus, align: "center" });
            }
            currY += signH;

            // 6. Notes Box
            currY += 5;
            const noteBoxHeight = 44;
            doc.rect(startX, currY, totalWidth, noteBoxHeight).stroke();
            doc.rect(startX, currY, totalWidth, 14).fillAndStroke('#f3f4f6', 'black');
            doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text("Legend / Notes:", startX + 6, currY + 3);

            doc.font("Helvetica").fontSize(7).fillColor('black');
            doc.text("✓ : OK   |   X : NOT OK   |   CA - Corrected during Audit   |   NA - Not Applicable", startX + 6, currY + 18);
            doc.font("Helvetica-Bold").fontSize(7).text("Remarks : If Nonconformity please write on NCR format", startX + 6, currY + 30);

            currY += noteBoxHeight;

            // 7. Dynamic QF Value Footer
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#374151')
                .text(effectiveQf, startX, currY + 4, { align: 'left' });

            return currY + 16;
        };

        let currentY = topMargin;
        let isFirstOnPage = true;

        groups.forEach(groupRecords => {
            const entryH = computeEntryHeight(groupRecords.length);

            if (!isFirstOnPage && (currentY + entryH > pageBottom)) {
                doc.addPage();
                currentY = topMargin;
                isFirstOnPage = true;
            }

            if (!isFirstOnPage) {
                doc.save()
                    .lineWidth(0.5)
                    .dash(3, { space: 3 })
                    .strokeColor('#9ca3af')
                    .moveTo(startX, currentY - 4)
                    .lineTo(startX + totalWidth, currentY - 4)
                    .stroke()
                    .restore();
            }

            const endY = drawEntry(groupRecords, currentY);
            currentY = endY + 12;
            isFirstOnPage = false;
        });

        doc.end();

    } catch (err) {
        console.error("LPA PDF generation error:", err);
        if (!res.headersSent) res.status(500).json({ message: "PDF generation failed" });
    }
};

// ============================================================
// 7. PDF GENERATION - SINGLE DAY (used by HOF approval dashboard)
// ============================================================
const generateLPADayReport = async (req, res) => {
    try {
        const { lineCode, date, shopId } = req.query;

        if (!lineCode || !date) {
            return res.status(400).json({ error: "lineCode and date are required" });
        }

        const cleanDate = String(date).split('T')[0];
        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(50), lineCode);
        request.input('checkDate', sql.Date, cleanDate);
        request.input('machineShop', sql.Int, parseInt(shopId || 3, 10));

        const query = `
            SELECT 
                a.id, a.machineShop, a.lineCode, a.partName, a.partNo, a.checkDate, a.sNo, a.[checkPoint], a.status, a.remarks, a.supervisorSignature, a.hofSignature,
                FORMAT(a.checkDate, 'dd/MM/yyyy') AS displayDateStr
            FROM LayeredProcessAuditBottomLevel a
            WHERE a.machineShop = @machineShop
              AND a.lineCode = @lineCode
              AND CONVERT(date, a.checkDate) = CONVERT(date, @checkDate)
            ORDER BY a.sNo ASC
        `;

        const result = await request.query(query);
        const records = result.recordset;

        if (!records || records.length === 0) {
            return res.status(404).json({ error: "No records found for the selected date." });
        }

        const qfHistory = await fetchQfHistory();

        const first = records[0];
        const displayDate = first.displayDateStr || formatDateDisplay(first.checkDate);
        const effectiveQf = getEffectiveQfValue(qfHistory, first.checkDate);

        const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true, autoPageBreak: false });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=LPA_${lineCode}_${cleanDate}.pdf`);
        doc.pipe(res);

        const startX = 20;
        const topMargin = 20;
        const totalWidth = doc.page.width - 40;
        const pageBottom = doc.page.height - 20;

        const wSno = 40;
        const wStatus = 120;
        const wCheckPoint = totalWidth - wSno - wStatus;
        const leftColWidth = wSno + wCheckPoint;

        const drawCheckMark = (cx, cy, size = 10) => {
            doc.save().lineWidth(1.5).strokeColor('#16a34a')
               .moveTo(cx - size * 0.45, cy).lineTo(cx - size * 0.1, cy + size * 0.4).lineTo(cx + size * 0.45, cy - size * 0.35)
               .stroke().restore();
        };

        const drawCrossMark = (cx, cy, size = 9) => {
            const h = size / 2;
            doc.save().lineWidth(1.5).strokeColor('#dc2626')
               .moveTo(cx - h, cy - h).lineTo(cx + h, cy + h).moveTo(cx + h, cy - h).lineTo(cx - h, cy + h)
               .stroke().restore();
        };

        let currY = topMargin;
        const headerH = 65, metaBoxWidth = 290, logoBoxWidth = 130;
        const titleBoxWidth = totalWidth - logoBoxWidth - metaBoxWidth;

        // Title Header
        doc.lineWidth(0.6).strokeColor('black');
        doc.rect(startX, currY, logoBoxWidth, headerH).stroke();
        const logoPath = path.join(__dirname, 'logo.jpg');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, startX + 10, currY + 12, { fit: [110, 38], align: 'center', valign: 'center' });
        } else {
            doc.font("Helvetica-Bold").fontSize(12).fillColor('black').text("SAKTHI AUTO", startX, currY + 25, { width: logoBoxWidth, align: "center" });
        }

        doc.rect(startX + logoBoxWidth, currY, titleBoxWidth, headerH).stroke();
        doc.font("Helvetica-Bold").fontSize(13).fillColor('black').text("LAYERED PROCESS AUDIT - BOTTOM LEVEL", startX + logoBoxWidth, currY + 18, { width: titleBoxWidth, align: "center" });
        doc.font("Helvetica-Bold").fontSize(8).fillColor('#374151').text(effectiveQf, startX + logoBoxWidth, currY + 36, { width: titleBoxWidth, align: "center" });

        const metaX = startX + logoBoxWidth + titleBoxWidth;
        doc.rect(metaX, currY, metaBoxWidth, headerH).stroke();
        [16, 36, 50].forEach(o => doc.moveTo(metaX, currY + o).lineTo(metaX + metaBoxWidth, currY + o).stroke());

        doc.font("Helvetica-Bold").fontSize(8.5).fillColor('black');
        doc.text("PROCESS / LINE", metaX + 5, currY + 4); doc.text(`:   ${first.lineCode || ''}`, metaX + 90, currY + 4);
        doc.text("PART NAME", metaX + 5, currY + 20);
        doc.font("Helvetica").fontSize(7.5).text(`:   ${first.partName || ''}`, metaX + 90, currY + 19, { width: metaBoxWidth - 95, height: 16, ellipsis: true });
        doc.font("Helvetica-Bold").fontSize(8.5);
        doc.text("PART NO", metaX + 5, currY + 38); doc.text(`:   ${first.partNo || ''}`, metaX + 90, currY + 38);
        doc.text("DATE", metaX + 5, currY + 52); doc.text(`:   ${displayDate}`, metaX + 90, currY + 52);

        currY += headerH + 4;

        // Table Header
        const thH = 22;
        doc.rect(startX, currY, wSno, thH).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("S.No", startX, currY + 6, { width: wSno, align: "center" });

        doc.rect(startX + wSno, currY, wCheckPoint, thH).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("Check Points", startX + wSno + 10, currY + 6, { width: wCheckPoint - 20, align: "left" });

        doc.rect(startX + wSno + wCheckPoint, currY, wStatus, thH).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("Status", startX + wSno + wCheckPoint, currY + 6, { width: wStatus, align: "center" });
        currY += thH;

        // Table Rows
        const rowH = 22;
        records.forEach(item => {
            if (currY + rowH > pageBottom - 110) {
                doc.addPage();
                currY = topMargin;
            }

            doc.rect(startX, currY, wSno, rowH).stroke();
            doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text(String(item.sNo), startX, currY + 6, { width: wSno, align: "center" });

            doc.rect(startX + wSno, currY, wCheckPoint, rowH).stroke();
            doc.font("Helvetica").fontSize(7.5).fillColor('black').text(item.checkPoint, startX + wSno + 8, currY + 6, { width: wCheckPoint - 16, align: "left" });

            doc.rect(startX + wSno + wCheckPoint, currY, wStatus, rowH).stroke();
            const val = (item.status || '').trim();
            const cX = startX + wSno + wCheckPoint;
            const cx = cX + wStatus / 2;
            const cy = currY + rowH / 2;

            if (val === '✓' || val.toLowerCase() === 'ok') drawCheckMark(cx, cy, 10);
            else if (val === 'X' || val.toLowerCase() === 'x' || val.toLowerCase() === 'notok') drawCrossMark(cx, cy, 9);
            else if (val) doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text(val, cX, currY + 6, { width: wStatus, align: "center" });

            currY += rowH;
        });

        // Supervisor Sign
        const signH = 26;
        doc.rect(startX, currY, leftColWidth, signH).fillAndStroke('#f9fafb', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("Supervisor Sign", startX + 10, currY + 8);
        doc.rect(startX + leftColWidth, currY, wStatus, signH).stroke();
        if (first.supervisorSignature) {
            doc.font("Helvetica-Bold").fontSize(7).fillColor('#16a34a').text("Approved ✓", startX + leftColWidth, currY + 4, { width: wStatus, align: "center" });
            doc.fillColor('black').text(first.supervisorSignature.substring(0, 18), startX + leftColWidth, currY + 14, { width: wStatus, align: "center" });
        }
        currY += signH;

        // HOF Sign
        doc.rect(startX, currY, leftColWidth, signH).fillAndStroke('#f9fafb', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("HOF Sign", startX + 10, currY + 8);
        doc.rect(startX + leftColWidth, currY, wStatus, signH).stroke();

        const hofSign = first.hofSignature || '';
        if (hofSign.startsWith('Approved (')) {
            const name = hofSign.replace('Approved (', '').replace(')', '');
            doc.font("Helvetica-Bold").fontSize(7).fillColor('#16a34a').text("Verified ✓", startX + leftColWidth, currY + 4, { width: wStatus, align: "center" });
            doc.fillColor('black').text(name.substring(0, 18), startX + leftColWidth, currY + 14, { width: wStatus, align: "center" });
        } else if (hofSign.startsWith('Pending [')) {
            doc.font("Helvetica-Bold").fontSize(7).fillColor('#dc2626').text("Pending HOF Review", startX + leftColWidth, currY + 9, { width: wStatus, align: "center" });
        }
        currY += signH;

        // Notes Box
        currY += 5;
        const noteBoxHeight = 44;
        doc.rect(startX, currY, totalWidth, noteBoxHeight).stroke();
        doc.rect(startX, currY, totalWidth, 14).fillAndStroke('#f3f4f6', 'black');
        doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text("Legend / Notes:", startX + 6, currY + 3);

        doc.font("Helvetica").fontSize(7).fillColor('black');
        doc.text("✓ : OK   |   X : NOT OK   |   CA - Corrected during Audit   |   NA - Not Applicable", startX + 6, currY + 18);
        doc.font("Helvetica-Bold").fontSize(7).text("Remarks : If Nonconformity please write on NCR format", startX + 6, currY + 30);

        doc.end();
    } catch (err) {
        console.error("LPA day PDF generation error:", err);
        if (!res.headersSent) res.status(500).json({ error: "PDF generation failed" });
        else res.end();
    }
};

module.exports = {
    getHOFUsers,
    saveLPABottomLevel,
    getPendingHOFLPAData,
    signHOFApproval,
    getLPABottomLevel,
    generateLPAReport,
    generateLPADayReport
};