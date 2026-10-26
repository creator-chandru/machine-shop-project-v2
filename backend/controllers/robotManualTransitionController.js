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
            FROM RobotManualQFvalues 
            ORDER BY date DESC, id DESC
        `);
        return res.recordset || [];
    } catch (e) {
        console.error("Warning: Could not fetch RobotManualQFvalues:", e.message);
        return [];
    }
};

const getEffectiveQfValue = (qfHistory, recordDateStr) => {
    const fallback = "QF/07/MPD-48, Rev.No: 00 dt 24.09.2025";
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
// 1. GET APPROVER USERS FOR DROPDOWN
// ============================================================
const getApproverUsers = async (req, res) => {
    try {
        const result = await sql.query`
            SELECT username AS name, username, employeeId 
            FROM dbo.MachineShopUsers 
            WHERE role IN ('shiftincharge', 'productengineer', 'hof', 'admin')
            ORDER BY username ASC
        `;
        const list = result.recordset.length > 0 ? result.recordset : [];
        return res.status(200).json({ approverList: list });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch approver list' });
    }
};

// ============================================================
// 2. SAVE ROBOT TO MANUAL & MANUAL TO ROBOT CHECK SHEET
// ============================================================
const saveRobotManualTransition = async (req, res) => {
    const { header, rToMChecks, mToRChecks, verifiedBy, approvedBy } = req.body;

    if (!header || !header.lineCode || !header.date || !header.shift) {
        return res.status(400).json({ error: 'Line Code, Date and Shift are required' });
    }

    let transaction;
    try {
        transaction = new sql.Transaction();
        await transaction.begin();

        const checkDate = header.date;
        const shift = header.shift;

        let formattedApprovedBy = approvedBy || '';
        if (formattedApprovedBy && !formattedApprovedBy.startsWith('Pending [') && !formattedApprovedBy.startsWith('Approved (')) {
            formattedApprovedBy = `Pending [${formattedApprovedBy}]`;
        }

        const allItems = [
            ...(rToMChecks || []).map(c => ({ ...c, sectionType: 'ROBOT_TO_MANUAL' })),
            ...(mToRChecks || []).map(c => ({ ...c, sectionType: 'MANUAL_TO_ROBOT' }))
        ];

        for (const item of allItems) {
            const checkPointText = item.checkPoint || item.text || '';
            const status = item.status || '';

            // Check if record exists
            const existingRequest = new sql.Request(transaction);
            existingRequest.input('machineShop', sql.Int, parseInt(header.machineShop))
                .input('lineCode', sql.NVarChar(50), header.lineCode)
                .input('checkDate', sql.Date, checkDate)
                .input('shift', sql.NVarChar(10), shift)
                .input('sectionType', sql.NVarChar(50), item.sectionType)
                .input('sNo', sql.Int, item.sNo);

            const existingResult = await existingRequest.query(`
                SELECT COUNT(*) AS count 
                FROM RobotManualTransitionCheckSheet
                WHERE machineShop = @machineShop 
                  AND lineCode = @lineCode 
                  AND checkDate = @checkDate 
                  AND shift = @shift 
                  AND sectionType = @sectionType 
                  AND sNo = @sNo
            `);

            const alreadyExists = existingResult.recordset[0].count > 0;
            const request = new sql.Request(transaction);

            request.input('machineShop', sql.Int, parseInt(header.machineShop))
                .input('lineCode', sql.NVarChar(50), header.lineCode)
                .input('partName', sql.NVarChar(200), header.partName || '')
                .input('partNo', sql.NVarChar(100), header.partNo || '')
                .input('checkDate', sql.Date, checkDate)
                .input('shift', sql.NVarChar(10), shift)
                .input('sectionType', sql.NVarChar(50), item.sectionType)
                .input('sNo', sql.Int, item.sNo)
                .input('checkPoint', sql.NVarChar(500), checkPointText)
                .input('status', sql.NVarChar(10), status)
                .input('verifiedBy', sql.NVarChar(255), verifiedBy || '')
                .input('approvedBy', sql.NVarChar(255), formattedApprovedBy);

            if (alreadyExists) {
                await request.query(`
                    UPDATE RobotManualTransitionCheckSheet
                    SET [checkPoint] = CASE WHEN @checkPoint <> '' THEN @checkPoint ELSE [checkPoint] END,
                        status = CASE WHEN @status <> '' THEN @status ELSE status END,
                        verifiedBy = CASE WHEN @verifiedBy <> '' THEN @verifiedBy ELSE verifiedBy END,
                        approvedBy = CASE WHEN @approvedBy <> '' THEN @approvedBy ELSE approvedBy END
                    WHERE machineShop = @machineShop 
                      AND lineCode = @lineCode 
                      AND checkDate = @checkDate 
                      AND shift = @shift 
                      AND sectionType = @sectionType 
                      AND sNo = @sNo
                `);
            } else {
                await request.query(`
                    INSERT INTO RobotManualTransitionCheckSheet
                    (machineShop, lineCode, partName, partNo, checkDate, shift, sectionType, sNo, [checkPoint], status, verifiedBy, approvedBy)
                    VALUES
                    (@machineShop, @lineCode, @partName, @partNo, @checkDate, @shift, @sectionType, @sNo, @checkPoint, @status, @verifiedBy, @approvedBy)
                `);
            }
        }

        await transaction.commit();
        return res.status(201).json({ message: 'Robot Manual Transition Check Sheet saved successfully' });
    } catch (err) {
        if (transaction) try { await transaction.rollback(); } catch (e) { }
        console.error("Save Robot Manual error:", err);
        return res.status(500).json({ error: 'Failed to save Robot Manual Transition Check Sheet' });
    }
};

// ============================================================
// 3. GET PENDING FOR APPROVER
// ============================================================
const getPendingApprovals = async (req, res) => {
    try {
        const { name } = req.params;
        const shopId = parseInt(req.query.shopId, 10);

        const request = new sql.Request();
        const pendingString = `Pending [${String(name || '').trim()}]`;
        request.input('approverName', sql.NVarChar(255), pendingString);

        let shopFilter = '';
        if (!isNaN(shopId)) {
            request.input('machineShop', sql.Int, shopId);
            shopFilter = ' AND machineShop = @machineShop';
        }

        const result = await request.query(`
            SELECT 
                machineShop, lineCode, MAX(partName) AS partName, MAX(partNo) AS partNo,
                FORMAT(checkDate, 'yyyy-MM-dd') AS reportDate, shift,
                MAX(verifiedBy) AS verifiedBy,
                MAX(approvedBy) AS approvedBy
            FROM RobotManualTransitionCheckSheet
            WHERE approvedBy = @approverName
              ${shopFilter}
            GROUP BY machineShop, lineCode, checkDate, shift
            ORDER BY checkDate DESC
        `);
        return res.status(200).json(result.recordset);
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch pending approvals' });
    }
};

// ============================================================
// 4. POST: APPROVER SIGN AND APPROVE
// ============================================================
const signApproval = async (req, res) => {
    try {
        const { lineCode, date, shift, signature } = req.body;
        if (!lineCode || !date || !shift || !signature) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        let cleanDate = String(date).split('T')[0];

        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(50), lineCode)
            .input('checkDate', sql.NVarChar(50), cleanDate)
            .input('shift', sql.NVarChar(10), shift)
            .input('approvedStr', sql.NVarChar(255), `Approved (${signature})`)
            .input('pendingStr', sql.NVarChar(255), `Pending [${signature}]`);

        const result = await request.query(`
            UPDATE RobotManualTransitionCheckSheet 
            SET approvedBy = @approvedStr
            WHERE lineCode = @lineCode 
              AND CONVERT(date, checkDate) = CONVERT(date, @checkDate)
              AND shift = @shift
              AND approvedBy = @pendingStr
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
// 5. GET SAVED ROBOT MANUAL TRANSITION DATA
// ============================================================
const getRobotManualTransition = async (req, res) => {
    const { machineShop, lineCode, date, shift } = req.query;
    try {
        let query = `
            SELECT id, machineShop, lineCode, partName, partNo, checkDate, shift, sectionType, sNo, [checkPoint], status, verifiedBy, approvedBy 
            FROM RobotManualTransitionCheckSheet 
            WHERE 1 = 1
        `;
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
        if (shift) {
            query += ` AND shift = @shift`;
            request.input('shift', sql.NVarChar(10), shift);
        }
        query += ` ORDER BY sectionType DESC, sNo ASC`;

        const result = await request.query(query);
        return res.status(200).json(result.recordset);
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch check sheet data' });
    }
};

