const sql = require("../db");
const PDFDocument = require("pdfkit");
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
// FETCH EXISTING 4M RECORD (BY LINE, MACHINE, AND DATE)
// ============================================================
const getFourMRecord = async (req, res) => {
    const { machineShop, lineCode, machineNo, date } = req.query;

    if (!lineCode || !machineNo || !date) {
        return res.status(400).json({ error: "lineCode, machineNo, and date are required" });
    }

    try {
        const cleanDate = String(date).split('T')[0];
        const request = new sql.Request();
        request.input("lineCode", sql.NVarChar(100), lineCode);
        request.input("mcNo", sql.NVarChar(100), machineNo);
        request.input("datePrefix", sql.NVarChar(100), `${cleanDate}%`);

        let shopFilter = "";
        if (machineShop) {
            request.input("machineShop", sql.Int, parseInt(machineShop, 10));
            shopFilter = " AND machineShop = @machineShop";
        }

        const query = `
            SELECT * FROM FourMChangeMonitoring
            WHERE lineCode = @lineCode
              AND mcNo = @mcNo
              AND dateShift LIKE @datePrefix
              ${shopFilter}
            ORDER BY slNo ASC, id ASC
        `;

        const result = await request.query(query);
        const records = result.recordset;

        if (!records || records.length === 0) {
            return res.status(200).json(null);
        }

        const first = records[0];
        const rows = records.map((r) => {
            const dateParts = String(r.dateShift || "").trim().split(" ");
            const rowDate = dateParts[0] || cleanDate;
            const rowShift = dateParts[1] || "I";

            return {
                date: rowDate,
                shift: rowShift,
                dateShift: r.dateShift || `${rowDate} ${rowShift}`,
                mcNo: r.mcNo || machineNo,
                typeOf4M: r.typeOf4M || "",
                description: r.description || "",
                firstPart: r.firstPart || "",
                lastPart: r.lastPart || "",
                inspectionFrequency: r.inspectionFrequency || "",
                retroChecking: r.retroChecking || "",
                quarantine: r.quarantine || "",
                partIdentification: r.partIdentification || "",
                internalCommunication: r.internalCommunication || "",
                inchargeSign: r.inchargeSign || ""
            };
        });

        return res.status(200).json({
            headerInfo: {
                machineShop: first.machineShop,
                lineCode: first.lineCode,
                partName: first.partName || "",
                partNo: first.partNo || "",
                machineNo: first.mcNo || machineNo
            },
            rows,
            hodSign: first.hodSign || "" // Retain original full signature string: "Approved (name)" or "Pending [name]"
        });
    } catch (err) {
        console.error("Error fetching 4M record:", err);
        return res.status(500).json({ error: "Failed to fetch 4M record" });
    }
};

