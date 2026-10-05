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
    const { machineShop, lineCode, partNo, date } = req.query;
    try {
        let query = `SELECT * FROM AirGapSensorCheckSheet WHERE 1 = 1`;
        const request = new sql.Request();
        if (machineShop) { query += ` AND machineShop = @machineShop`; request.input('machineShop', sql.Int, parseInt(machineShop)); }
        if (lineCode) { query += ` AND lineCode = @lineCode`; request.input('lineCode', sql.NVarChar(50), lineCode); }
        if (partNo) { query += ` AND partNo = @partNo`; request.input('partNo', sql.NVarChar(100), partNo); }
        if (date) { query += ` AND checkDate = @checkDate`; request.input('checkDate', sql.Date, date); }
        query += ` ORDER BY machineNo, parameter, shift`;
        const result = await request.query(query);
        return res.status(200).json(result.recordset);
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch data' }); }
};

// ============================================================
// PDF GENERATION (SINGLE DAY EXACTLY LIKE FRONTEND)
// ============================================================
const generateAirGapReport = async (req, res) => {
    try {
        const { lineCode, partNo, date, shopId } = req.query;

        if (!lineCode || !date) return res.status(400).json({ error: "lineCode and date are required" });

        let cleanDate = String(date).split('T')[0];

        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(50), lineCode);
        request.input('checkDate', sql.Date, cleanDate);

        let query = `SELECT * FROM AirGapSensorCheckSheet WHERE lineCode = @lineCode AND CONVERT(date, checkDate) = @checkDate`;
        if (partNo) {
            query += ` AND partNo = @partNo`;
            request.input('partNo', sql.NVarChar(100), partNo);
        }
        if (shopId) {
            query += ` AND machineShop = @shopId`;
            request.input('shopId', sql.Int, parseInt(shopId));
        }

        const result = await request.query(query);
        const records = result.recordset;

        // RETURN 404 IF NO DATA EXISTS FOR THIS SINGLE DAY
        if (records.length === 0) {
            return res.status(404).json({ error: "No records found for the selected date." });
        }

        // Group data into blocks
        const blocksMap = {};
        const prodSigns = {};

        records.forEach(r => {
            const key = `${r.machineNo}_${r.errorProofNo}`;
            if (!blocksMap[key]) blocksMap[key] = { machineNo: r.machineNo, errorProofNo: r.errorProofNo, data: {}, lineSigns: {} };

            if (!blocksMap[key].data[r.shift]) blocksMap[key].data[r.shift] = {};
            blocksMap[key].data[r.shift][r.parameter] = r.status;

            if (r.lineInchargeSignature) {
                blocksMap[key].lineSigns[r.shift] = r.lineInchargeSignature;
            }
            if (r.productionSignature) {
                prodSigns[r.shift] = r.productionSignature;
            }
        });

        const defaultParams = [
            { master: "*LH-NOGO", master2: "#RH-NOGO", expected: "OFF/RED/NO SIGNAL" },
            { master: "LH-GO", master2: "RH-NOGO", expected: "OFF/RED/NO SIGNAL" },
            { master: "LH-NOGO", master2: "RH-GO", expected: "OFF/RED/NO SIGNAL" },
            { master: "*LH-GO", master2: "#RH-GO", expected: "ON / GREEN SIGNAL" }
        ];

        // Format display date
        const [yy, mm, dd] = cleanDate.split('-');
        const displayDate = `${dd}/${mm}/${yy}`;

        const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=AirGap_${lineCode}_${cleanDate}.pdf`);
        doc.pipe(res);

        const startX = 20;
        let startY = 20;
        const totalWidth = doc.page.width - 40;

        doc.lineWidth(0.5).strokeColor('black');

        // --- DRAW HEADER ---
        const metaBoxWidth = 300;
        const titleBoxWidth = totalWidth - 150 - metaBoxWidth;
        const headerTotalH = 75; // Increased height to prevent overlap

        doc.rect(startX, startY, 150, headerTotalH).stroke();
        const logoPath = path.join(__dirname, 'logo.jpg');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, startX + 15, startY + 15, { width: 120, height: 40, fit: [120, 40], align: 'center', valign: 'center' });
        } else {
            doc.font("Helvetica-Bold").fontSize(14).fillColor('black').text("SAKTHI AUTO", startX, startY + 30, { width: 150, align: "center" });
        }

        doc.rect(startX + 150, startY, titleBoxWidth, headerTotalH).stroke();
        doc.font("Helvetica-Bold").fontSize(18).text("AIR GAP SENSOR CHECK SHEET", startX + 150, startY + 30, { width: titleBoxWidth, align: "center" });

        const metaX = startX + 150 + titleBoxWidth;
        doc.rect(metaX, startY, metaBoxWidth, headerTotalH).stroke();
        doc.moveTo(metaX, startY + 15).lineTo(metaX + metaBoxWidth, startY + 15).stroke();
        doc.moveTo(metaX, startY + 45).lineTo(metaX + metaBoxWidth, startY + 45).stroke(); // Part name line moved down
        doc.moveTo(metaX, startY + 60).lineTo(metaX + metaBoxWidth, startY + 60).stroke();

        doc.font("Helvetica-Bold").fontSize(10);
        doc.text("LINE NAME", metaX + 5, startY + 5); doc.text(`:   ${lineCode || ''}`, metaX + 80, startY + 5);
        doc.text("PART NAME", metaX + 5, startY + 25);

        // Wrap Part Name if it's too long
        doc.font("Helvetica").fontSize(9).text(`:   ${records[0]?.partName || ''}`, metaX + 80, startY + 18, { width: metaBoxWidth - 85, height: 25 });

        doc.font("Helvetica-Bold").fontSize(10);
        doc.text("PART NO", metaX + 5, startY + 48); doc.text(`:   ${partNo || records[0]?.partNo || ''}`, metaX + 80, startY + 48);
        doc.text("DATE", metaX + 5, startY + 63); doc.text(`:   ${displayDate}`, metaX + 80, startY + 63);

        startY += headerTotalH + 10;

        // --- DRAW TABLE SKELETON (SINGLE DAY) ---
        const wMach = 100, wMast = 120, wParam = 180, wExp = 140;
        const leftTotal = wMach + wMast + wParam + wExp;
        const dateColsWidth = totalWidth - leftTotal;
        const wShift = dateColsWidth / 3;

        const headerH1 = 20, headerH2 = 15;

        doc.rect(startX, startY, wMach, headerH1 + headerH2).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("Machine No", startX, startY + 10, { width: wMach, align: "center" });

        doc.rect(startX + wMach, startY, wMast, headerH1 + headerH2).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("Error Proof No", startX + wMach, startY + 10, { width: wMast, align: "center" });

        doc.rect(startX + wMach + wMast, startY, wParam, headerH1 + headerH2).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("Parameter (Master Position)", startX + wMach + wMast, startY + 10, { width: wParam, align: "center" });

        doc.rect(startX + wMach + wMast + wParam, startY, wExp, headerH1 + headerH2).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("Expected Status", startX + wMach + wMast + wParam, startY + 10, { width: wExp, align: "center" });

        let curX = startX + leftTotal;
        doc.rect(curX, startY, wShift * 3, headerH1).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("Status", curX, startY + 6, { width: wShift * 3, align: "center" });

        doc.rect(curX, startY + headerH1, wShift, headerH2).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("Shift I", curX, startY + headerH1 + 4, { width: wShift, align: "center" });

        doc.rect(curX + wShift, startY + headerH1, wShift, headerH2).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("Shift II", curX + wShift, startY + headerH1 + 4, { width: wShift, align: "center" });

        doc.rect(curX + wShift * 2, startY + headerH1, wShift, headerH2).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("Shift III", curX + wShift * 2, startY + headerH1 + 4, { width: wShift, align: "center" });

        startY += headerH1 + headerH2;
        let currentY = startY;
        const rowH = 30;

        Object.values(blocksMap).forEach(block => {

            // Check Page Overflow
            if (currentY + (rowH * 4) + 160 > doc.page.height - 20) {
                doc.addPage();
                currentY = 20;
            }

            for (let i = 0; i < 4; i++) {
                const param = defaultParams[i];
                if (i === 0) {
                    doc.rect(startX, currentY, wMach, rowH * 4).stroke();
                    doc.font("Helvetica-Bold").fontSize(10).text(block.machineNo, startX, currentY + (rowH * 2) - 5, { width: wMach, align: "center" });
                    doc.rect(startX + wMach, currentY, wMast, rowH * 4).stroke();
                    doc.text(block.errorProofNo, startX + wMach, currentY + (rowH * 2) - 5, { width: wMast, align: "center" });
                }

                doc.rect(startX + wMach + wMast, currentY, wParam, rowH).stroke();
                doc.font("Helvetica").fontSize(9).text(`${param.master} ${param.master2}`.trim(), startX + wMach + wMast + 10, currentY + 10, { width: wParam - 20, align: "left" });

                doc.rect(startX + wMach + wMast + wParam, currentY, wExp, rowH).stroke();
                doc.text(param.expected.replace(/\n/g, ''), startX + wMach + wMast + wParam + 10, currentY + 10, { width: wExp - 20, align: "left" });

                let cX = startX + leftTotal;

                const paramFullStr = `${param.master} ${param.master2}`;

                const drawShiftCell = (s) => {
                    const val = (block.data[s] || {})[paramFullStr] || (block.data[s] || {})[param.master] || '';
                    doc.rect(cX, currentY, wShift, rowH).stroke();
                    if (val) {
                        if (val === '✓') {
                            // Using ZapfDingbats character "3" for a perfect checkmark
                            doc.font("ZapfDingbats").fontSize(12).fillColor('green').text("3", cX, currentY + 10, { width: wShift, align: "center" });
                        } else if (val === 'X') {
                            doc.font("Helvetica-Bold").fontSize(12).fillColor('red').text("X", cX, currentY + 10, { width: wShift, align: "center" });
                        } else {
                            doc.font("Helvetica-Bold").fontSize(9).fillColor('black').text(val, cX, currentY + 10, { width: wShift, align: "center" });
                        }
                    }
                    doc.fillColor('black');
                    cX += wShift;
                };

                drawShiftCell('I');
                drawShiftCell('II');
                drawShiftCell('III');

                currentY += rowH;
            }

            const signRowH = 30;
            doc.rect(startX, currentY, leftTotal, signRowH).fillAndStroke('#f9fafb', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(10).text("Line Incharge Signature", startX + 15, currentY + 10);

            let cX = startX + leftTotal;
            const drawSignCell = (s) => {
                const sign = block.lineSigns[s] || '';
                doc.rect(cX, currentY, wShift, signRowH).stroke();
                if (sign) {
                    doc.font("Helvetica-Bold").fontSize(8).fillColor('#16a34a').text("Approved", cX, currentY + 6, { width: wShift, align: "center" });
                    doc.fillColor('black').text(sign.substring(0, 10), cX, currentY + 16, { width: wShift, align: "center" });
                }
                cX += wShift;
            };
            drawSignCell('I'); drawSignCell('II'); drawSignCell('III');
            currentY += signRowH;
        });

        // --- PE ROW ---
        const prodRowH = 35;
        doc.rect(startX, currentY, leftTotal, prodRowH).fillAndStroke('#f9fafb', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(10).text("Shift Production Incharge Signature (PE)", startX + 15, currentY + 12);

        let cX = startX + leftTotal;
        const drawProdSign = (s) => {
            const sign = prodSigns[s] || '';
            doc.rect(cX, currentY, wShift, prodRowH).fillAndStroke('#f9fafb', 'black');

            if (sign.startsWith('Approved (')) {
                const name = sign.replace('Approved (', '').replace(')', '');
                doc.font("Helvetica-Bold").fontSize(8).fillColor('#16a34a').text("Verified", cX, currentY + 8, { width: wShift, align: "center" });
                doc.fillColor('black').text(name.substring(0, 10), cX, currentY + 18, { width: wShift, align: "center" });
            } else if (sign.startsWith('Pending [')) {
                doc.font("Helvetica-Bold").fontSize(9).fillColor('#dc2626').text("Pending PE Review", cX, currentY + 12, { width: wShift, align: "center" });
            }
            doc.fillColor('black'); // reset
            cX += wShift;
        };
        drawProdSign('I'); drawProdSign('II'); drawProdSign('III');
        currentY += prodRowH;

        // --- FOOTER NOTES ---
        currentY += 15;
        const noteBoxHeight = 90; // Increased height so the text fits inside perfectly
        doc.rect(startX, currentY, totalWidth, noteBoxHeight).stroke();
        doc.rect(startX, currentY, totalWidth, 20).fillAndStroke('#f3f4f6', 'black');
        doc.font("Helvetica-Bold").fontSize(10).fillColor('black').text("Note:", startX + 10, currentY + 5);

        doc.font("Helvetica").fontSize(9);

        // Custom Checkmark drawn using ZapfDingbats perfectly inline with text
        // Note text
        doc.font("Helvetica")
            .text("a) If status OK -", startX + 10, currentY + 25);

        // Tick mark - moved slightly DOWN
        doc.font("ZapfDingbats")
            .fontSize(10)
            .text("3", startX + 78, currentY + 30);

        // Continue text
        doc.font("Helvetica")
            .fontSize(10)
            .text("   If status NOTOK - X", startX + 88, currentY + 25);

        doc.text("b) Air gap sensor should be checked as per WI/07/MPD-266 (for digital), WI/07/MPD-266A (for Analog)", startX + 10, currentY + 38);
        doc.text("c) If air gap sensor verification gets failed follow the reaction plan for Error proof failure WI/07/MPD-271.", startX + 10, currentY + 51);
        doc.text("d) Error proof verification should be conducted and recorded during setup changes, major breakdowns.", startX + 10, currentY + 64);

        doc.font("Helvetica-Bold").text("LEGEND: *-Applicable for single part fixture (LH), #-Applicable for single part fixture (RH), I ,II, III -Shift.", startX + 10, currentY + 77);

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