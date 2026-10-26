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
            FROM RobotControlsQFvalues 
            ORDER BY date DESC, id DESC
        `);
        return res.recordset || [];
    } catch (e) {
        console.error("Warning: Could not fetch RobotControlsQFvalues:", e.message);
        return [];
    }
};

const getEffectiveQfValue = (qfHistory, recordDateStr) => {
    const fallback = "QF / 07 / MPD – 46, Rev.No: 00, dt: 01.03.2025";
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
// 2. SAVE ROBOT CONTROLS VERIFICATION CHECK SHEET
// ============================================================
const saveRobotControls = async (req, res) => {
    const { header, items, lineInchargeSignature, hofSignature } = req.body;
    const itemList = items || [];

    if (!header || !header.lineCode || !header.machineNo || !header.date) {
        return res.status(400).json({ error: 'Header information (Line, Machine No, Date) is required' });
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

        for (const item of itemList) {
            const status = item.status || '';
            const checkingParamText = item.checkingParameter || item.parameter || '';
            const specText = item.specification || item.spec || '';
            const methodText = item.checkMethod || item.method || '';
            const freq = item.frequencyType || item.freq || 'DAILY';

            // Check if record exists
            const existingRequest = new sql.Request(transaction);
            existingRequest.input('machineShop', sql.Int, parseInt(header.machineShop))
                .input('lineCode', sql.NVarChar(50), header.lineCode)
                .input('machineNo', sql.NVarChar(50), header.machineNo)
                .input('checkDate', sql.Date, checkDate)
                .input('sNo', sql.Int, item.sNo);

            const existingResult = await existingRequest.query(`
                SELECT COUNT(*) AS count 
                FROM RobotControlsVerificationCheckSheet
                WHERE machineShop = @machineShop 
                  AND lineCode = @lineCode 
                  AND machineNo = @machineNo
                  AND checkDate = @checkDate 
                  AND sNo = @sNo
            `);

            const alreadyExists = existingResult.recordset[0].count > 0;
            const request = new sql.Request(transaction);

            request.input('machineShop', sql.Int, parseInt(header.machineShop))
                .input('lineCode', sql.NVarChar(50), header.lineCode)
                .input('machineNo', sql.NVarChar(50), header.machineNo)
                .input('partName', sql.NVarChar(200), header.partName || '')
                .input('partNo', sql.NVarChar(100), header.partNo || '')
                .input('checkDate', sql.Date, checkDate)
                .input('frequencyType', sql.NVarChar(20), freq)
                .input('sNo', sql.Int, item.sNo)
                .input('checkingParameter', sql.NVarChar(255), checkingParamText)
                .input('specification', sql.NVarChar(255), specText)
                .input('checkMethod', sql.NVarChar(255), methodText)
                .input('status', sql.NVarChar(10), status)
                .input('lineInchargeSignature', sql.NVarChar(255), lineInchargeSignature || '')
                .input('hofSignature', sql.NVarChar(255), formattedHofSign);

            if (alreadyExists) {
                await request.query(`
                    UPDATE RobotControlsVerificationCheckSheet
                    SET [checkingParameter] = CASE WHEN @checkingParameter <> '' THEN @checkingParameter ELSE [checkingParameter] END,
                        [specification] = CASE WHEN @specification <> '' THEN @specification ELSE [specification] END,
                        [checkMethod] = CASE WHEN @checkMethod <> '' THEN @checkMethod ELSE [checkMethod] END,
                        status = CASE WHEN @status <> '' THEN @status ELSE status END,
                        lineInchargeSignature = CASE WHEN @lineInchargeSignature <> '' THEN @lineInchargeSignature ELSE lineInchargeSignature END,
                        hofSignature = CASE WHEN @hofSignature <> '' THEN @hofSignature ELSE hofSignature END
                    WHERE machineShop = @machineShop 
                      AND lineCode = @lineCode 
                      AND machineNo = @machineNo
                      AND checkDate = @checkDate 
                      AND sNo = @sNo
                `);
            } else {
                await request.query(`
                    INSERT INTO RobotControlsVerificationCheckSheet
                    (machineShop, lineCode, machineNo, partName, partNo, checkDate, frequencyType, sNo, [checkingParameter], [specification], [checkMethod], status, lineInchargeSignature, hofSignature)
                    VALUES
                    (@machineShop, @lineCode, @machineNo, @partName, @partNo, @checkDate, @frequencyType, @sNo, @checkingParameter, @specification, @checkMethod, @status, @lineInchargeSignature, @hofSignature)
                `);
            }
        }

        await transaction.commit();
        return res.status(201).json({ message: 'Robot Controls Verification Check Sheet saved successfully' });
    } catch (err) {
        if (transaction) try { await transaction.rollback(); } catch (e) { }
        console.error("Save Robot Controls error:", err);
        return res.status(500).json({ error: 'Failed to save Robot Controls Verification Check Sheet' });
    }
};

// ============================================================
// 3. GET PENDING FOR HOF
// ============================================================
const getPendingHOFData = async (req, res) => {
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
                machineShop, lineCode, machineNo, MAX(partName) AS partName, MAX(partNo) AS partNo,
                FORMAT(checkDate, 'yyyy-MM-dd') AS reportDate,
                MAX(lineInchargeSignature) AS lineInchargeSignature,
                MAX(hofSignature) AS hofSignature
            FROM RobotControlsVerificationCheckSheet
            WHERE hofSignature = @hofName
              ${shopFilter}
            GROUP BY machineShop, lineCode, machineNo, checkDate
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
        const { lineCode, machineNo, date, signature } = req.body;
        if (!lineCode || !machineNo || !date || !signature) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        let cleanDate = String(date).split('T')[0];

        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(50), lineCode)
            .input('machineNo', sql.NVarChar(50), machineNo)
            .input('checkDate', sql.NVarChar(50), cleanDate)
            .input('approvedStr', sql.NVarChar(255), `Approved (${signature})`)
            .input('pendingStr', sql.NVarChar(255), `Pending [${signature}]`);

        const result = await request.query(`
            UPDATE RobotControlsVerificationCheckSheet 
            SET hofSignature = @approvedStr
            WHERE lineCode = @lineCode 
              AND machineNo = @machineNo
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
// 5. GET SAVED ROBOT CONTROLS DATA
// ============================================================
const getRobotControls = async (req, res) => {
    const { machineShop, lineCode, machineNo, date } = req.query;
    try {
        let query = `
            SELECT id, machineShop, lineCode, machineNo, partName, partNo, checkDate, frequencyType, sNo, [checkingParameter], [specification], [checkMethod], status, lineInchargeSignature, hofSignature 
            FROM RobotControlsVerificationCheckSheet 
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
        if (machineNo) {
            query += ` AND machineNo = @machineNo`;
            request.input('machineNo', sql.NVarChar(50), machineNo);
        }
        if (date) {
            query += ` AND checkDate = @checkDate`;
            request.input('checkDate', sql.Date, date);
        }
        query += ` ORDER BY sNo ASC`;

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
                a.id, a.machineShop, a.lineCode, a.machineNo, a.partName, a.partNo, a.checkDate, a.frequencyType, a.sNo, a.[checkingParameter], a.[specification], a.[checkMethod], a.status, a.lineInchargeSignature, a.hofSignature,
                FORMAT(a.checkDate, 'yyyy-MM-dd') AS formattedDate,
                FORMAT(a.checkDate, 'dd/MM/yyyy') AS displayDateStr
            FROM RobotControlsVerificationCheckSheet a
            WHERE a.machineShop = @machineShop 
              AND CONVERT(date, a.checkDate) >= @fromDate 
              AND CONVERT(date, a.checkDate) <= @toDate
            ORDER BY a.checkDate ASC, a.lineCode ASC, a.machineNo ASC, a.sNo ASC
        `;

        const result = await request.query(query);
        const records = result.recordset;

        if (!records || records.length === 0) {
            return res.status(404).json({ error: "No records found for the selected date range." });
        }

        const qfHistory = await fetchQfHistory();

        // Group by lineCode + machineNo + date
        const groupedMap = new Map();
        records.forEach(r => {
            const dateStr = r.formattedDate || getDateISO(r.checkDate);
            const groupKey = `${r.lineCode}_${r.machineNo}_${dateStr}`;
            if (!groupedMap.has(groupKey)) {
                groupedMap.set(groupKey, []);
            }
            groupedMap.get(groupKey).push(r);
        });

        const groups = Array.from(groupedMap.values());

        const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true, autoPageBreak: false });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=Robot_Controls_${cleanFromDate}_to_${cleanToDate}.pdf`);
        doc.pipe(res);

        const startX = 20;
        const totalWidth = doc.page.width - 40;
        const pageBottom = doc.page.height - 20;
        const topMargin = 20;

        const wSno = 35;
        const wStatus = 85;
        const wSpec = 190;
        const wMethod = 130;
        const wParam = totalWidth - wSno - wSpec - wMethod - wStatus;

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
            const subHeadH = 18 * 2;
            const rowsH = 12 * 20;
            const signH = 24 * 2;
            const notesH = 50;
            const qfH = 20;
            return headerH + 6 + tableHeaderH + subHeadH + rowsH + signH + 6 + notesH + qfH + 10;
        };

        const drawEntry = (groupRecords, entryY) => {
            const first = groupRecords[0];
            const displayDate = first.displayDateStr || formatDateDisplay(first.checkDate);
            const effectiveQf = getEffectiveQfValue(qfHistory, first.checkDate);

            // 1. Header Box
            const headerH = 65;
            const metaBoxWidth = 260;
            const logoBoxWidth = 120;
            const titleBoxWidth = totalWidth - logoBoxWidth - metaBoxWidth;

            doc.lineWidth(0.6).strokeColor('black');

            // Logo
            doc.rect(startX, entryY, logoBoxWidth, headerH).stroke();
            const logoPath = path.join(__dirname, 'logo.jpg');
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, startX + 10, entryY + 12, { width: 100, height: 38, fit: [100, 38], align: 'center', valign: 'center' });
            } else {
                doc.font("Helvetica-Bold").fontSize(11).fillColor('black').text("SAKTHI AUTO", startX, entryY + 25, { width: logoBoxWidth, align: "center" });
            }

            // Title Box
            doc.rect(startX + logoBoxWidth, entryY, titleBoxWidth, headerH).stroke();
            doc.font("Helvetica-Bold").fontSize(13).fillColor('black').text("ROBOT CONTROLS VERIFICATION CHECK LIST", startX + logoBoxWidth, entryY + 26, { width: titleBoxWidth, align: "center" });

            // Metadata Box
            const metaX = startX + logoBoxWidth + titleBoxWidth;
            doc.rect(metaX, entryY, metaBoxWidth, headerH).stroke();
            doc.moveTo(metaX, entryY + 16).lineTo(metaX + metaBoxWidth, entryY + 16).stroke();
            doc.moveTo(metaX, entryY + 32).lineTo(metaX + metaBoxWidth, entryY + 32).stroke();
            doc.moveTo(metaX, entryY + 48).lineTo(metaX + metaBoxWidth, entryY + 48).stroke();

            doc.font("Helvetica-Bold").fontSize(8).fillColor('black');
            doc.text("LINE CODE", metaX + 5, entryY + 4); doc.text(`:   ${first.lineCode || ''}`, metaX + 70, entryY + 4);
            doc.text("M/C NUMBER", metaX + 5, entryY + 19); doc.text(`:   ${first.machineNo || ''}`, metaX + 70, entryY + 19);
            doc.text("PART NAME", metaX + 5, entryY + 35);
            doc.font("Helvetica").fontSize(7.5).text(`:   ${first.partName || ''}`, metaX + 70, entryY + 34, { width: metaBoxWidth - 75, height: 12, ellipsis: true });

            doc.font("Helvetica-Bold").fontSize(8);
            doc.text("DATE", metaX + 5, entryY + 51); doc.text(`:   ${displayDate}`, metaX + 70, entryY + 51);

            let currY = entryY + headerH + 4;

            // 2. Table Headers
            const thH = 20;
            doc.rect(startX, currY, wSno, thH).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(7.5).text("S.No", startX, currY + 6, { width: wSno, align: "center" });

            doc.rect(startX + wSno, currY, wParam, thH).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("CHECKING PARAMETERS", startX + wSno + 10, currY + 6, { width: wParam - 20, align: "left" });

            doc.rect(startX + wSno + wParam, currY, wSpec, thH).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("SPECIFICATION", startX + wSno + wParam + 10, currY + 6, { width: wSpec - 20, align: "left" });

            doc.rect(startX + wSno + wParam + wSpec, currY, wMethod, thH).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("CHECK METHOD", startX + wSno + wParam + wSpec + 10, currY + 6, { width: wMethod - 20, align: "left" });

            doc.rect(startX + wSno + wParam + wSpec + wMethod, currY, wStatus, thH).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("STATUS", startX + wSno + wParam + wSpec + wMethod, currY + 6, { width: wStatus, align: "center" });

            currY += thH;

            // 3. Table Rows with Frequency Sub-Headers
            const rowH = 20;
            let lastFreq = '';

            groupRecords.forEach(item => {
                const currentFreq = (item.sNo <= 6) ? 'DAILY' : 'WEEKLY';

                if (currentFreq !== lastFreq) {
                    lastFreq = currentFreq;
                    const subHeader = lastFreq === 'DAILY'
                        ? "Daily 1st Shift & During Job Set-up (Items 01 - 06)"
                        : "Weekly (Every Monday) & During Job Set-up (Items 07 - 12)";

                    doc.rect(startX, currY, totalWidth, 18).fillAndStroke('#fff7ed', 'black');
                    doc.fillColor('#7c2d12').font("Helvetica-Bold").fontSize(7.5).text(subHeader, startX + 10, currY + 5, { width: totalWidth - 20, align: "left" });
                    doc.fillColor('black');
                    currY += 18;
                }

                doc.rect(startX, currY, wSno, rowH).stroke();
                doc.font("Helvetica-Bold").fontSize(7.5).text(String(item.sNo), startX, currY + 6, { width: wSno, align: "center" });

                doc.rect(startX + wSno, currY, wParam, rowH).stroke();
                doc.font("Helvetica").fontSize(7.5).text(item.checkingParameter, startX + wSno + 6, currY + 5, { width: wParam - 12, align: "left" });

                doc.rect(startX + wSno + wParam, currY, wSpec, rowH).stroke();
                doc.text(item.specification || '-', startX + wSno + wParam + 6, currY + 5, { width: wSpec - 12, align: "left" });

                doc.rect(startX + wSno + wParam + wSpec, currY, wMethod, rowH).stroke();
                doc.text(item.checkMethod || '-', startX + wSno + wParam + wSpec + 6, currY + 5, { width: wMethod - 12, align: "left" });

                doc.rect(startX + wSno + wParam + wSpec + wMethod, currY, wStatus, rowH).stroke();
                const val = (item.status || '').trim();
                const cX = startX + wSno + wParam + wSpec + wMethod;
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

            // 4. Line Incharge Signature Row
            const signH = 24;
            const leftColWidth = totalWidth - wStatus;

            doc.rect(startX, currY, leftColWidth, signH).fillAndStroke('#f9fafb', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("CHECKED BY LINE INCHARGE", startX + 10, currY + 7);

            doc.rect(startX + leftColWidth, currY, wStatus, signH).stroke();
            if (first.lineInchargeSignature) {
                doc.font("Helvetica-Bold").fontSize(7).fillColor('#16a34a').text("Checked ✓", startX + leftColWidth, currY + 3, { width: wStatus, align: "center" });
                doc.fillColor('black').text(first.lineInchargeSignature.substring(0, 15), startX + leftColWidth, currY + 12, { width: wStatus, align: "center" });
            }
            currY += signH;

            // 5. HOF Signature Row
            doc.rect(startX, currY, leftColWidth, signH).fillAndStroke('#f9fafb', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("VERIFIED BY HOF - PRODUCTION", startX + 10, currY + 7);

            doc.rect(startX + leftColWidth, currY, wStatus, signH).stroke();
            const hofSign = first.hofSignature || '';
            if (hofSign.startsWith('Approved (')) {
                const name = hofSign.replace('Approved (', '').replace(')', '');
                doc.font("Helvetica-Bold").fontSize(7).fillColor('#16a34a').text("Verified ✓", startX + leftColWidth, currY + 3, { width: wStatus, align: "center" });
                doc.fillColor('black').text(name.substring(0, 15), startX + leftColWidth, currY + 12, { width: wStatus, align: "center" });
            } else if (hofSign.startsWith('Pending [')) {
                doc.font("Helvetica-Bold").fontSize(7).fillColor('#dc2626').text("Pending HOF Review", startX + leftColWidth, currY + 8, { width: wStatus, align: "center" });
            }
            currY += signH;

            // 6. Notes Box
            currY += 5;
            const noteBoxHeight = 44;
            doc.rect(startX, currY, totalWidth, noteBoxHeight).stroke();
            doc.rect(startX, currY, totalWidth, 13).fillAndStroke('#f3f4f6', 'black');
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor('black').text("NOTE :", startX + 6, currY + 2.5);

            doc.font("Helvetica").fontSize(6.5).fillColor('black');
            doc.text("1) FREQUENCY : SI NUMBER 01 ~ 06 / DAILY 1ST SHIFT & DURING JOB SET-UP, SI NUMBER 07 ~ 12 / WEEKLY (EVERY MONDAY) & DURING JOB SET-UP.", startX + 6, currY + 16);
            doc.text("2) '✓' WORKING IN GOOD CONDITION. 'X' NOT WORKING (INFORM TO HOF-PRODUCTION).", startX + 6, currY + 25);
            doc.text("3) IF VERIFICATION GETS FAILED, DURING CHECKING INFORM TO HOF PRODUCTION & MAINTENANCE.", startX + 6, currY + 34);

            currY += noteBoxHeight;

            // 7. Dynamic QF Value Footer
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
        console.error("Robot Controls PDF generation error:", err);
        if (!res.headersSent) res.status(500).json({ message: "PDF generation failed" });
    }
};

// ============================================================
// 7. PDF GENERATION - SINGLE DAY (used by HOF dashboard)
// ============================================================
const generateDayReport = async (req, res) => {
    try {
        const { lineCode, machineNo, date, shopId } = req.query;

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
                a.id, a.machineShop, a.lineCode, a.machineNo, a.partName, a.partNo, a.checkDate, a.frequencyType, a.sNo, a.[checkingParameter], a.[specification], a.[checkMethod], a.status, a.lineInchargeSignature, a.hofSignature,
                FORMAT(a.checkDate, 'dd/MM/yyyy') AS displayDateStr
            FROM RobotControlsVerificationCheckSheet a
            WHERE a.machineShop = @machineShop
              AND a.lineCode = @lineCode
              AND CONVERT(date, a.checkDate) = CONVERT(date, @checkDate)
        `;

        if (machineNo) {
            request.input('machineNo', sql.NVarChar(50), machineNo);
            query += ` AND a.machineNo = @machineNo`;
        }
        query += ` ORDER BY a.machineNo ASC, a.sNo ASC`;

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
        res.setHeader("Content-Disposition", `inline; filename=Robot_Controls_${lineCode}_${cleanDate}.pdf`);
        doc.pipe(res);

        const startX = 20;
        const topMargin = 20;
        const totalWidth = doc.page.width - 40;
        const pageBottom = doc.page.height - 20;

        const wSno = 35;
        const wStatus = 85;
        const wSpec = 190;
        const wMethod = 130;
        const wParam = totalWidth - wSno - wSpec - wMethod - wStatus;
        const leftColWidth = totalWidth - wStatus;

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
        const headerH = 65, metaBoxWidth = 260, logoBoxWidth = 120;
        const titleBoxWidth = totalWidth - logoBoxWidth - metaBoxWidth;

        // Title Header
        doc.lineWidth(0.6).strokeColor('black');
        doc.rect(startX, currY, logoBoxWidth, headerH).stroke();
        const logoPath = path.join(__dirname, 'logo.jpg');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, startX + 10, currY + 12, { fit: [100, 38], align: 'center', valign: 'center' });
        } else {
            doc.font("Helvetica-Bold").fontSize(11).fillColor('black').text("SAKTHI AUTO", startX, currY + 25, { width: logoBoxWidth, align: "center" });
        }

        doc.rect(startX + logoBoxWidth, currY, titleBoxWidth, headerH).stroke();
        doc.font("Helvetica-Bold").fontSize(13).fillColor('black').text("ROBOT CONTROLS VERIFICATION CHECK LIST", startX + logoBoxWidth, currY + 18, { width: titleBoxWidth, align: "center" });
        doc.font("Helvetica-Bold").fontSize(8).fillColor('#374151').text(effectiveQf, startX + logoBoxWidth, currY + 36, { width: titleBoxWidth, align: "center" });

        const metaX = startX + logoBoxWidth + titleBoxWidth;
        doc.rect(metaX, currY, metaBoxWidth, headerH).stroke();
        [16, 32, 48].forEach(o => doc.moveTo(metaX, currY + o).lineTo(metaX + metaBoxWidth, currY + o).stroke());

        doc.font("Helvetica-Bold").fontSize(8).fillColor('black');
        doc.text("LINE CODE", metaX + 5, currY + 4); doc.text(`:   ${first.lineCode || ''}`, metaX + 70, currY + 4);
        doc.text("M/C NUMBER", metaX + 5, currY + 19); doc.text(`:   ${first.machineNo || ''}`, metaX + 70, currY + 19);
        doc.text("PART NAME", metaX + 5, currY + 35);
        doc.font("Helvetica").fontSize(7.5).text(`:   ${first.partName || ''}`, metaX + 70, currY + 34, { width: metaBoxWidth - 75, height: 12, ellipsis: true });

        doc.font("Helvetica-Bold").fontSize(8);
        doc.text("DATE", metaX + 5, currY + 51); doc.text(`:   ${displayDate}`, metaX + 70, currY + 51);

        currY += headerH + 4;

        // Table Header
        const thH = 20;
        doc.rect(startX, currY, wSno, thH).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(7.5).text("S.No", startX, currY + 6, { width: wSno, align: "center" });

        doc.rect(startX + wSno, currY, wParam, thH).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("CHECKING PARAMETERS", startX + wSno + 10, currY + 6, { width: wParam - 20, align: "left" });

        doc.rect(startX + wSno + wParam, currY, wSpec, thH).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("SPECIFICATION", startX + wSno + wParam + 10, currY + 6, { width: wSpec - 20, align: "left" });

        doc.rect(startX + wSno + wParam + wSpec, currY, wMethod, thH).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("CHECK METHOD", startX + wSno + wParam + wSpec + 10, currY + 6, { width: wMethod - 20, align: "left" });

        doc.rect(startX + wSno + wParam + wSpec + wMethod, currY, wStatus, thH).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("STATUS", startX + wSno + wParam + wSpec + wMethod, currY + 6, { width: wStatus, align: "center" });
        currY += thH;

        // Table Rows
        const rowH = 20;
        let lastFreq = '';

        records.forEach(item => {
            if (currY + rowH > pageBottom - 110) {
                doc.addPage();
                currY = topMargin;
            }

            const currentFreq = (item.sNo <= 6) ? 'DAILY' : 'WEEKLY';
            if (currentFreq !== lastFreq) {
                lastFreq = currentFreq;
                const subHeader = lastFreq === 'DAILY'
                    ? "Daily 1st Shift & During Job Set-up (Items 01 - 06)"
                    : "Weekly (Every Monday) & During Job Set-up (Items 07 - 12)";

                doc.rect(startX, currY, totalWidth, 18).fillAndStroke('#fff7ed', 'black');
                doc.fillColor('#7c2d12').font("Helvetica-Bold").fontSize(7.5).text(subHeader, startX + 10, currY + 5, { width: totalWidth - 20, align: "left" });
                doc.fillColor('black');
                currY += 18;
            }

            doc.rect(startX, currY, wSno, rowH).stroke();
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor('black').text(String(item.sNo), startX, currY + 6, { width: wSno, align: "center" });

            doc.rect(startX + wSno, currY, wParam, rowH).stroke();
            doc.font("Helvetica").fontSize(7.5).fillColor('black').text(item.checkingParameter, startX + wSno + 6, currY + 5, { width: wParam - 12, align: "left" });

            doc.rect(startX + wSno + wParam, currY, wSpec, rowH).stroke();
            doc.text(item.specification || '-', startX + wSno + wParam + 6, currY + 5, { width: wSpec - 12, align: "left" });

            doc.rect(startX + wSno + wParam + wSpec, currY, wMethod, rowH).stroke();
            doc.text(item.checkMethod || '-', startX + wSno + wParam + wSpec + 6, currY + 5, { width: wMethod - 12, align: "left" });

            doc.rect(startX + wSno + wParam + wSpec + wMethod, currY, wStatus, rowH).stroke();
            const val = (item.status || '').trim();
            const cX = startX + wSno + wParam + wSpec + wMethod;
            const cx = cX + wStatus / 2;
            const cy = currY + rowH / 2;

            if (val === '✓' || val.toLowerCase() === 'ok') drawCheckMark(cx, cy, 10);
            else if (val === 'X' || val.toLowerCase() === 'x' || val.toLowerCase() === 'notok') drawCrossMark(cx, cy, 9);
            else if (val) doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text(val, cX, currY + 6, { width: wStatus, align: "center" });

            currY += rowH;
        });

        // Signatures
        const signH = 24;
        doc.rect(startX, currY, leftColWidth, signH).fillAndStroke('#f9fafb', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("CHECKED BY LINE INCHARGE", startX + 10, currY + 7);

        doc.rect(startX + leftColWidth, currY, wStatus, signH).stroke();
        if (first.lineInchargeSignature) {
            doc.font("Helvetica-Bold").fontSize(7).fillColor('#16a34a').text("Checked ✓", startX + leftColWidth, currY + 3, { width: wStatus, align: "center" });
            doc.fillColor('black').text(first.lineInchargeSignature.substring(0, 15), startX + leftColWidth, currY + 12, { width: wStatus, align: "center" });
        }
        currY += signH;

        doc.rect(startX, currY, leftColWidth, signH).fillAndStroke('#f9fafb', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("VERIFIED BY HOF - PRODUCTION", startX + 10, currY + 7);

        doc.rect(startX + leftColWidth, currY, wStatus, signH).stroke();
        const hofSign = first.hofSignature || '';
        if (hofSign.startsWith('Approved (')) {
            const name = hofSign.replace('Approved (', '').replace(')', '');
            doc.font("Helvetica-Bold").fontSize(7).fillColor('#16a34a').text("Verified ✓", startX + leftColWidth, currY + 3, { width: wStatus, align: "center" });
            doc.fillColor('black').text(name.substring(0, 15), startX + leftColWidth, currY + 12, { width: wStatus, align: "center" });
        } else if (hofSign.startsWith('Pending [')) {
            doc.font("Helvetica-Bold").fontSize(7).fillColor('#dc2626').text("Pending HOF Review", startX + leftColWidth, currY + 8, { width: wStatus, align: "center" });
        }
        currY += signH;

        // Notes Box
        currY += 5;
        const noteBoxHeight = 44;
        doc.rect(startX, currY, totalWidth, noteBoxHeight).stroke();
        doc.rect(startX, currY, totalWidth, 13).fillAndStroke('#f3f4f6', 'black');
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor('black').text("NOTE :", startX + 6, currY + 2.5);

        doc.font("Helvetica").fontSize(6.5).fillColor('black');
        doc.text("1) FREQUENCY : SI NUMBER 01 ~ 06 / DAILY 1ST SHIFT & DURING JOB SET-UP, SI NUMBER 07 ~ 12 / WEEKLY (EVERY MONDAY) & DURING JOB SET-UP.", startX + 6, currY + 16);
        doc.text("2) '✓' WORKING IN GOOD CONDITION. 'X' NOT WORKING (INFORM TO HOF-PRODUCTION).", startX + 6, currY + 25);
        doc.text("3) IF VERIFICATION GETS FAILED, DURING CHECKING INFORM TO HOF PRODUCTION & MAINTENANCE.", startX + 6, currY + 34);

        doc.end();
    } catch (err) {
        console.error("Robot Controls day PDF generation error:", err);
        if (!res.headersSent) res.status(500).json({ error: "PDF generation failed" });
        else res.end();
    }
};

module.exports = {
    getHOFUsers,
    saveRobotControls,
    getPendingHOFData,
    signHOFApproval,
    getRobotControls,
    generateReport,
    generateDayReport
};