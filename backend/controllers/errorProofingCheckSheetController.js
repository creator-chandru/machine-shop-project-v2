const sql = require('../db.js');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ============================================================
// 1. SAVE / UPDATE ERROR PROOFING CHECKSHEET
// ============================================================
const saveErrorProofingChecksheet = async (req, res) => {
    const { header, rows, signatures } = req.body;
    let transaction;

    try {
        transaction = new sql.Transaction();
        await transaction.begin();

        const machineShop = parseInt(header.machineShop, 10) || 3;
        const lineCode = header.lineCode || header.line || '';
        const partName = header.partName || '';
        const partNo = header.partNo || '';
        const checkDate = header.date ? String(header.date).split('T')[0] : null;
        const shift = header.shift || 'I';

        const operatorSignature = signatures?.Operator || '';
        const shiftInchargeSignature = signatures?.["Shift Incharge"] || '';

        // Purge previous records for this compound key to prevent duplicates
        await transaction.request()
            .input('machineShop', sql.Int, machineShop)
            .input('lineCode', sql.NVarChar(50), lineCode)
            .input('checkDate', sql.Date, checkDate)
            .query(`
                DELETE FROM ErrorProofingCheckSheet
                WHERE machineShop = @machineShop
                  AND lineCode = @lineCode
                  AND CONVERT(date, checkDate) = CONVERT(date, @checkDate)
            `);

        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
            const row = rows[rowIdx];

            await transaction.request()
                .input('machineShop', sql.Int, machineShop)
                .input('lineCode', sql.NVarChar(50), lineCode)
                .input('partName', sql.NVarChar(200), partName)
                .input('partNo', sql.NVarChar(100), partNo)
                .input('checkDate', sql.Date, checkDate)
                .input('shift', sql.NVarChar(10), shift)
                .input('slNo', sql.Int, rowIdx + 1)
                .input('machineNo', sql.NVarChar(50), row.machineNo || '')
                .input('errorProofNo', sql.NVarChar(50), row.errorProofNo || '')
                .input('errorProofName', sql.NVarChar(255), row.errorProofName || '')
                .input('value', sql.NVarChar(50), row.value || '')
                .input('operatorSignature', sql.NVarChar(100), operatorSignature)
                .input('shiftInchargeSignature', sql.NVarChar(100), shiftInchargeSignature)
                .query(`
                    INSERT INTO ErrorProofingCheckSheet
                    (
                        machineShop, lineCode, partName, partNo, checkDate, shift,
                        slNo, machineNo, errorProofNo, errorProofName, value,
                        operatorSignature, shiftInchargeSignature
                    )
                    VALUES
                    (
                        @machineShop, @lineCode, @partName, @partNo, @checkDate, @shift,
                        @slNo, @machineNo, @errorProofNo, @errorProofName, @value,
                        @operatorSignature, @shiftInchargeSignature
                    )
                `);
        }

        await transaction.commit();
        res.status(201).json({ message: 'CheckSheet saved successfully!' });

    } catch (err) {
        console.error('Error saving Error Proofing Checksheet:', err);
        if (transaction) {
            try { await transaction.rollback(); } catch (e) {}
        }
        res.status(500).json({ error: 'Failed to save checkSheet' });
    }
};

