const sql = require("../db");
const PDFDocument = require("pdfkit"); // Switched back to pure pdfkit for manual, flawless grid drawing
const fs = require('fs');
const path = require('path');

// ============================================================
// GET MACHINE SHOP DETAILS
// ============================================================
const getFourMChangeMonitoringDetails = async (req, res) => {
    const { shopId } = req.params;
    try {
        if (!shopId || ![1, 2, 3, 4, 5].includes(Number(shopId))) return res.status(400).json({ message: "Invalid machine shop" });
        const tableName = `MachineShop${shopId}Details`;
        const result = await sql.query(`SELECT id, lineCode, partName, partNo, machineNo, machineType FROM ${tableName} ORDER BY lineCode, partName, partNo, machineNo`);
        res.status(200).json(result.recordset);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch machine shop details", error: error.message });
    }
};

// ============================================================
// GET DETAILS FOR SELECTED LINE CODE
// ============================================================
const getFourMChangeMonitoringLineDetails = async (req, res) => {
    const { shopId } = req.params;
    const { lineCode } = req.query;
    try {
        if (!shopId || ![1, 2, 3, 4, 5].includes(Number(shopId))) return res.status(400).json({ message: "Invalid machine shop" });
        if (!lineCode) return res.status(400).json({ message: "lineCode is required" });
        const tableName = `MachineShop${shopId}Details`;
        const request = new sql.Request();
        request.input("lineCode", sql.NVarChar(100), lineCode);
        const result = await request.query(`SELECT id, lineCode, partName, partNo, machineNo, machineType FROM ${tableName} WHERE lineCode = @lineCode ORDER BY partName, partNo, machineNo`);
        res.status(200).json(result.recordset);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch line details", error: error.message });
    }
};

// ============================================================
// GET HOD USERS
// ============================================================
const getHODUsers = async (req, res) => {
    try {
        const hodRes = await sql.query`
            SELECT username AS name, username, employeeId 
            FROM dbo.MachineShopUsers 
            WHERE LOWER(role) IN ('hod') 
            ORDER BY username ASC
        `;
        const list = hodRes.recordset.length > 0 ? hodRes.recordset : [];
        return res.status(200).json({ hodList: list });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch HOD list' });
    }
};

// ============================================================
// SAVE FOUR M CHANGE MONITORING
// ============================================================
const saveFourMChangeMonitoring = async (req, res) => {
    const { headerInfo, rows, hodSign } = req.body;
    if (!headerInfo || !headerInfo.machineShop || !headerInfo.lineCode || !headerInfo.partName) return res.status(400).json({ message: "Header information missing" });
    if (!rows || rows.length === 0) return res.status(400).json({ message: "At least one row is required" });

    const transaction = new sql.Transaction();
    try {
        await transaction.begin();

        let finalHodSign = hodSign || '';
        if (finalHodSign && !finalHodSign.startsWith('Pending [') && !finalHodSign.startsWith('Approved (')) {
            finalHodSign = `Pending [${finalHodSign}]`;
        }

        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            const request = new sql.Request(transaction);

            request.input("machineShop", sql.Int, Number(headerInfo.machineShop))
                   .input("lineCode", sql.NVarChar(100), headerInfo.lineCode)
                   .input("partName", sql.NVarChar(255), headerInfo.partName)
                   .input("slNo", sql.Int, row.slNo ? Number(row.slNo) : index + 1)
                   .input("dateShift", sql.NVarChar(100), row.dateShift || null)
                   .input("mcNo", sql.NVarChar(100), row.mcNo || null)
                   .input("typeOf4M", sql.NVarChar(255), row.typeOf4M || null)
                   .input("description", sql.NVarChar(sql.MAX), row.description || null)
                   .input("firstPart", sql.NVarChar(100), row.firstPart || null)
                   .input("lastPart", sql.NVarChar(100), row.lastPart || null)
                   .input("inspectionFrequency", sql.NVarChar(255), row.inspectionFrequency || null)
                   .input("retroChecking", sql.NVarChar(255), row.retroChecking || null)
                   .input("quarantine", sql.NVarChar(255), row.quarantine || null)
                   .input("partIdentification", sql.NVarChar(255), row.partIdentification || null)
                   .input("internalCommunication", sql.NVarChar(255), row.internalCommunication || null)
                   .input("inchargeSign", sql.NVarChar(255), row.inchargeSign || null)
                   .input("hodSign", sql.NVarChar(255), finalHodSign || null);

            await request.query(`
                INSERT INTO FourMChangeMonitoring (
                    machineShop, lineCode, partName, slNo, dateShift, mcNo, typeOf4M, description,
                    firstPart, lastPart, inspectionFrequency, retroChecking, quarantine,
                    partIdentification, internalCommunication, inchargeSign, hodSign
                ) VALUES (
                    @machineShop, @lineCode, @partName, @slNo, @dateShift, @mcNo, @typeOf4M, @description,
                    @firstPart, @lastPart, @inspectionFrequency, @retroChecking, @quarantine,
                    @partIdentification, @internalCommunication, @inchargeSign, @hodSign
                )
            `);
        }
        await transaction.commit();
        return res.status(201).json({ message: "4M Change Monitoring data saved successfully" });
    } catch (error) {
        if (transaction) try { await transaction.rollback(); } catch (e) {}
        return res.status(500).json({ message: "Failed to save 4M Change Monitoring data", error: error.message });
    }
};

