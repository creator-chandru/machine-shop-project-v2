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
// GET PE USERS FOR DROPDOWN
// ============================================================
const getPEUsers = async (req, res) => {
    try {
        const peRes = await sql.query`
            SELECT username AS name, username, employeeId 
            FROM dbo.MachineShopUsers 
            WHERE role = 'productengineer'
            ORDER BY username ASC
        `;
        const list = peRes.recordset.length > 0 ? peRes.recordset : [];
        return res.status(200).json({ peList: list });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch PE list' });
    }
};

// ============================================================
// SAVE AIR GAP SENSOR CHECK SHEET
// ============================================================
const saveAirGapSensor = async (req, res) => {
    const { header, blocks, shiftProdSignatures } = req.body;
    const blockList = blocks || [];

    if (!header) return res.status(400).json({ error: 'Header data is required' });

    let transaction;
    try {
        transaction = new sql.Transaction();
        await transaction.begin();

        const shifts = ['I', 'II', 'III'];

        for (const block of blockList) {
            const checkDate = header.date;
            const dateChecks = block.dailyChecks?.[checkDate] || {};
            const lineSignatures = block.lineInchargeSignatures?.[checkDate] || {};
            const parameters = block.parameters || [];

            for (const shift of shifts) {
                const shiftHasStatus = parameters.some((_, paramIdx) => (dateChecks[paramIdx]?.[shift] || '') !== '');
                const lineInchargeSignature = lineSignatures[shift] || '';

                // Format the PE assignment to "Pending [NAME]" using ONLY the productionSignature column
                let productionSignature = shiftProdSignatures?.[checkDate]?.[shift] || '';
                if (productionSignature && !productionSignature.startsWith('Pending [') && !productionSignature.startsWith('Approved (')) {
                    productionSignature = `Pending [${productionSignature}]`;
                }

                if (!shiftHasStatus && !lineInchargeSignature && !productionSignature) continue;

                const existingRequest = new sql.Request(transaction);
                existingRequest.input('machineShop', sql.Int, parseInt(header.machineShop))
                    .input('lineCode', sql.NVarChar(50), header.lineCode)
                    .input('partNo', sql.NVarChar(100), header.partNo)
                    .input('checkDate', sql.Date, checkDate)
                    .input('machineNo', sql.NVarChar(50), block.machineNo || '')
                    .input('shift', sql.NVarChar(10), shift);

                const existingResult = await existingRequest.query(`
                    SELECT COUNT(*) AS count FROM AirGapSensorCheckSheet
                    WHERE machineShop = @machineShop AND lineCode = @lineCode AND partNo = @partNo
                      AND checkDate = @checkDate AND machineNo = @machineNo AND shift = @shift
                `);

                if (existingResult.recordset[0].count > 0) continue;

                for (let paramIdx = 0; paramIdx < parameters.length; paramIdx++) {
                    const param = parameters[paramIdx];
                    const status = dateChecks[paramIdx]?.[shift] || '';
                    const request = new sql.Request(transaction);

                    request.input('machineShop', sql.Int, parseInt(header.machineShop))
                        .input('lineCode', sql.NVarChar(50), header.lineCode)
                        .input('partName', sql.NVarChar(200), header.partName || '')
                        .input('partNo', sql.NVarChar(100), header.partNo || '')
                        .input('checkDate', sql.Date, checkDate)
                        .input('machineNo', sql.NVarChar(50), block.machineNo || '')
                        .input('errorProofNo', sql.NVarChar(100), block.errorProofNo || '')
                        .input('parameter', sql.NVarChar(255), param.masterPosition || '')
                        .input('expectedStatus', sql.NVarChar(255), param.expectedStatus || '')
                        .input('shift', sql.NVarChar(10), shift)
                        .input('status', sql.NVarChar(10), status)
                        .input('lineInchargeSignature', sql.NVarChar(255), lineInchargeSignature)
                        .input('productionSignature', sql.NVarChar(255), productionSignature);

                    await request.query(`
                        INSERT INTO AirGapSensorCheckSheet
                        (machineShop, lineCode, partName, partNo, checkDate, machineNo, errorProofNo,
                         parameter, expectedStatus, shift, status, lineInchargeSignature, productionSignature)
                        VALUES
                        (@machineShop, @lineCode, @partName, @partNo, @checkDate, @machineNo, @errorProofNo,
                         @parameter, @expectedStatus, @shift, @status, @lineInchargeSignature, @productionSignature)
                    `);
                }
            }
        }
        await transaction.commit();
        return res.status(201).json({ message: 'Air Gap Sensor Check Sheet saved successfully' });
    } catch (err) {
        if (transaction) try { await transaction.rollback(); } catch (e) { }
        return res.status(500).json({ error: 'Failed to save Air Gap Sensor Check Sheet' });
    }
};