// ============================================================
// SAVE FOUR M CHANGE MONITORING
// ============================================================
const saveFourMChangeMonitoring = async (req, res) => {
    const { headerInfo, rows, hodSign } = req.body;
    if (!headerInfo || !headerInfo.machineShop || !headerInfo.lineCode || !headerInfo.partName) {
        return res.status(400).json({ message: "Header information missing" });
    }
    if (!rows || rows.length === 0) {
        return res.status(400).json({ message: "At least one row is required" });
    }

    const transaction = new sql.Transaction();
    try {
        await transaction.begin();

        let finalHodSign = hodSign || '';
        if (finalHodSign && !finalHodSign.startsWith('Pending [') && !finalHodSign.startsWith('Approved (')) {
            finalHodSign = `Pending [${finalHodSign}]`;
        }

        const targetDate = rows[0]?.date ? String(rows[0].date).split('T')[0] : '';
        const targetMc = rows.find(r => r.mcNo)?.mcNo || headerInfo.machineNo || '';

        // Clean purge for safe re-submission of existing day/machine log
        if (targetDate && targetMc) {
            await transaction.request()
                .input("machineShop", sql.Int, Number(headerInfo.machineShop))
                .input("lineCode", sql.NVarChar(100), headerInfo.lineCode)
                .input("mcNo", sql.NVarChar(100), targetMc)
                .input("datePrefix", sql.NVarChar(100), `${targetDate}%`)
                .query(`
                    DELETE FROM FourMChangeMonitoring
                    WHERE machineShop = @machineShop
                      AND lineCode = @lineCode
                      AND mcNo = @mcNo
                      AND dateShift LIKE @datePrefix
                `);
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
// GENERATE PDF (Fixes HOD Stamp & Vector Checkmarks)
// ============================================================
const generate4MReport = async (req, res) => {
    try {
        const { lineCode, partName, date, machineNo, shopId } = req.query;

        if (!lineCode) return res.status(400).json({ error: "lineCode is required" });

        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(50), lineCode);

        let query = `SELECT * FROM FourMChangeMonitoring WHERE lineCode = @lineCode`;

        if (partName) {
            query += ` AND partName = @partName`;
            request.input('partName', sql.NVarChar(255), partName);
        }
        if (date) {
            const cleanDate = String(date).split('T')[0];
            query += ` AND dateShift LIKE @dateFilter`;
            request.input('dateFilter', sql.NVarChar(100), `${cleanDate}%`);
        }
        if (machineNo) {
            query += ` AND mcNo = @mcFilter`;
            request.input('mcFilter', sql.NVarChar(100), machineNo);
        }
        if (shopId) {
            query += ` AND machineShop = @shopFilter`;
            request.input('shopFilter', sql.Int, parseInt(shopId, 10));
        }

        query += ` ORDER BY slNo ASC, id ASC`;

        const result = await request.query(query);
        const records = result.recordset;

        if (!records || records.length === 0) {
            return res.status(404).json({ error: "No records found" });
        }

        const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true, autoPageBreak: false });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=4M_Change_Record_${lineCode}.pdf`);
        doc.pipe(res);

        const startX = 20;
        let startY = 20;
        const totalWidth = 800;
        
        doc.lineWidth(0.5).strokeColor('black');

        // Header Boxes
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
        doc.font("Helvetica-Bold").fontSize(15).fillColor('black').text("4M CHANGE MONITORING CHECK SHEET", startX + 150, startY + 22, { width: titleBoxWidth, align: "center" });

        const metaX = startX + 150 + titleBoxWidth;
        doc.rect(metaX, startY, metaBoxWidth, headerTotalH).stroke();
        doc.moveTo(metaX, startY + 30).lineTo(metaX + metaBoxWidth, startY + 30).stroke();

        doc.font("Helvetica-Bold").fontSize(9.5);
        doc.text("LINE NAME", metaX + 8, startY + 10);
        doc.text(`:   ${lineCode || ''}`, metaX + 80, startY + 10);
        doc.text("PART NAME", metaX + 8, startY + 40); 
        
        doc.font("Helvetica").fontSize(8.5).text(`:   ${records[0]?.partName || ''}`, metaX + 80, startY + 37, { width: metaBoxWidth - 90, height: 20 });

        startY += headerTotalH + 10;

        // Table Header
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
                doc.text(h.label, curX, yPos + 4, { width: h.w, align: "center" });
                curX += h.w;
            });
            return yPos + 35;
        };

        let currentY = drawHeaders(startY);
        const checkCols = [4, 5, 7, 8, 9, 10];

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

            let rowH = 26;
            doc.font("Helvetica").fontSize(7);
            const descH = doc.heightOfString(rowData[3], { width: headers[3].w - 6 });
            if (descH + 12 > rowH) rowH = descH + 12;

            if (currentY + rowH > doc.page.height - 65) {
                doc.addPage();
                currentY = 20;
                currentY = drawHeaders(currentY);
            }

            let cX = startX;
            rowData.forEach((val, i) => {
                doc.rect(cX, currentY, headers[i].w, rowH).stroke();

                if (checkCols.includes(i)) {
                    const colCenter = cX + (headers[i].w / 2);
                    const rowCenter = currentY + (rowH / 2);

                    if (val === '✓' || val === '3') {
                        doc.save();
                        doc.lineWidth(1.6).strokeColor('#16a34a').lineCap('round').lineJoin('round');
                        doc.moveTo(colCenter - 5, rowCenter)
                           .lineTo(colCenter - 1.5, rowCenter + 4.5)
                           .lineTo(colCenter + 6, rowCenter - 4.5)
                           .stroke();
                        doc.restore();
                    } else if (val === 'X') {
                        doc.save();
                        doc.lineWidth(1.6).strokeColor('#dc2626').lineCap('round');
                        doc.moveTo(colCenter - 4, rowCenter - 4)
                           .lineTo(colCenter + 4, rowCenter + 4)
                           .stroke();
                        doc.moveTo(colCenter + 4, rowCenter - 4)
                           .lineTo(colCenter - 4, rowCenter + 4)
                           .stroke();
                        doc.restore();
                    } else {
                        doc.font("Helvetica").fontSize(7.5).fillColor('black');
                        doc.text(val || "-", cX, rowCenter - 4, { width: headers[i].w, align: "center" });
                    }
                } else if (i === 11) {
                    if (val && val !== '-') {
                        const midRow = currentY + (rowH / 2);
                        doc.font("Helvetica-Bold").fontSize(6.5).fillColor('#16a34a')
                           .text("Approved ✓", cX, midRow - 7, { width: headers[i].w, align: "center" });
                        doc.font("Helvetica-Bold").fontSize(6.5).fillColor('black')
                           .text(String(val).toUpperCase().substring(0, 12), cX, midRow + 2, { width: headers[i].w, align: "center" });
                    } else {
                        doc.font("Helvetica").fontSize(7.5).fillColor('black')
                           .text("-", cX, currentY + (rowH / 2) - 4, { width: headers[i].w, align: "center" });
                    }
                } else {
                    doc.font("Helvetica").fontSize(7).fillColor('black');
                    const textH = doc.heightOfString(val, { width: headers[i].w - 6 });
                    doc.text(val, cX + 3, currentY + (rowH / 2) - (textH / 2), { 
                        width: headers[i].w - 6, 
                        align: i === 3 ? "left" : "center" 
                    });
                }
                
                doc.fillColor('black');
                cX += headers[i].w;
            });

            currentY += rowH;
        });

        // --- FOOTER & HOD SIGNATURE VERIFICATION BLOCK ---
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
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor('black').text("HOD Sign: ", hodX + 10, currentY + 15);

        // Find true HOD status from actual record rows
        const currentHodSign = String(records[0]?.hodSign || '').trim();
        if (currentHodSign.toLowerCase().startsWith('approved')) {
            const cleanName = currentHodSign.replace(/approved\s*\(/i, '').replace(')', '').trim();
            doc.save();
            doc.lineWidth(1.6).strokeColor('#16a34a').lineCap('round').lineJoin('round');
            doc.moveTo(hodX + 70, currentY + 20).lineTo(hodX + 74, currentY + 24).lineTo(hodX + 80, currentY + 15).stroke();
            doc.restore();

            doc.fillColor('#16a34a').font("Helvetica-Bold").fontSize(9)
               .text(`APPROVED (${cleanName.toUpperCase()})`, hodX + 85, currentY + 15);
        } else if (currentHodSign.toLowerCase().startsWith('pending')) {
            const cleanName = currentHodSign.replace(/pending\s*\[/i, '').replace(']', '').trim();
            doc.fillColor('#dc2626').font("Helvetica-Bold").fontSize(9)
               .text(`Pending [${cleanName.toUpperCase()}]`, hodX + 70, currentY + 15);
        } else {
            doc.fillColor('red').font("Helvetica").fontSize(9).text("Pending Review", hodX + 70, currentY + 15);
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
    getFourMRecord,
    saveFourMChangeMonitoring,
    getPendingHODReports,
    signHODApproval,
    generate4MReport
};