// ============================================================
// PENDING REPORTS FOR HOD DASHBOARD
// ============================================================
const getPendingHODReports = async (req, res) => {
    try {
        const { name } = req.params;
        const shopId = parseInt(req.query.shopId, 10);

        const request = new sql.Request();
        const pendingString = `Pending [${String(name || '').trim()}]`;
        request.input('hodName', sql.NVarChar(255), pendingString);

        let shopFilter = '';
        if (!isNaN(shopId)) {
            request.input('machineShop', sql.Int, shopId);
            shopFilter = ' AND machineShop = @machineShop';
        }

        const result = await request.query(`
            SELECT 
                machineShop, lineCode, partName, MAX(dateShift) as reportDate, MAX(hodSign) as hodSign
            FROM FourMChangeMonitoring
            WHERE hodSign = @hodName ${shopFilter}
            GROUP BY machineShop, lineCode, partName
            ORDER BY reportDate DESC
        `);
        return res.status(200).json(result.recordset);
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch pending HOD data' });
    }
};

// ============================================================
// APPROVE HOD RECORD
// ============================================================
const signHODApproval = async (req, res) => {
    try {
        const { lineCode, partName, signature } = req.body;
        if (!lineCode || !partName || !signature) return res.status(400).json({ error: 'Missing parameters' });

        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(100), lineCode)
               .input('partName', sql.NVarChar(255), partName)
               .input('approvedStr', sql.NVarChar(255), `Approved (${signature})`)
               .input('pendingStr', sql.NVarChar(255), `Pending [${signature}]`);

        const result = await request.query(`
            UPDATE FourMChangeMonitoring 
            SET hodSign = @approvedStr
            WHERE lineCode = @lineCode AND partName = @partName AND hodSign = @pendingStr
        `);

        if (!result.rowsAffected[0]) return res.status(404).json({ error: 'No pending records found' });
        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to sign check sheet' });
    }
};