// ============================================================
// 2. GET EXISTING ERROR PROOFING CHECKSHEET BY DATE & LINE
// ============================================================
const getErrorProofingRecord = async (req, res) => {
    const { machineShop, lineCode, date } = req.query;

    if (!lineCode || !date) {
        return res.status(400).json({ error: 'lineCode and date are required' });
    }

    try {
        const cleanDate = String(date).split('T')[0];
        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(50), lineCode);
        request.input('checkDate', sql.NVarChar(50), cleanDate);

        let shopFilter = '';
        if (machineShop) {
            request.input('machineShop', sql.Int, parseInt(machineShop, 10));
            shopFilter = ' AND machineShop = @machineShop';
        }

        const query = `
            SELECT
                id, machineShop, lineCode, partName, partNo,
                FORMAT(checkDate, 'yyyy-MM-dd') AS checkDate,
                shift, slNo, machineNo, errorProofNo, errorProofName, value,
                operatorSignature, shiftInchargeSignature
            FROM ErrorProofingCheckSheet
            WHERE lineCode = @lineCode
              AND CONVERT(date, checkDate) = CONVERT(date, @checkDate)
              ${shopFilter}
            ORDER BY slNo ASC, id ASC
        `;

        const result = await request.query(query);
        const records = result.recordset;

        if (!records || records.length === 0) {
            return res.status(200).json(null);
        }

        const first = records[0];
        const rows = records.map((r) => ({
            machineNo: r.machineNo || '',
            errorProofNo: r.errorProofNo || '',
            errorProofName: r.errorProofName || '',
            value: r.value || ''
        }));

        const structuredRecord = {
            header: {
                machineShop: first.machineShop,
                lineCode: first.lineCode,
                partName: first.partName || '',
                partNo: first.partNo || '',
                date: first.checkDate,
                shift: first.shift || 'I'
            },
            rows,
            signatures: {
                Operator: first.operatorSignature || '',
                "Shift Incharge": first.shiftInchargeSignature || ''
            }
        };

        return res.status(200).json(structuredRecord);
    } catch (err) {
        console.error('Error fetching Error Proofing Record:', err);
        return res.status(500).json({ error: 'Failed to fetch Error Proofing record' });
    }
};

