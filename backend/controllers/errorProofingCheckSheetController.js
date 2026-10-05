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
// 3. GENERATE DIRECT DOWNLOADABLE PDF REPORT
// ============================================================
const generateErrorProofingReport = async (req, res) => {
    const { lineCode, date, shopId } = req.query;

    if (!lineCode || !date) {
        return res.status(400).send("lineCode and date are required.");
    }

    try {
        const cleanDate = String(date).split('T')[0];
        const request = new sql.Request();
        request.input('lineCode', sql.NVarChar(50), lineCode);
        request.input('checkDate', sql.NVarChar(50), cleanDate);

        let query = `
            SELECT
                id, machineShop, lineCode, partName, partNo,
                FORMAT(checkDate, 'yyyy-MM-dd') AS checkDate,
                shift, slNo, machineNo, errorProofNo, errorProofName, value,
                operatorSignature, shiftInchargeSignature
            FROM ErrorProofingCheckSheet
            WHERE lineCode = @lineCode
              AND CONVERT(date, checkDate) = CONVERT(date, @checkDate)
        `;

        if (shopId) {
            request.input('machineShop', sql.Int, parseInt(shopId, 10));
            query += ` AND machineShop = @machineShop`;
        }

        query += ` ORDER BY slNo ASC, id ASC`;

        const result = await request.query(query);
        const records = result.recordset;

        if (!records || records.length === 0) {
            return res.status(404).send("No records found for the selected parameters.");
        }

        const first = records[0];
        const [yy, mm, dd] = String(first.checkDate).split('-');
        const displayDate = `${dd}/${mm}/${yy}`;

        const doc = new PDFDocument({ margin: 25, size: "A4", layout: "portrait", bufferPages: true, autoPageBreak: false });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=ErrorProofing_Checksheet_${lineCode}_${cleanDate}.pdf`);
        doc.pipe(res);

        const startX = 25;
        const headerY = 25;
        const totalWidth = doc.page.width - 50;
        const pageBottom = doc.page.height - 25;

        // Expanded header height to 56pt so long Part Names have ample vertical breathing room
        const headerH = 56;
        const logoWidth = 90;
        const rightWidth = 195;
        const midWidth = totalWidth - (logoWidth + rightWidth);

        // 1. Left: Company Logo Block
        doc.lineWidth(1).strokeColor('black');
        doc.rect(startX, headerY, logoWidth, headerH).stroke();

        const logoPath = path.join(__dirname, 'logo.jpg');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, startX + 6, headerY + 12, { width: 78, height: 32 });
        } else {
            doc.font("Helvetica-Bold").fontSize(10).fillColor('black').text("SAKTHI\nAUTO", startX, headerY + 18, { width: logoWidth, align: "center" });
        }

        // 2. Middle: Title & Line Block
        doc.rect(startX + logoWidth, headerY, midWidth, headerH).stroke();
        doc.font("Helvetica-Bold").fontSize(11).fillColor('black')
           .text("ERROR PROOFING CHECK SHEET", startX + logoWidth, headerY + 14, { width: midWidth, align: "center" });
        doc.font("Helvetica").fontSize(8.5).fillColor('black')
           .text(`LINE: ${lineCode}`, startX + logoWidth, headerY + 34, { width: midWidth, align: "center" });

        // 3. Right: Spacious Part Name, Part No, and Date Block
        const rightX = startX + totalWidth - rightWidth;
        doc.rect(rightX, headerY, rightWidth, headerH).stroke();

        const rightPad = 6;
        const textW = rightWidth - (rightPad * 2);

        doc.font("Helvetica-Bold").fontSize(7.5).fillColor('black')
           .text(`PART: ${first.partName || '-'}`, rightX + rightPad, headerY + 7, { 
               width: textW, 
               height: 18,
               ellipsis: true 
           });

        doc.font("Helvetica").fontSize(7.5).fillColor('black')
           .text(`PART NO: ${first.partNo || '-'}`, rightX + rightPad, headerY + 25, { 
               width: textW,
               ellipsis: true
           });

        doc.font("Helvetica").fontSize(7.5).fillColor('black')
           .text(`DATE: ${displayDate}`, rightX + rightPad, headerY + 41, { 
               width: textW 
           });

        // Table Columns
        const headers = ["Sl No", "Machine No", "Error Proof No", "Error Proof Name", "Value"];
        const fractions = [0.08, 0.20, 0.22, 0.38, 0.12];
        const colWidths = fractions.map(f => f * totalWidth);
        const pad = 4;
        const fontSize = 8;

        const drawHeader = (currY) => {
            doc.font("Helvetica-Bold").fontSize(fontSize);
            let x = startX;
            headers.forEach((h, i) => {
                doc.rect(x, currY, colWidths[i], 18).fillAndStroke('#f0f0f0', 'black');
                doc.fillColor('black').text(h, x + pad, currY + 5, { width: colWidths[i] - pad * 2, align: i === 3 ? "left" : "center" });
                x += colWidths[i];
            });
            return currY + 18;
        };

        let y = drawHeader(headerY + headerH + 8);

        doc.font("Helvetica").fontSize(fontSize);
        doc.lineWidth(0.5).strokeColor('black');

        records.forEach((r, idx) => {
            const rowCells = [
                String(idx + 1),
                r.machineNo || "-",
                r.errorProofNo || "-",
                r.errorProofName || "-",
                r.value || "-"
            ];

            let rowH = 18;
            rowCells.forEach((c, i) => {
                const textH = doc.heightOfString(String(c), { width: colWidths[i] - pad * 2 }) + 8;
                if (textH > rowH) rowH = textH;
            });

            if (y + rowH > pageBottom - 60) {
                doc.addPage();
                y = drawHeader(25);
                doc.font("Helvetica").fontSize(fontSize);
            }

            let x = startX;
            rowCells.forEach((c, i) => {
                doc.rect(x, y, colWidths[i], rowH).stroke();
                doc.fillColor('black').text(String(c), x + pad, y + 5, {
                    width: colWidths[i] - pad * 2,
                    align: i === 3 ? "left" : "center"
                });
                x += colWidths[i];
            });

            y += rowH;
        });

        // Signatures Block
        let sigY = y + 16;
        if (sigY + 50 > pageBottom) {
            doc.addPage();
            sigY = 30;
        }

        const sigColWidth = totalWidth / 2;

        // Operator Signature
        doc.lineWidth(0.5).strokeColor('black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("Operator Signature", startX, sigY, { width: sigColWidth - 10, align: "center" });
        doc.rect(startX + 10, sigY + 12, sigColWidth - 20, 28).stroke();
        const opSig = first.operatorSignature;
        if (opSig) {
            doc.lineWidth(1.5).strokeColor('#16a34a').moveTo(startX + 20, sigY + 26).lineTo(startX + 24, sigY + 31).lineTo(startX + 30, sigY + 20).stroke();
            doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(8).text(`APPROVED (${String(opSig).toUpperCase()})`, startX + 34, sigY + 22);
        } else {
            doc.fillColor('red').font('Helvetica').fontSize(8).text("Pending", startX + 10, sigY + 22, { width: sigColWidth - 20, align: "center" });
        }

        // Shift Incharge Signature
        const inchargeX = startX + sigColWidth;
        doc.lineWidth(0.5).strokeColor('black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("Shift Incharge Signature", inchargeX, sigY, { width: sigColWidth - 10, align: "center" });
        doc.rect(inchargeX + 10, sigY + 12, sigColWidth - 20, 28).stroke();
        const incSig = first.shiftInchargeSignature;
        if (incSig) {
            doc.lineWidth(1.5).strokeColor('#16a34a').moveTo(inchargeX + 20, sigY + 26).lineTo(inchargeX + 24, sigY + 31).lineTo(inchargeX + 30, sigY + 20).stroke();
            doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(8).text(`APPROVED (${String(incSig).toUpperCase()})`, inchargeX + 34, sigY + 22);
        } else {
            doc.fillColor('red').font('Helvetica').fontSize(8).text("Pending", inchargeX + 10, sigY + 22, { width: sigColWidth - 20, align: "center" });
        }

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