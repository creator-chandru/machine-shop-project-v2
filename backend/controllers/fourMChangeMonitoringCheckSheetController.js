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
// FETCH EXISTING 4M RECORD (BY LINE, MACHINE, DATE, AND SHIFT)
// ============================================================
const getFourMRecord = async (req, res) => {
    const { machineShop, lineCode, machineNo, date, shift } = req.query;

    if (!lineCode || !machineNo || !date) {
        return res.status(400).json({ error: "lineCode, machineNo, and date are required" });
    }

    try {
        const cleanDate = String(date).split('T')[0];
        const targetShift = (shift || "I").trim();
        const dateShiftFilter = `${cleanDate} ${targetShift}%`;

        const request = new sql.Request();
        request.input("lineCode", sql.NVarChar(100), lineCode);
        request.input("mcNo", sql.NVarChar(100), machineNo);
        request.input("dateShiftFilter", sql.NVarChar(100), dateShiftFilter);

        let shopFilter = "";
        if (machineShop) {
            request.input("machineShop", sql.Int, parseInt(machineShop, 10));
            shopFilter = " AND machineShop = @machineShop";
        }

        const query = `
            SELECT * FROM FourMChangeMonitoring
            WHERE lineCode = @lineCode
              AND mcNo = @mcNo
              AND dateShift LIKE @dateShiftFilter
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
            const rowShift = dateParts[1] || targetShift;

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
            hodSign: first.hodSign || ""
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
        const targetShift = rows[0]?.shift || 'I';
        const targetMc = rows.find(r => r.mcNo)?.mcNo || headerInfo.machineNo || '';

        // Safe purge based on exact lineCode + machineNo + date + shift combo
        if (targetDate && targetMc) {
            await transaction.request()
                .input("machineShop", sql.Int, Number(headerInfo.machineShop))
                .input("lineCode", sql.NVarChar(100), headerInfo.lineCode)
                .input("mcNo", sql.NVarChar(100), targetMc)
                .input("dateShiftFilter", sql.NVarChar(100), `${targetDate} ${targetShift}%`)
                .query(`
                    DELETE FROM FourMChangeMonitoring
                    WHERE machineShop = @machineShop
                      AND lineCode = @lineCode
                      AND mcNo = @mcNo
                      AND dateShift LIKE @dateShiftFilter
                `);
        }

        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            const request = new sql.Request(transaction);

            request.input("machineShop", sql.Int, Number(headerInfo.machineShop))
                   .input("lineCode", sql.NVarChar(100), headerInfo.lineCode)
                   .input("partName", sql.NVarChar(255), headerInfo.partName)
                   .input("slNo", sql.Int, row.slNo ? Number(row.slNo) : index + 1)
                   .input("dateShift", sql.NVarChar(100), row.dateShift || `${row.date || targetDate} ${row.shift || targetShift}`.trim())
                   .input("mcNo", sql.NVarChar(100), row.mcNo || targetMc)
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
// GENERATE PDF (DATE RANGE, VECTOR SYMBOLS, MULTI-ENTRY DYNAMIC FIT)
// ============================================================
const generate4MReport = async (req, res) => {
    try {
        const { fromDate, toDate, shopId } = req.query;

        if (!fromDate || !toDate) {
            return res.status(400).json({ error: "fromDate and toDate are required." });
        }

        const cleanFromDate = String(fromDate).split('T')[0];
        const cleanToDate = String(toDate).split('T')[0];
        const targetShopId = parseInt(shopId || 3, 10);

        const request = new sql.Request();
        request.input('fromDate', sql.NVarChar(50), cleanFromDate);
        request.input('toDate', sql.NVarChar(50), cleanToDate);
        request.input('machineShop', sql.Int, targetShopId);

        const query = `
            SELECT * FROM FourMChangeMonitoring 
            WHERE machineShop = @machineShop
              AND LEFT(LTRIM(dateShift), 10) >= @fromDate
              AND LEFT(LTRIM(dateShift), 10) <= @toDate
            ORDER BY dateShift ASC, lineCode ASC, mcNo ASC, slNo ASC, id ASC
        `;

        const result = await request.query(query);
        const records = result.recordset;

        if (!records || records.length === 0) {
            return res.status(404).json({ error: "No records found for the selected date range." });
        }

        // Group records by unique combo: lineCode + mcNo + date + shift
        const groupedMap = new Map();
        records.forEach(r => {
            const parts = String(r.dateShift || "").trim().split(" ");
            const rDate = parts[0] || "";
            const rShift = parts[1] || "I";
            const groupKey = `${r.lineCode}_${r.mcNo}_${rDate}_${rShift}`;
            if (!groupedMap.has(groupKey)) {
                groupedMap.set(groupKey, []);
            }
            groupedMap.get(groupKey).push(r);
        });

        const groups = Array.from(groupedMap.values());

        const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true, autoPageBreak: false });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=4M_Change_Report_${cleanFromDate}_to_${cleanToDate}.pdf`);
        doc.pipe(res);

        const startX = 20;
        const totalWidth = doc.page.width - 40; // 801.89pt landscape width
        const pageBottom = doc.page.height - 20;
        const topMargin = 20;

        // Table column definitions
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

        const checkCols = [4, 5, 7, 8, 9, 10];

        // Clean vector checkmark
        const drawCheckMark = (colCenter, rowCenter) => {
            doc.save();
            doc.lineWidth(1.6).strokeColor('#16a34a').lineCap('round').lineJoin('round');
            doc.moveTo(colCenter - 5, rowCenter)
               .lineTo(colCenter - 1.5, rowCenter + 4.5)
               .lineTo(colCenter + 6, rowCenter - 4.5)
               .stroke();
            doc.restore();
        };

        // Clean vector crossmark
        const drawCrossMark = (colCenter, rowCenter) => {
            doc.save();
            doc.lineWidth(1.6).strokeColor('#dc2626').lineCap('round');
            doc.moveTo(colCenter - 4, rowCenter - 4)
               .lineTo(colCenter + 4, rowCenter + 4)
               .stroke();
            doc.moveTo(colCenter + 4, rowCenter - 4)
               .lineTo(colCenter - 4, rowCenter + 4)
               .stroke();
            doc.restore();
        };

        // Precompute total height of an entry block
        const computeEntryHeight = (groupRecords) => {
            const headerTotalH = 50;
            const tableHeadersH = 30;
            const footerH = 36;
            let rowsH = 0;

            doc.font("Helvetica").fontSize(7);
            groupRecords.forEach(r => {
                let rowH = 22;
                const descH = doc.heightOfString(r.description || "-", { width: headers[3].w - 6 });
                if (descH + 8 > rowH) rowH = descH + 8;
                rowsH += rowH;
            });

            return headerTotalH + 5 + tableHeadersH + rowsH + footerH + 10;
        };

        // Render one full entry block
        const drawEntry = (groupRecords, entryY) => {
            const first = groupRecords[0];

            // 1. Header Box (50pt)
            const headerTotalH = 50;
            const metaBoxWidth = 320;
            const logoBoxWidth = 130;
            const titleBoxWidth = totalWidth - logoBoxWidth - metaBoxWidth;

            doc.lineWidth(0.6).strokeColor('black');

            // Logo
            doc.rect(startX, entryY, logoBoxWidth, headerTotalH).stroke();
            const logoPath = path.join(__dirname, 'logo.jpg');
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, startX + 10, entryY + 8, { width: 110, height: 34, fit: [110, 34], align: 'center', valign: 'center' });
            } else {
                doc.font("Helvetica-Bold").fontSize(11).fillColor('black').text("SAKTHI AUTO", startX, entryY + 18, { width: logoBoxWidth, align: "center" });
            }

            // Title
            doc.rect(startX + logoBoxWidth, entryY, titleBoxWidth, headerTotalH).stroke();
            doc.font("Helvetica-Bold").fontSize(13).fillColor('black').text("4M CHANGE MONITORING CHECK SHEET", startX + logoBoxWidth, entryY + 18, { width: titleBoxWidth, align: "center" });

            // Line & Part Info
            const metaX = startX + logoBoxWidth + titleBoxWidth;
            doc.rect(metaX, entryY, metaBoxWidth, headerTotalH).stroke();
            doc.moveTo(metaX, entryY + 25).lineTo(metaX + metaBoxWidth, entryY + 25).stroke();

            doc.font("Helvetica-Bold").fontSize(8.5).fillColor('black');
            doc.text("LINE NAME", metaX + 8, entryY + 8);
            doc.text(`:   ${first.lineCode || ''}`, metaX + 70, entryY + 8);
            doc.text("PART NAME", metaX + 8, entryY + 33);
            doc.font("Helvetica").fontSize(8).text(`:   ${first.partName || ''}`, metaX + 70, entryY + 31, { width: metaBoxWidth - 75, height: 16, ellipsis: true });

            let currY = entryY + headerTotalH + 4;

            // 2. Table Headers (30pt)
            doc.rect(startX, currY, totalWidth, 30).fillAndStroke('#e5e7eb', 'black');
            let curX = startX;
            doc.font("Helvetica-Bold").fontSize(6.5).fillColor('black');
            headers.forEach(h => {
                doc.rect(curX, currY, h.w, 30).stroke();
                doc.text(h.label, curX, currY + 3, { width: h.w, align: "center" });
                curX += h.w;
            });
            currY += 30;

            // 3. Table Rows
            groupRecords.forEach(r => {
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

                let rowH = 22;
                doc.font("Helvetica").fontSize(7);
                const descH = doc.heightOfString(rowData[3], { width: headers[3].w - 6 });
                if (descH + 8 > rowH) rowH = descH + 8;

                let cX = startX;
                rowData.forEach((val, i) => {
                    doc.rect(cX, currY, headers[i].w, rowH).stroke();

                    if (checkCols.includes(i)) {
                        const colCenter = cX + (headers[i].w / 2);
                        const rowCenter = currY + (rowH / 2);

                        if (val === '✓' || val === '3' || String(val).toLowerCase() === 'ok') {
                            drawCheckMark(colCenter, rowCenter);
                        } else if (val === 'X' || val === 'x' || String(val).toLowerCase() === 'notok') {
                            drawCrossMark(colCenter, rowCenter);
                        } else {
                            doc.font("Helvetica").fontSize(7).fillColor('black');
                            doc.text(val || "-", cX, rowCenter - 4, { width: headers[i].w, align: "center" });
                        }
                    } else if (i === 11) {
                        const midRow = currY + (rowH / 2);
                        if (val && val !== '-') {
                            doc.font("Helvetica-Bold").fontSize(6).fillColor('#16a34a')
                               .text("Approved ✓", cX, midRow - 6, { width: headers[i].w, align: "center" });
                            doc.font("Helvetica-Bold").fontSize(6).fillColor('black')
                               .text(String(val).toUpperCase().substring(0, 12), cX, midRow + 2, { width: headers[i].w, align: "center" });
                        } else {
                            doc.font("Helvetica").fontSize(7).fillColor('black')
                               .text("-", cX, midRow - 4, { width: headers[i].w, align: "center" });
                        }
                    } else {
                        doc.font("Helvetica").fontSize(6.5).fillColor('black');
                        const textH = doc.heightOfString(val, { width: headers[i].w - 6 });
                        doc.text(val, cX + 3, currY + (rowH / 2) - (textH / 2), { 
                            width: headers[i].w - 6, 
                            align: i === 3 ? "left" : "center" 
                        });
                    }

                    cX += headers[i].w;
                });

                currY += rowH;
            });

            // 4. Footer & HOD Sign Block (32pt)
            currY += 4;
            const footerH = 32;
            doc.lineWidth(0.5).strokeColor('black');
            doc.rect(startX, currY, totalWidth - 250, footerH).stroke();
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor('black').text("QF / 07 / MPD-36, Rev.No: 01, 13.03.2019", startX + 10, currY + 12);

            const hodX = startX + totalWidth - 250;
            doc.rect(hodX, currY, 250, footerH).stroke();
            doc.font("Helvetica-Bold").fontSize(8.5).fillColor('black').text("HOD Sign: ", hodX + 10, currY + 11);

            const currentHodSign = String(first.hodSign || '').trim();
            if (currentHodSign.toLowerCase().startsWith('approved')) {
                const cleanName = currentHodSign.replace(/approved\s*\(/i, '').replace(')', '').trim();
                drawCheckMark(hodX + 66, currY + 16);
                doc.fillColor('#16a34a').font("Helvetica-Bold").fontSize(8)
                   .text(`APPROVED (${cleanName.toUpperCase()})`, hodX + 75, currY + 11);
            } else if (currentHodSign.toLowerCase().startsWith('pending')) {
                const cleanName = currentHodSign.replace(/pending\s*\[/i, '').replace(']', '').trim();
                doc.fillColor('#dc2626').font("Helvetica-Bold").fontSize(8)
                   .text(`Pending [${cleanName.toUpperCase()}]`, hodX + 65, currY + 11);
            } else {
                doc.fillColor('red').font("Helvetica").fontSize(8).text("Pending Review", hodX + 65, currY + 11);
            }

            return currY + footerH;
        };

        // Render entries with dynamic page fitting
        let currentY = topMargin;
        let isFirstOnPage = true;

        groups.forEach(groupRecords => {
            const entryH = computeEntryHeight(groupRecords);

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
    getFourMChangeMonitoringDetails,
    getFourMChangeMonitoringLineDetails,
    getHODUsers,
    getFourMRecord,
    saveFourMChangeMonitoring,
    getPendingHODReports,
    signHODApproval,
    generate4MReport
};