// ============================================================
// GET PENDING FOR PE
// ============================================================
const getPendingPEAirGapData = async (req, res) => {
    try {
        const { name } = req.params;
        const shopId = parseInt(req.query.shopId, 10);

        const request = new sql.Request();

        // Exact match formatting to find assignments made by the operator
        const pendingString = `Pending [${String(name || '').trim()}]`;
        request.input('peName', sql.NVarChar(255), pendingString);

        let shopFilter = '';
        if (!isNaN(shopId)) {
            request.input('machineShop', sql.Int, shopId);
            shopFilter = ' AND machineShop = @machineShop';
        }

        const result = await request.query(`
            SELECT 
                machineShop, lineCode, MAX(partName) AS partName, partNo,
                FORMAT(checkDate, 'yyyy-MM-dd') AS reportDate,
                MAX(productionSignature) AS productionSignature
            FROM AirGapSensorCheckSheet
            WHERE productionSignature = @peName
              ${shopFilter}
            GROUP BY machineShop, lineCode, partNo, checkDate
            ORDER BY checkDate DESC
        `);
        return res.status(200).json(result.recordset);
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch pending PE data' });
    }
};

// ============================================================
// POST: PE SIGN AND APPROVE
// ============================================================
const signPEApproval = async (req, res) => {
    try {
        const { lineCode, partNo, date, signature } = req.body;
        if (!lineCode || !date || !signature) return res.status(400).json({ error: 'Missing parameters' });

        let cleanDate = String(date).split('T')[0];

        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(100), lineCode)
            .input('partNo', sql.NVarChar(100), partNo)
            .input('checkDate', sql.NVarChar(50), cleanDate)
            .input('approvedStr', sql.NVarChar(255), `Approved (${signature})`)
            .input('pendingStr', sql.NVarChar(255), `Pending [${signature}]`);

        const result = await request.query(`
            UPDATE AirGapSensorCheckSheet 
            SET productionSignature = @approvedStr
            WHERE lineCode = @lineCode AND partNo = @partNo
              AND CONVERT(date, checkDate) = CONVERT(date, @checkDate)
              AND productionSignature = @pendingStr
        `);

        if (!result.rowsAffected[0]) return res.status(404).json({ error: 'No pending records found for your assignment' });
        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to sign check sheet' });
    }
};