// ============================================================
// 6. PDF GENERATION - RANGE
// ============================================================
const generateReport = async (req, res) => {
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
                a.id, a.machineShop, a.lineCode, a.partName, a.partNo, a.checkDate, a.shift, a.sectionType, a.sNo, a.[checkPoint], a.status, a.verifiedBy, a.approvedBy,
                FORMAT(a.checkDate, 'yyyy-MM-dd') AS formattedDate,
                FORMAT(a.checkDate, 'dd/MM/yyyy') AS displayDateStr
            FROM RobotManualTransitionCheckSheet a
            WHERE a.machineShop = @machineShop 
              AND CONVERT(date, a.checkDate) >= @fromDate 
              AND CONVERT(date, a.checkDate) <= @toDate
            ORDER BY a.checkDate ASC, a.lineCode ASC, a.shift ASC, a.sectionType DESC, a.sNo ASC
        `;

        const result = await request.query(query);
        const records = result.recordset;

        if (!records || records.length === 0) {
            return res.status(404).json({ error: "No records found for the selected date range." });
        }

        const qfHistory = await fetchQfHistory();

        // Group by lineCode + date + shift
        const groupedMap = new Map();
        records.forEach(r => {
            const dateStr = r.formattedDate || getDateISO(r.checkDate);
            const groupKey = `${r.lineCode}_${dateStr}_${r.shift}`;
            if (!groupedMap.has(groupKey)) {
                groupedMap.set(groupKey, []);
            }
            groupedMap.get(groupKey).push(r);
        });

        const groups = Array.from(groupedMap.values());

        const doc = new PDFDocument({ margin: 20, size: "A4", bufferPages: true, autoPageBreak: false });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=Robot_Manual_${cleanFromDate}_to_${cleanToDate}.pdf`);
        doc.pipe(res);

        const startX = 20;
        const totalWidth = doc.page.width - 40;
        const pageBottom = doc.page.height - 20;
        const topMargin = 20;

        const wSno = 35;
        const wStatus = 75;
        const wDesc = totalWidth - wSno - wStatus;

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

        const computeEntryHeight = () => {
            const headerH = 65;
            const tableHeaderH = 20;
            const sectionH = 18 * 2;
            const rowsH = 12 * 22; // 6 points for section 1 + 6 points for section 2
            const signH = 26;
            const notesH = 46;
            const qfH = 20;
            return headerH + 6 + tableHeaderH + sectionH + rowsH + signH + 6 + notesH + qfH + 10;
        };

        const drawEntry = (groupRecords, entryY) => {
            const first = groupRecords[0];
            const displayDate = first.displayDateStr || formatDateDisplay(first.checkDate);
            const effectiveQf = getEffectiveQfValue(qfHistory, first.checkDate);

            // 1. Header Box
            const headerH = 65;
            const metaBoxWidth = 200;
            const logoBoxWidth = 100;
            const titleBoxWidth = totalWidth - logoBoxWidth - metaBoxWidth;

            doc.lineWidth(0.6).strokeColor('black');

            // Logo
            doc.rect(startX, entryY, logoBoxWidth, headerH).stroke();
            const logoPath = path.join(__dirname, 'logo.jpg');
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, startX + 5, entryY + 12, { width: 90, height: 38, fit: [90, 38], align: 'center', valign: 'center' });
            } else {
                doc.font("Helvetica-Bold").fontSize(11).fillColor('black').text("SAKTHI AUTO", startX, entryY + 25, { width: logoBoxWidth, align: "center" });
            }

            // Title Box
            doc.rect(startX + logoBoxWidth, entryY, titleBoxWidth, headerH).stroke();
            doc.font("Helvetica-Bold").fontSize(11).fillColor('black').text("CHECK LIST FOR ROBOT TO MANUAL AND MANUAL TO ROBOT CNC OPERATION", startX + logoBoxWidth + 5, entryY + 20, { width: titleBoxWidth - 10, align: "center" });

            // Metadata Box
            const metaX = startX + logoBoxWidth + titleBoxWidth;
            doc.rect(metaX, entryY, metaBoxWidth, headerH).stroke();
            doc.moveTo(metaX, entryY + 16).lineTo(metaX + metaBoxWidth, entryY + 16).stroke();
            doc.moveTo(metaX, entryY + 32).lineTo(metaX + metaBoxWidth, entryY + 32).stroke();
            doc.moveTo(metaX, entryY + 48).lineTo(metaX + metaBoxWidth, entryY + 48).stroke();

            doc.font("Helvetica-Bold").fontSize(8).fillColor('black');
            doc.text("LINE CODE", metaX + 5, entryY + 4); doc.text(`:   ${first.lineCode || ''}`, metaX + 65, entryY + 4);
            doc.text("PART NAME", metaX + 5, entryY + 20);
            doc.font("Helvetica").fontSize(7.5).text(`:   ${first.partName || ''}`, metaX + 65, entryY + 19, { width: metaBoxWidth - 70, height: 12, ellipsis: true });

            doc.font("Helvetica-Bold").fontSize(8);
            doc.text("DATE", metaX + 5, entryY + 35); doc.text(`:   ${displayDate}`, metaX + 65, entryY + 35);
            doc.text("SHIFT", metaX + 5, entryY + 51); doc.text(`:   ${first.shift || ''}`, metaX + 65, entryY + 51);

            let currY = entryY + headerH + 4;

            // 2. Table Headers
            const thH = 20;
            doc.rect(startX, currY, wSno, thH).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("S.NO", startX, currY + 6, { width: wSno, align: "center" });

            doc.rect(startX + wSno, currY, wDesc, thH).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("CHECK POINTS DESCRIPTION", startX + wSno + 10, currY + 6, { width: wDesc - 20, align: "left" });

            doc.rect(startX + wSno + wDesc, currY, wStatus, thH).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("STATUS", startX + wSno + wDesc, currY + 6, { width: wStatus, align: "center" });
            currY += thH;

            // 3. Table Rows
            const rowH = 22;
            let lastSection = '';

            groupRecords.forEach(item => {
                if (item.sectionType !== lastSection) {
                    lastSection = item.sectionType;
                    const sectionTitle = lastSection === 'ROBOT_TO_MANUAL'
                        ? "CHECK LIST FOR ROBOT TO MANUAL CNC OPERATION"
                        : "CHECK LIST FOR MANUAL CNC OPERATION TO ROBOT";

                    doc.rect(startX, currY, totalWidth, 18).fillAndStroke('#e5e7eb', 'black');
                    doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text(sectionTitle, startX, currY + 5, { width: totalWidth, align: "center" });
                    currY += 18;
                }

                doc.rect(startX, currY, wSno, rowH).stroke();
                doc.font("Helvetica-Bold").fontSize(8).text(String(item.sNo), startX, currY + 6, { width: wSno, align: "center" });

                doc.rect(startX + wSno, currY, wDesc, rowH).stroke();
                doc.font("Helvetica").fontSize(7.5).text(item.checkPoint, startX + wSno + 8, currY + 4, { width: wDesc - 16, align: "left" });

                doc.rect(startX + wSno + wDesc, currY, wStatus, rowH).stroke();
                const val = (item.status || '').trim();
                const cX = startX + wSno + wDesc;
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

            // 4. Signatures
            const signH = 26;
            const halfWidth = totalWidth / 2;

            doc.rect(startX, currY, halfWidth, signH).fillAndStroke('#f9fafb', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("VERIFIED BY:", startX + 10, currY + 8);
            if (first.verifiedBy) {
                doc.font("Helvetica-Bold").fontSize(7).fillColor('#16a34a').text("Verified ✓", startX + 75, currY + 4);
                doc.fillColor('black').text(first.verifiedBy.substring(0, 18), startX + 75, currY + 14);
            }

            doc.rect(startX + halfWidth, currY, halfWidth, signH).fillAndStroke('#f9fafb', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("APPROVED BY:", startX + halfWidth + 10, currY + 8);
            const appSign = first.approvedBy || '';
            if (appSign.startsWith('Approved (')) {
                const name = appSign.replace('Approved (', '').replace(')', '');
                doc.font("Helvetica-Bold").fontSize(7).fillColor('#16a34a').text("Approved ✓", startX + halfWidth + 80, currY + 4);
                doc.fillColor('black').text(name.substring(0, 18), startX + halfWidth + 80, currY + 14);
            } else if (appSign.startsWith('Pending [')) {
                doc.font("Helvetica-Bold").fontSize(7).fillColor('#dc2626').text("Pending Approval", startX + halfWidth + 80, currY + 9);
            }

            currY += signH;

            // 5. Notes Box
            currY += 5;
            const noteBoxHeight = 44;
            doc.rect(startX, currY, totalWidth, noteBoxHeight).stroke();
            doc.rect(startX, currY, totalWidth, 14).fillAndStroke('#f3f4f6', 'black');
            doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text("Note :", startX + 6, currY + 3);

            doc.font("Helvetica").fontSize(7).fillColor('black');
            doc.text("1.  ✓  - good", startX + 6, currY + 18);
            doc.text("2. Verification should be carried out before the start of the first part trail.", startX + 6, currY + 30);

            currY += noteBoxHeight;

            // 6. Dynamic QF Value Footer
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#374151')
                .text(effectiveQf, startX, currY + 4, { align: 'left' });

            return currY + 16;
        };

        let currentY = topMargin;
        let isFirstOnPage = true;

        groups.forEach(groupRecords => {
            const entryH = computeEntryHeight();

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
        console.error("Robot Manual PDF generation error:", err);
        if (!res.headersSent) res.status(500).json({ message: "PDF generation failed" });
    }
};

// ============================================================
// 7. PDF GENERATION - SINGLE DAY (used by Approver dashboard)
// ============================================================
const generateDayReport = async (req, res) => {
    try {
        const { lineCode, date, shift, shopId } = req.query;

        if (!lineCode || !date) {
            return res.status(400).json({ error: "lineCode and date are required" });
        }

        const cleanDate = String(date).split('T')[0];
        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(50), lineCode);
        request.input('checkDate', sql.Date, cleanDate);
        request.input('machineShop', sql.Int, parseInt(shopId || 3, 10));

        let query = `
            SELECT 
                a.id, a.machineShop, a.lineCode, a.partName, a.partNo, a.checkDate, a.shift, a.sectionType, a.sNo, a.[checkPoint], a.status, a.verifiedBy, a.approvedBy,
                FORMAT(a.checkDate, 'dd/MM/yyyy') AS displayDateStr
            FROM RobotManualTransitionCheckSheet a
            WHERE a.machineShop = @machineShop
              AND a.lineCode = @lineCode
              AND CONVERT(date, a.checkDate) = CONVERT(date, @checkDate)
        `;

        if (shift) {
            request.input('shift', sql.NVarChar(10), shift);
            query += ` AND a.shift = @shift`;
        }
        query += ` ORDER BY a.shift ASC, a.sectionType DESC, a.sNo ASC`;

        const result = await request.query(query);
        const records = result.recordset;

        if (!records || records.length === 0) {
            return res.status(404).json({ error: "No records found for the selected date." });
        }

        const qfHistory = await fetchQfHistory();

        const first = records[0];
        const displayDate = first.displayDateStr || formatDateDisplay(first.checkDate);
        const effectiveQf = getEffectiveQfValue(qfHistory, first.checkDate);

        const doc = new PDFDocument({ margin: 20, size: "A4", bufferPages: true, autoPageBreak: false });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=Robot_Manual_${lineCode}_${cleanDate}.pdf`);
        doc.pipe(res);

        const startX = 20;
        const topMargin = 20;
        const totalWidth = doc.page.width - 40;
        const pageBottom = doc.page.height - 20;

        const wSno = 35;
        const wStatus = 75;
        const wDesc = totalWidth - wSno - wStatus;

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
        const headerH = 65, metaBoxWidth = 200, logoBoxWidth = 100;
        const titleBoxWidth = totalWidth - logoBoxWidth - metaBoxWidth;

        // Title Header
        doc.lineWidth(0.6).strokeColor('black');
        doc.rect(startX, currY, logoBoxWidth, headerH).stroke();
        const logoPath = path.join(__dirname, 'logo.jpg');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, startX + 5, currY + 12, { fit: [90, 38], align: 'center', valign: 'center' });
        } else {
            doc.font("Helvetica-Bold").fontSize(11).fillColor('black').text("SAKTHI AUTO", startX, currY + 25, { width: logoBoxWidth, align: "center" });
        }

        doc.rect(startX + logoBoxWidth, currY, titleBoxWidth, headerH).stroke();
        doc.font("Helvetica-Bold").fontSize(11).fillColor('black').text("CHECK LIST FOR ROBOT TO MANUAL AND MANUAL TO ROBOT CNC OPERATION", startX + logoBoxWidth + 5, entryY => currY + 16, { width: titleBoxWidth - 10, align: "center" });
        doc.font("Helvetica-Bold").fontSize(8).fillColor('#374151').text(effectiveQf, startX + logoBoxWidth, currY + 45, { width: titleBoxWidth, align: "center" });

        const metaX = startX + logoBoxWidth + titleBoxWidth;
        doc.rect(metaX, currY, metaBoxWidth, headerH).stroke();
        [16, 32, 48].forEach(o => doc.moveTo(metaX, currY + o).lineTo(metaX + metaBoxWidth, currY + o).stroke());

        doc.font("Helvetica-Bold").fontSize(8).fillColor('black');
        doc.text("LINE CODE", metaX + 5, currY + 4); doc.text(`:   ${first.lineCode || ''}`, metaX + 65, currY + 4);
        doc.text("PART NAME", metaX + 5, currY + 20);
        doc.font("Helvetica").fontSize(7.5).text(`:   ${first.partName || ''}`, metaX + 65, currY + 19, { width: metaBoxWidth - 70, height: 12, ellipsis: true });

        doc.font("Helvetica-Bold").fontSize(8);
        doc.text("DATE", metaX + 5, currY + 35); doc.text(`:   ${displayDate}`, metaX + 65, entryY => currY + 35);
        doc.text("SHIFT", metaX + 5, currY + 51); doc.text(`:   ${first.shift || ''}`, metaX + 65, currY + 51);

        currY += headerH + 4;

        // Table Header
        const thH = 20;
        doc.rect(startX, currY, wSno, thH).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("S.NO", startX, currY + 6, { width: wSno, align: "center" });

        doc.rect(startX + wSno, currY, wDesc, thH).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("CHECK POINTS DESCRIPTION", startX + wSno + 10, currY + 6, { width: wDesc - 20, align: "left" });

        doc.rect(startX + wSno + wDesc, currY, wStatus, thH).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("STATUS", startX + wSno + wDesc, currY + 6, { width: wStatus, align: "center" });
        currY += thH;

        // Table Rows
        const rowH = 22;
        let lastSection = '';

        records.forEach(item => {
            if (currY + rowH > pageBottom - 80) {
                doc.addPage();
                currY = topMargin;
            }

            if (item.sectionType !== lastSection) {
                lastSection = item.sectionType;
                const sectionTitle = lastSection === 'ROBOT_TO_MANUAL'
                    ? "CHECK LIST FOR ROBOT TO MANUAL CNC OPERATION"
                    : "CHECK LIST FOR MANUAL CNC OPERATION TO ROBOT";

                doc.rect(startX, currY, totalWidth, 18).fillAndStroke('#e5e7eb', 'black');
                doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text(sectionTitle, startX, currY + 5, { width: totalWidth, align: "center" });
                currY += 18;
            }

            doc.rect(startX, currY, wSno, rowH).stroke();
            doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text(String(item.sNo), startX, currY + 6, { width: wSno, align: "center" });

            doc.rect(startX + wSno, currY, wDesc, rowH).stroke();
            doc.font("Helvetica").fontSize(7.5).fillColor('black').text(item.checkPoint, startX + wSno + 8, currY + 4, { width: wDesc - 16, align: "left" });

            doc.rect(startX + wSno + wDesc, currY, wStatus, rowH).stroke();
            const val = (item.status || '').trim();
            const cX = startX + wSno + wDesc;
            const cx = cX + wStatus / 2;
            const cy = currY + rowH / 2;

            if (val === '✓' || val.toLowerCase() === 'ok') drawCheckMark(cx, cy, 10);
            else if (val === 'X' || val.toLowerCase() === 'x' || val.toLowerCase() === 'notok') drawCrossMark(cx, cy, 9);
            else if (val) doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text(val, cX, currY + 6, { width: wStatus, align: "center" });

            currY += rowH;
        });

        // Signatures
        const signH = 26;
        const halfWidth = totalWidth / 2;

        doc.rect(startX, currY, halfWidth, signH).fillAndStroke('#f9fafb', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("VERIFIED BY:", startX + 10, currY + 8);
        if (first.verifiedBy) {
            doc.font("Helvetica-Bold").fontSize(7).fillColor('#16a34a').text("Verified ✓", startX + 75, currY + 4);
            doc.fillColor('black').text(first.verifiedBy.substring(0, 18), startX + 75, currY + 14);
        }

        doc.rect(startX + halfWidth, currY, halfWidth, signH).fillAndStroke('#f9fafb', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("APPROVED BY:", startX + halfWidth + 10, currY + 8);
        const appSign = first.approvedBy || '';
        if (appSign.startsWith('Approved (')) {
            const name = appSign.replace('Approved (', '').replace(')', '');
            doc.font("Helvetica-Bold").fontSize(7).fillColor('#16a34a').text("Approved ✓", startX + halfWidth + 80, currY + 4);
            doc.fillColor('black').text(name.substring(0, 18), startX + halfWidth + 80, currY + 14);
        } else if (appSign.startsWith('Pending [')) {
            doc.font("Helvetica-Bold").fontSize(7).fillColor('#dc2626').text("Pending Approval", startX + halfWidth + 80, currY + 9);
        }

        currY += signH;

        // Notes Box
        currY += 5;
        const noteBoxHeight = 44;
        doc.rect(startX, currY, totalWidth, noteBoxHeight).stroke();
        doc.rect(startX, currY, totalWidth, 14).fillAndStroke('#f3f4f6', 'black');
        doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text("Note :", startX + 6, currY + 3);

        doc.font("Helvetica").fontSize(7).fillColor('black');
        doc.text("1.  ✓  - good", startX + 6, currY + 18);
        doc.text("2. Verification should be carried out before the start of the first part trail.", startX + 6, currY + 30);

        doc.end();
    } catch (err) {
        console.error("Robot Manual day PDF generation error:", err);
        if (!res.headersSent) res.status(500).json({ error: "PDF generation failed" });
        else res.end();
    }
};

module.exports = {
    getApproverUsers,
    saveRobotManualTransition,
    getPendingApprovals,
    signApproval,
    getRobotManualTransition,
    generateReport,
    generateDayReport
};