// ============================================================
// 3. GENERATE DIRECT DOWNLOADABLE PDF REPORT (DATE RANGE & DYNAMIC FIT)
// ============================================================
const generateErrorProofingReport = async (req, res) => {
    const { fromDate, toDate, shopId } = req.query;

    if (!fromDate || !toDate) {
        return res.status(400).send("fromDate and toDate are required.");
    }

    try {
        const cleanFromDate = String(fromDate).split('T')[0];
        const cleanToDate = String(toDate).split('T')[0];
        const targetShopId = parseInt(shopId || 3, 10);

        const request = new sql.Request();
        request.input('fromDate', sql.NVarChar(50), cleanFromDate);
        request.input('toDate', sql.NVarChar(50), cleanToDate);
        request.input('machineShop', sql.Int, targetShopId);

        const query = `
            SELECT
                id, machineShop, lineCode, partName, partNo,
                FORMAT(checkDate, 'yyyy-MM-dd') AS checkDate,
                shift, slNo, machineNo, errorProofNo, errorProofName, value,
                operatorSignature, shiftInchargeSignature
            FROM ErrorProofingCheckSheet
            WHERE machineShop = @machineShop
              AND CONVERT(date, checkDate) >= CONVERT(date, @fromDate)
              AND CONVERT(date, checkDate) <= CONVERT(date, @toDate)
            ORDER BY checkDate ASC, lineCode ASC, slNo ASC, id ASC
        `;

        const result = await request.query(query);
        const records = result.recordset;

        if (!records || records.length === 0) {
            return res.status(404).send("No records found for the selected date range.");
        }

        // Group records by unique compound key: lineCode + checkDate
        const groupedMap = new Map();
        records.forEach((r) => {
            const groupKey = `${r.lineCode}_${r.checkDate}`;
            if (!groupedMap.has(groupKey)) {
                groupedMap.set(groupKey, []);
            }
            groupedMap.get(groupKey).push(r);
        });

        const groups = Array.from(groupedMap.values());

        const doc = new PDFDocument({ margin: 20, size: "A4", layout: "portrait", bufferPages: true, autoPageBreak: false });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=ErrorProofing_Checksheet_Report_${cleanFromDate}_to_${cleanToDate}.pdf`);
        doc.pipe(res);

        const startX = 20;
        const totalWidth = doc.page.width - 40; // 555pt
        const pageBottom = doc.page.height - 20;
        const topMargin = 20;

        // Table layout definitions
        const headers = ["Sl No", "Machine No", "Error Proof No", "Error Proof Name", "Value"];
        const fractions = [0.08, 0.20, 0.22, 0.38, 0.12];
        const colWidths = fractions.map(f => f * totalWidth);
        const pad = 3;
        const fontSize = 7.5;

        const formatSigText = (sig) => {
            if (!sig) return "";
            const trimmed = String(sig).trim();
            if (trimmed.toUpperCase() === "APPROVED") return "APPROVED";
            return `APPROVED (${trimmed.toUpperCase()})`;
        };

        // Helper to calculate total height needed for a single entry
        const computeEntryHeight = (groupRecords) => {
            const headerH = 40;
            const tableHeaderH = 14;
            const sigBlockH = 36;
            let rowsTotalH = 0;

            doc.font("Helvetica").fontSize(fontSize);
            groupRecords.forEach((r, idx) => {
                const rowCells = [
                    String(idx + 1),
                    r.machineNo || "-",
                    r.errorProofNo || "-",
                    r.errorProofName || "-",
                    r.value || "-"
                ];
                let rowH = 14;
                rowCells.forEach((c, i) => {
                    const textH = doc.heightOfString(String(c), { width: colWidths[i] - pad * 2 }) + 4;
                    if (textH > rowH) rowH = textH;
                });
                rowsTotalH += rowH;
            });

            return headerH + 3 + tableHeaderH + rowsTotalH + sigBlockH + 10;
        };

        // Helper to draw an entry at a given Y position
        const drawEntry = (groupRecords, blockStartY) => {
            const first = groupRecords[0];
            const [yy, mm, dd] = String(first.checkDate).split('-');
            const displayDate = `${dd}/${mm}/${yy}`;

            // 1. Header Box
            const headerH = 40;
            const logoWidth = 80;
            const rightWidth = 175;
            const midWidth = totalWidth - (logoWidth + rightWidth);

            doc.lineWidth(0.8).strokeColor('black');
            doc.rect(startX, blockStartY, logoWidth, headerH).stroke();

            const logoPath = path.join(__dirname, 'logo.jpg');
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, startX + 5, blockStartY + 6, { width: 70, height: 28 });
            } else {
                doc.font("Helvetica-Bold").fontSize(9).fillColor('black').text("SAKTHI\nAUTO", startX, blockStartY + 9, { width: logoWidth, align: "center" });
            }

            doc.rect(startX + logoWidth, blockStartY, midWidth, headerH).stroke();
            doc.font("Helvetica-Bold").fontSize(9).fillColor('black')
               .text("ERROR PROOFING CHECK SHEET", startX + logoWidth, blockStartY + 8, { width: midWidth, align: "center" });
            doc.font("Helvetica").fontSize(7.5).fillColor('black')
               .text(`LINE: ${first.lineCode}`, startX + logoWidth, blockStartY + 24, { width: midWidth, align: "center" });

            const rightX = startX + totalWidth - rightWidth;
            doc.rect(rightX, blockStartY, rightWidth, headerH).stroke();
            doc.font("Helvetica-Bold").fontSize(6.5).fillColor('black')
               .text(`PART: ${String(first.partName || '-').substring(0, 32)}`, rightX + 4, blockStartY + 4, { width: rightWidth - 8, height: 12, ellipsis: true });
            doc.font("Helvetica").fontSize(6.5).fillColor('black')
               .text(`PART NO: ${first.partNo || '-'}`, rightX + 4, blockStartY + 16, { width: rightWidth - 8, height: 10, ellipsis: true });
            doc.font("Helvetica").fontSize(6.5).fillColor('black')
               .text(`DATE: ${displayDate}`, rightX + 4, blockStartY + 27, { width: rightWidth - 8 });

            // 2. Table Header
            let currY = blockStartY + headerH + 3;
            doc.font("Helvetica-Bold").fontSize(fontSize);
            let colX = startX;
            headers.forEach((h, i) => {
                doc.rect(colX, currY, colWidths[i], 14).fillAndStroke('#f0f0f0', 'black');
                doc.fillColor('black').text(h, colX + pad, currY + 3, { width: colWidths[i] - pad * 2, align: i === 3 ? "left" : "center" });
                colX += colWidths[i];
            });
            currY += 14;

            // 3. Table Rows
            doc.font("Helvetica").fontSize(fontSize);
            doc.lineWidth(0.5).strokeColor('black');

            groupRecords.forEach((r, idx) => {
                const rowCells = [
                    String(idx + 1),
                    r.machineNo || "-",
                    r.errorProofNo || "-",
                    r.errorProofName || "-",
                    r.value || "-"
                ];

                let rowH = 14;
                rowCells.forEach((c, i) => {
                    const textH = doc.heightOfString(String(c), { width: colWidths[i] - pad * 2 }) + 4;
                    if (textH > rowH) rowH = textH;
                });

                let rowX = startX;
                rowCells.forEach((c, i) => {
                    doc.rect(rowX, currY, colWidths[i], rowH).stroke();
                    doc.fillColor('black').text(String(c), rowX + pad, currY + 3, {
                        width: colWidths[i] - pad * 2,
                        align: i === 3 ? "left" : "center"
                    });
                    rowX += colWidths[i];
                });

                currY += rowH;
            });

            // 4. Signatures Block
            const sigY = currY + 4;
            const sigColWidth = totalWidth / 2;

            // Operator Signature
            doc.lineWidth(0.5).strokeColor('black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(7).text("Operator Signature", startX, sigY, { width: sigColWidth - 10, align: "center" });
            doc.rect(startX + 10, sigY + 10, sigColWidth - 20, 22).stroke();
            const opSig = first.operatorSignature;
            if (opSig) {
                doc.lineWidth(1.2).strokeColor('#16a34a').moveTo(startX + 18, sigY + 21).lineTo(startX + 21, sigY + 25).lineTo(startX + 26, sigY + 16).stroke();
                doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(7).text(formatSigText(opSig), startX + 30, sigY + 17);
            } else {
                doc.fillColor('red').font('Helvetica').fontSize(7).text("Pending", startX + 10, sigY + 17, { width: sigColWidth - 20, align: "center" });
            }

            // Shift Incharge Signature
            const inchargeX = startX + sigColWidth;
            doc.lineWidth(0.5).strokeColor('black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(7).text("Shift Incharge Signature", inchargeX, sigY, { width: sigColWidth - 10, align: "center" });
            doc.rect(inchargeX + 10, sigY + 10, sigColWidth - 20, 22).stroke();
            const incSig = first.shiftInchargeSignature;
            if (incSig) {
                doc.lineWidth(1.2).strokeColor('#16a34a').moveTo(inchargeX + 18, sigY + 21).lineTo(inchargeX + 21, sigY + 25).lineTo(inchargeX + 26, sigY + 16).stroke();
                doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(7).text(formatSigText(incSig), inchargeX + 30, sigY + 17);
            } else {
                doc.fillColor('red').font('Helvetica').fontSize(7).text("Pending", inchargeX + 10, sigY + 17, { width: sigColWidth - 20, align: "center" });
            }

            return sigY + 32;
        };

        // Render groups: dynamically pack as many as fit on each page
        let currentY = topMargin;
        let isFirstOnPage = true;

        groups.forEach((groupRecords, gIdx) => {
            const entryH = computeEntryHeight(groupRecords);

            // If entry won't fit on the current page, create a new page
            if (!isFirstOnPage && (currentY + entryH > pageBottom)) {
                doc.addPage();
                currentY = topMargin;
                isFirstOnPage = true;
            }

            // Draw divider between multiple entries on the same page
            if (!isFirstOnPage) {
                doc.save()
                   .lineWidth(0.5)
                   .dash(3, { space: 3 })
                   .strokeColor('#9ca3af')
                   .moveTo(startX, currentY - 5)
                   .lineTo(startX + totalWidth, currentY - 5)
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
        if (!res.headersSent) {
            res.status(500).json({ message: "PDF generation failed" });
        } else {
            res.end();
        }
    }
};

module.exports = {
    saveErrorProofingChecksheet,
    getErrorProofingRecord,
    generateErrorProofingReport
};