// ============================================================
// GENERATE PDF USING MANUAL GRID (Exact Match to Air Gap Aesthetic)
// ============================================================
const generate4MReport = async (req, res) => {
    try {
        const { lineCode, partName, hodSign } = req.query;

        if (!lineCode || !partName) return res.status(400).json({ error: "lineCode and partName required" });

        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(50), lineCode);
        request.input('partName', sql.NVarChar(255), partName);
        
        let query = `SELECT * FROM FourMChangeMonitoring WHERE lineCode = @lineCode AND partName = @partName`;
        if (hodSign) {
            query += ` AND hodSign = @hodSign`;
            request.input('hodSign', sql.NVarChar(255), hodSign);
        }

        const result = await request.query(query);
        const records = result.recordset;

        if (records.length === 0) return res.status(404).json({ error: "No records found" });

        // Initialize PDF Document (A4 Landscape)
        const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=4M_${lineCode}.pdf`);
        doc.pipe(res);

        const startX = 20;
        let startY = 20;
        const totalWidth = 800; // Optimal fixed width for A4 landscape
        
        doc.lineWidth(0.5).strokeColor('black');

        // --- DRAW HEADER (BEAUTIFUL 3-BOX LAYOUT) ---
        const metaBoxWidth = 350; 
        const titleBoxWidth = totalWidth - 150 - metaBoxWidth;
        const headerTotalH = 60; 
        
        doc.rect(startX, startY, 150, headerTotalH).stroke();
        const logoPath = path.join(__dirname, 'logo.jpg');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, startX + 15, startY + 10, { width: 120, height: 40, fit: [120, 40], align: 'center', valign: 'center' });
        } else {
            doc.font("Helvetica-Bold").fontSize(12).fillColor('black').text("SAKTHI AUTO", startX, startY + 25, { width: 150, align: "center" });
        }

        doc.rect(startX + 150, startY, titleBoxWidth, headerTotalH).stroke();
        doc.font("Helvetica-Bold").fontSize(16).fillColor('black').text("4M CHANGE MONITORING CHECK SHEET", startX + 150, startY + 22, { width: titleBoxWidth, align: "center" });

        const metaX = startX + 150 + titleBoxWidth;
        doc.rect(metaX, startY, metaBoxWidth, headerTotalH).stroke();
        doc.moveTo(metaX, startY + 30).lineTo(metaX + metaBoxWidth, startY + 30).stroke();

        doc.font("Helvetica-Bold").fontSize(10);
        doc.text("LINE NAME", metaX + 5, startY + 10);  doc.text(`:   ${lineCode || ''}`, metaX + 80, startY + 10);
        doc.text("PART NAME", metaX + 5, startY + 40); 
        
        // Wrap Part Name perfectly
        doc.font("Helvetica").fontSize(9).text(`:   ${records[0]?.partName || ''}`, metaX + 80, startY + 36, { width: metaBoxWidth - 85, height: 22 });

        startY += headerTotalH + 10;

        // --- MANUAL TABLE DRAWING ---
        const headers = [
            { label: "Date /\nShift", w: 65 },
            { label: "M/c. No", w: 45 },
            { label: "Type of\n4M", w: 45 },
            { label: "Description", w: 165 },
            { label: "First\nPart", w: 40 },
            { label: "Last\nPart", w: 40 },
            { label: "Inspection\nFrequency\nN - Normal /\nI - Increase", w: 65 },
            { label: "Retro\nchecking", w: 50 },
            { label: "Quarantine", w: 55 },
            { label: "Part\nIdentification", w: 65 },
            { label: "Internal\nCommunication", w: 90 },
            { label: "Incharge\nSign", w: 75 }
        ];

        const drawHeaders = (yPos) => {
            doc.rect(startX, yPos, totalWidth, 35).fillAndStroke('#e5e7eb', 'black');
            let curX = startX;
            doc.font("Helvetica-Bold").fontSize(7).fillColor('black');
            headers.forEach(h => {
                doc.rect(curX, yPos, h.w, 35).stroke();
                // Vertically center text in header
                doc.text(h.label, curX, yPos + 4, { width: h.w, align: "center" });
                curX += h.w;
            });
            return yPos + 35;
        };

        let currentY = drawHeaders(startY);

        const checkCols = [4, 5, 7, 8, 9, 10]; // Columns needing green tick / red cross

        records.forEach(r => {
            const rowData = [
                r.dateShift || "-",
                r.mcNo || "-",
                r.typeOf4M || "-",
                r.description || "-",
                r.firstPart || "-",
                r.lastPart || "-",
                r.inspectionFrequency || "-",
                r.retroChecking || "-",
                r.quarantine || "-",
                r.partIdentification || "-",
                r.internalCommunication || "-",
                r.inchargeSign || "-"
            ];

            // Dynamic Row Height Calculation
            let rowH = 25;
            doc.font("Helvetica").fontSize(7);
            const descH = doc.heightOfString(rowData[3], { width: headers[3].w - 4 });
            if (descH + 10 > rowH) rowH = descH + 10;

            // Page Break Check
            if (currentY + rowH > doc.page.height - 50) {
                doc.addPage();
                currentY = 20;
                currentY = drawHeaders(currentY);
            }

            let cX = startX;
            rowData.forEach((val, i) => {
                doc.rect(cX, currentY, headers[i].w, rowH).stroke();

                if (checkCols.includes(i)) {
                    if (val === '✓') {
                        // Natively draw the exact green ZapfDingbats checkmark
                        doc.font("ZapfDingbats").fontSize(12).fillColor('green').text("3", cX, currentY + (rowH/2) - 6, { width: headers[i].w, align: "center" });
                    } else if (val === 'X') {
                        doc.font("Helvetica-Bold").fontSize(10).fillColor('red').text("X", cX, currentY + (rowH/2) - 5, { width: headers[i].w, align: "center" });
                    } else {
                        doc.font("Helvetica").fontSize(7).fillColor('black').text(val, cX, currentY + (rowH/2) - 4, { width: headers[i].w, align: "center" });
                    }
                } else if (i === 11) { // Incharge Sign
                    if (val && val !== '-') {
                        doc.font("Helvetica-Bold").fontSize(6).fillColor('#16a34a').text("Approved", cX, currentY + (rowH/2) - 8, { width: headers[i].w, align: "center" });
                        doc.font("Helvetica-Bold").fontSize(6).fillColor('black').text(val.substring(0, 12), cX, currentY + (rowH/2) + 1, { width: headers[i].w, align: "center" });
                    } else {
                        doc.font("Helvetica").fontSize(7).fillColor('black').text("-", cX, currentY + (rowH/2) - 4, { width: headers[i].w, align: "center" });
                    }
                } else {
                    // Regular Text Centering
                    doc.font("Helvetica").fontSize(7).fillColor('black');
                    const textH = doc.heightOfString(val, { width: headers[i].w - 4 });
                    doc.text(val, cX + 2, currentY + (rowH/2) - (textH/2), { width: headers[i].w - 4, align: "center" });
                }
                
                doc.fillColor('black'); // Reset
                cX += headers[i].w;
            });

            currentY += rowH;
        });

        // --- FOOTER SECTION ---
        currentY += 10;
        if (currentY + 45 > doc.page.height - 20) {
            doc.addPage();
            currentY = 20;
        }

        doc.lineWidth(0.5).strokeColor('black');
        doc.rect(startX, currentY, totalWidth - 250, 40).stroke();
        doc.font("Helvetica-Bold").fontSize(8).fillColor('black').text("QF / 07 / MPD-36, Rev.No: 01, 13.03.2019", startX + 10, currentY + 16);

        // HOD Sign Box
        const hodX = startX + totalWidth - 250;
        doc.rect(hodX, currentY, 250, 40).stroke();
        doc.font("Helvetica-Bold").fontSize(10).fillColor('black').text("HOD Sign: ", hodX + 10, currentY + 15);

        const currentHodSign = records[0].hodSign || '';
        if (currentHodSign.startsWith('Approved (')) {
            const name = currentHodSign.replace('Approved (', '').replace(')', '');
            doc.fillColor('#16a34a').text(`Verified by ${name.toUpperCase()}`, hodX + 70, currentY + 15);
        } else if (currentHodSign.startsWith('Pending [')) {
            const name = currentHodSign.replace('Pending [', '').replace(']', '');
            doc.fillColor('#dc2626').text(`Pending [${name}]`, hodX + 70, currentY + 15);
        }

        doc.end();
    } catch (err) {
        console.error("PDF generation error:", err);
        if (!res.headersSent) res.status(500).json({ message: "PDF generation failed" });
    }
};

module.exports = {
    getFourMChangeMonitoringDetails,
    getFourMChangeMonitoringLineDetails,
    getHODUsers,
    saveFourMChangeMonitoring,
    getPendingHODReports,
    signHODApproval,
    generate4MReport
};