const getPendingAirGapData = async (req, res) => {
    const { shopId, lineCode } = req.query;
    try {
        let query = `SELECT TOP 50 machineShop, lineCode, partName, partNo, checkDate, machineNo, errorProofNo, errorProofName FROM ErrorProofingCheckSheet WHERE 1 = 1`;
        const request = new sql.Request();
        if (shopId) { query += ` AND machineShop = @shopId`; request.input('shopId', sql.Int, parseInt(shopId)); }
        if (lineCode) { query += ` AND lineCode = @lineCode`; request.input('lineCode', sql.NVarChar(50), lineCode); }
        query += ` ORDER BY id DESC`;

        const result = await request.query(query);
        if (result.recordset.length === 0) return res.status(200).json({ header: {}, airGapRows: [] });

        const latestRecord = result.recordset[0];
        const header = { lineCode: latestRecord.lineCode, partName: latestRecord.partName, partNo: latestRecord.partNo, date: latestRecord.checkDate };

        const seen = new Set();
        const airGapRows = [];
        for (const row of result.recordset) {
            const key = `${row.machineNo}_${row.errorProofNo}`;
            if (row.machineNo && !seen.has(key)) { seen.add(key); airGapRows.push({ machineNo: row.machineNo, errorProofNo: row.errorProofNo || '' }); }
        }
        return res.status(200).json({ header, airGapRows });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch pending data' }); }
};

const getAirGapSensorCheckSheet = async (req, res) => {
    const { machineShop, lineCode, partNo, date, machineNo } = req.query;
    try {
        let query = `SELECT * FROM AirGapSensorCheckSheet WHERE 1 = 1`;
        const request = new sql.Request();
        if (machineShop) { query += ` AND machineShop = @machineShop`; request.input('machineShop', sql.Int, parseInt(machineShop)); }
        if (lineCode) { query += ` AND lineCode = @lineCode`; request.input('lineCode', sql.NVarChar(50), lineCode); }
        if (partNo) { query += ` AND partNo = @partNo`; request.input('partNo', sql.NVarChar(100), partNo); }
        if (date) { query += ` AND checkDate = @checkDate`; request.input('checkDate', sql.Date, date); }
        if (machineNo) { query += ` AND machineNo = @machineNo`; request.input('machineNo', sql.NVarChar(50), machineNo); }
        query += ` ORDER BY machineNo, parameter, shift`;
        const result = await request.query(query);
        return res.status(200).json(result.recordset);
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch data' }); }
};

// ============================================================
// PDF GENERATION (DATE RANGE WITH VECTOR CHECKMARKS & CROSSES)
// ============================================================
const generateAirGapReport = async (req, res) => {
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
            SELECT * FROM AirGapSensorCheckSheet 
            WHERE machineShop = @machineShop 
              AND CONVERT(date, checkDate) >= @fromDate 
              AND CONVERT(date, checkDate) <= @toDate
            ORDER BY checkDate ASC, lineCode ASC, machineNo ASC, parameter ASC, shift ASC
        `;

        const result = await request.query(query);
        const records = result.recordset;

        if (!records || records.length === 0) {
            return res.status(404).json({ error: "No records found for the selected date range." });
        }

        // Group records by unique compound key: lineCode + partNo + checkDate
        const groupedMap = new Map();
        records.forEach(r => {
            const dateStr = String(r.checkDate).split('T')[0];
            const groupKey = `${r.lineCode}_${r.partNo || ''}_${dateStr}`;
            if (!groupedMap.has(groupKey)) {
                groupedMap.set(groupKey, []);
            }
            groupedMap.get(groupKey).push(r);
        });

        const groups = Array.from(groupedMap.values());

        const defaultParams = [
            { master: "*LH-NOGO", master2: "#RH-NOGO", expected: "OFF/RED/NO SIGNAL" },
            { master: "LH-GO", master2: "RH-NOGO", expected: "OFF/RED/NO SIGNAL" },
            { master: "LH-NOGO", master2: "RH-GO", expected: "OFF/RED/NO SIGNAL" },
            { master: "*LH-GO", master2: "#RH-GO", expected: "ON / GREEN SIGNAL" }
        ];

        const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true, autoPageBreak: false });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=AirGap_Report_${cleanFromDate}_to_${cleanToDate}.pdf`);
        doc.pipe(res);

        const startX = 20;
        const totalWidth = doc.page.width - 40; // 801.89pt landscape width
        const pageBottom = doc.page.height - 20;
        const topMargin = 20;

        // Column widths for table
        const wMach = 90, wMast = 110, wParam = 180, wExp = 140;
        const leftTotal = wMach + wMast + wParam + wExp;
        const dateColsWidth = totalWidth - leftTotal;
        const wShift = dateColsWidth / 3;

        // Helper to draw clean vector checkmark (✓) centered at (centerX, centerY)
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

        // Helper to draw clean vector cross mark (X) centered at (centerX, centerY)
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

        const computeEntryHeight = (uniqueBlocksCount) => {
            const headerH = 65;
            const tableHeaderH = 28;
            const blockH = (22 * 4) + 24;
            const prodRowH = 26;
            const notesH = 68;
            return headerH + 6 + tableHeaderH + (uniqueBlocksCount * blockH) + prodRowH + 6 + notesH + 10;
        };

        const drawEntry = (groupRecords, entryY) => {
            const first = groupRecords[0];
            const rawDate = String(first.checkDate).split('T')[0];
            const [yy, mm, dd] = rawDate.split('-');
            const displayDate = `${dd}/${mm}/${yy}`;

            const blocksMap = {};
            const prodSigns = {};

            groupRecords.forEach(r => {
                const key = `${r.machineNo}_${r.errorProofNo}`;
                if (!blocksMap[key]) {
                    blocksMap[key] = { machineNo: r.machineNo, errorProofNo: r.errorProofNo, data: {}, lineSigns: {} };
                }
                if (!blocksMap[key].data[r.shift]) blocksMap[key].data[r.shift] = {};
                blocksMap[key].data[r.shift][r.parameter] = r.status;

                if (r.lineInchargeSignature) {
                    blocksMap[key].lineSigns[r.shift] = r.lineInchargeSignature;
                }
                if (r.productionSignature) {
                    prodSigns[r.shift] = r.productionSignature;
                }
            });

            const uniqueBlocks = Object.values(blocksMap);

            // 1. Header Box (65pt)
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

            // Title
            doc.rect(startX + logoBoxWidth, entryY, titleBoxWidth, headerH).stroke();
            doc.font("Helvetica-Bold").fontSize(14).fillColor('black').text("AIR GAP SENSOR CHECK SHEET", startX + logoBoxWidth, entryY + 25, { width: titleBoxWidth, align: "center" });

            // Metadata Box
            const metaX = startX + logoBoxWidth + titleBoxWidth;
            doc.rect(metaX, entryY, metaBoxWidth, headerH).stroke();
            doc.moveTo(metaX, entryY + 16).lineTo(metaX + metaBoxWidth, entryY + 16).stroke();
            doc.moveTo(metaX, entryY + 36).lineTo(metaX + metaBoxWidth, entryY + 36).stroke();
            doc.moveTo(metaX, entryY + 50).lineTo(metaX + metaBoxWidth, entryY + 50).stroke();

            doc.font("Helvetica-Bold").fontSize(8.5);
            doc.text("LINE NAME", metaX + 5, entryY + 4); doc.text(`:   ${first.lineCode || ''}`, metaX + 70, entryY + 4);
            doc.text("PART NAME", metaX + 5, entryY + 20);
            doc.font("Helvetica").fontSize(7.5).text(`:   ${first.partName || ''}`, metaX + 70, entryY + 19, { width: metaBoxWidth - 75, height: 16, ellipsis: true });

            doc.font("Helvetica-Bold").fontSize(8.5);
            doc.text("PART NO", metaX + 5, entryY + 38); doc.text(`:   ${first.partNo || ''}`, metaX + 70, entryY + 38);
            doc.text("DATE", metaX + 5, entryY + 52); doc.text(`:   ${displayDate}`, metaX + 70, entryY + 52);

            let currY = entryY + headerH + 4;

            // 2. Table Headers (28pt)
            const headerH1 = 15, headerH2 = 13;
            doc.rect(startX, currY, wMach, headerH1 + headerH2).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("Machine No", startX, currY + 9, { width: wMach, align: "center" });

            doc.rect(startX + wMach, currY, wMast, headerH1 + headerH2).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("Error Proof No", startX + wMach, currY + 9, { width: wMast, align: "center" });

            doc.rect(startX + wMach + wMast, currY, wParam, headerH1 + headerH2).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("Parameter (Master Position)", startX + wMach + wMast, currY + 9, { width: wParam, align: "center" });

            doc.rect(startX + wMach + wMast + wParam, currY, wExp, headerH1 + headerH2).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("Expected Status", startX + wMach + wMast + wParam, currY + 9, { width: wExp, align: "center" });

            const curX = startX + leftTotal;
            doc.rect(curX, currY, wShift * 3, headerH1).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("Status", curX, currY + 4, { width: wShift * 3, align: "center" });

            doc.rect(curX, currY + headerH1, wShift, headerH2).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("Shift I", curX, currY + headerH1 + 3, { width: wShift, align: "center" });

            doc.rect(curX + wShift, currY + headerH1, wShift, headerH2).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("Shift II", curX + wShift, currY + headerH1 + 3, { width: wShift, align: "center" });

            doc.rect(curX + wShift * 2, currY + headerH1, wShift, headerH2).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').text("Shift III", curX + wShift * 2, currY + headerH1 + 3, { width: wShift, align: "center" });

            currY += headerH1 + headerH2;

            // 3. Table Rows
            const rowH = 22;
            doc.font("Helvetica").fontSize(7.5);

            uniqueBlocks.forEach(block => {
                for (let i = 0; i < 4; i++) {
                    const param = defaultParams[i];
                    if (i === 0) {
                        doc.rect(startX, currY, wMach, rowH * 4).stroke();
                        doc.font("Helvetica-Bold").fontSize(8).text(block.machineNo, startX, currY + (rowH * 2) - 5, { width: wMach, align: "center" });
                        doc.rect(startX + wMach, currY, wMast, rowH * 4).stroke();
                        doc.text(block.errorProofNo || '-', startX + wMach, currY + (rowH * 2) - 5, { width: wMast, align: "center" });
                    }

                    doc.rect(startX + wMach + wMast, currY, wParam, rowH).stroke();
                    doc.font("Helvetica").fontSize(7.5).text(`${param.master} ${param.master2}`.trim(), startX + wMach + wMast + 6, currY + 6, { width: wParam - 12, align: "left" });

                    doc.rect(startX + wMach + wMast + wParam, currY, wExp, rowH).stroke();
                    doc.text(param.expected.replace(/\n/g, ''), startX + wMach + wMast + wParam + 6, currY + 6, { width: wExp - 12, align: "left" });

                    let cX = startX + leftTotal;
                    const paramFullStr = `${param.master} ${param.master2}`;

                    const drawShiftCell = (s) => {
                        const val = (block.data[s] || {})[paramFullStr] || (block.data[s] || {})[param.master] || '';
                        doc.rect(cX, currY, wShift, rowH).stroke();

                        if (val) {
                            const centerX = cX + (wShift / 2);
                            const centerY = currY + (rowH / 2);

                            if (val === '✓' || val.toLowerCase() === 'ok' || val === '3') {
                                drawCheckMark(centerX, centerY, 10);
                            } else if (val === 'X' || val === 'x' || val.toLowerCase() === 'notok') {
                                drawCrossMark(centerX, centerY, 9);
                            } else {
                                doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text(val, cX, currY + 6, { width: wShift, align: "center" });
                            }
                        }
                        cX += wShift;
                    };

                    drawShiftCell('I');
                    drawShiftCell('II');
                    drawShiftCell('III');

                    currY += rowH;
                }

                // Line Incharge Signature Row
                const signRowH = 24;
                doc.rect(startX, currY, leftTotal, signRowH).fillAndStroke('#f9fafb', 'black');
                doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("Line Incharge Signature", startX + 10, currY + 7);

                let cX = startX + leftTotal;
                const drawSignCell = (s) => {
                    const sign = block.lineSigns[s] || '';
                    doc.rect(cX, currY, wShift, signRowH).stroke();
                    if (sign) {
                        doc.font("Helvetica-Bold").fontSize(7).fillColor('#16a34a').text("Approved ✓", cX, currY + 4, { width: wShift, align: "center" });
                        doc.fillColor('black').text(sign.substring(0, 15), cX, currY + 13, { width: wShift, align: "center" });
                    }
                    cX += wShift;
                };
                drawSignCell('I'); drawSignCell('II'); drawSignCell('III');
                currY += signRowH;
            });

            // 4. PE Signature Row
            const prodRowH = 26;
            doc.rect(startX, currY, leftTotal, prodRowH).fillAndStroke('#f9fafb', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("Shift Production Incharge Signature (PE)", startX + 10, currY + 8);

            let cX = startX + leftTotal;
            const drawProdSign = (s) => {
                const sign = prodSigns[s] || '';
                doc.rect(cX, currY, wShift, prodRowH).fillAndStroke('#f9fafb', 'black');

                if (sign.startsWith('Approved (')) {
                    const name = sign.replace('Approved (', '').replace(')', '');
                    doc.font("Helvetica-Bold").fontSize(7).fillColor('#16a34a').text("Verified ✓", cX, currY + 4, { width: wShift, align: "center" });
                    doc.fillColor('black').text(name.substring(0, 15), cX, currY + 14, { width: wShift, align: "center" });
                } else if (sign.startsWith('Pending [')) {
                    doc.font("Helvetica-Bold").fontSize(7).fillColor('#dc2626').text("Pending PE Review", cX, currY + 9, { width: wShift, align: "center" });
                }
                doc.fillColor('black');
                cX += wShift;
            };
            drawProdSign('I'); drawProdSign('II'); drawProdSign('III');
            currY += prodRowH;

            // 5. Notes Box (68pt) with rendered tick and cross
            currY += 5;
            const noteBoxHeight = 68;
            doc.rect(startX, currY, totalWidth, noteBoxHeight).stroke();
            doc.rect(startX, currY, totalWidth, 14).fillAndStroke('#f3f4f6', 'black');
            doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text("Note:", startX + 6, currY + 3);

            doc.font("Helvetica").fontSize(7);
            doc.text("a) If status OK - ", startX + 6, currY + 18);
            drawCheckMark(startX + 69, currY + 22, 8);
            doc.font("Helvetica").fontSize(7).text("   |   If status NOTOK - ", startX + 76, currY + 18);
            drawCrossMark(startX + 154, currY + 22, 7);

            doc.text("b) Air gap sensor should be checked as per WI/07/MPD-266 (for digital), WI/07/MPD-266A (for Analog)", startX + 6, currY + 29);
            doc.text("c) If air gap sensor verification gets failed follow the reaction plan for Error proof failure WI/07/MPD-271.", startX + 6, currY + 40);
            doc.text("d) Error proof verification should be conducted and recorded during setup changes, major breakdowns.", startX + 6, currY + 51);
            doc.font("Helvetica-Bold").fontSize(7).text("LEGEND: *-Applicable for single part fixture (LH), #-Applicable for single part fixture (RH), I ,II, III -Shift.", startX + 6, currY + 60);

            return currY + noteBoxHeight;
        };

        // Render entries sequentially, packing as many as fit per landscape page
        let currentY = topMargin;
        let isFirstOnPage = true;

        groups.forEach(groupRecords => {
            const uniqueBlocksCount = new Set(groupRecords.map(r => `${r.machineNo}_${r.errorProofNo}`)).size || 1;
            const entryH = computeEntryHeight(uniqueBlocksCount);

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
        console.error("PDF generation error:", err);
        if (!res.headersSent) res.status(500).json({ message: "PDF generation failed" });
    }
};

module.exports = {
    getPEUsers,
    saveAirGapSensor,
    getPendingPEAirGapData,
    signPEApproval,
    getPendingAirGapData,
    getAirGapSensorCheckSheet,
    generateAirGapReport
};