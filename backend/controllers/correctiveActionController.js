const sql = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const getProductEngineers = async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT username AS name, username, employeeId
            FROM dbo.MachineShopUsers
            WHERE LOWER(role) IN ('pe', 'productengineer', 'productionengineer')
            ORDER BY username ASC
        `);
        return res.status(200).json({ peList: result.recordset || [] });
    } catch (error) {
        console.error('Get Product Engineers Error:', error);
        return res.status(500).json({ message: 'Failed to fetch Product Engineers' });
    }
};

/*
============================================================
GET PART NAMES
============================================================
*/
const getPartNames = async (req, res) => {
    try {
        const { shopId } = req.params;
        const machineShop = parseInt(shopId, 10);

        if (Number.isNaN(machineShop)) {
            return res.status(400).json({ message: 'Invalid shopId' });
        }

        const pool = await sql.connect();
        const result = await pool.request().query(`
            SELECT DISTINCT partName
            FROM M3PartSets
            WHERE partName IS NOT NULL
              AND LTRIM(RTRIM(partName)) <> ''
            ORDER BY partName ASC
        `);

        return res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Get Part Names Error:', error);
        return res.status(500).json({
            message: 'Failed to fetch part names',
            error: error.message
        });
    }
};

/*
============================================================
GET EXISTING CORRECTIVE ACTION RECORD (BY DATE + PART NAME)
============================================================
*/
const getRecord = async (req, res) => {
    try {
        const { machineShop, date, partName } = req.query;

        if (!machineShop || !date) {
            return res.status(400).json({ message: 'machineShop and date are required' });
        }

        const machineShopNumber = parseInt(machineShop, 10);
        if (Number.isNaN(machineShopNumber)) {
            return res.status(400).json({ message: 'Invalid machineShop' });
        }

        const cleanDate = String(date).split('T')[0];
        const pool = await sql.connect();

        let query = `
            SELECT
                id,
                machineShop,
                lineCode,
                recordDate,
                partName,
                problemDescription,
                problemCategory,
                quantity,
                rootCause,
                correctiveAction,
                result,
                operatorSignature,
                shiftInchargeSignature
            FROM CorrectiveActionRegister
            WHERE machineShop = @machineShop
              AND CAST(recordDate AS DATE) = @recordDate
        `;

        const request = pool.request();
        request.input('machineShop', sql.Int, machineShopNumber);
        request.input('recordDate', sql.Date, cleanDate);

        if (partName && partName.trim()) {
            request.input('partName', sql.NVarChar(200), partName.trim());
            query += ` AND partName = @partName`;
        }

        query += ` ORDER BY id ASC`;

        const result = await request.query(query);

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(200).json({ entries: [] });
        }

        const entries = result.recordset.map((row) => ({
            date: row.recordDate
                ? new Date(row.recordDate).toISOString().split('T')[0]
                : cleanDate,
            partName: row.partName || '',
            problemDescription: row.problemDescription || '',
            problemCategory: row.problemCategory || '',
            quantity: row.quantity ?? 1,
            rootCause: row.rootCause || '',
            correctiveAction: row.correctiveAction || '',
            result: row.result || 'OK',
            productEngineer: row.shiftInchargeSignature || '',
            signature: row.operatorSignature || ''
        }));

        return res.status(200).json({ entries, productEngineer: entries[0]?.productEngineer || '' });
    } catch (error) {
        console.error('Get corrective action record error:', error);
        return res.status(500).json({
            message: 'Failed to fetch corrective action record',
            error: error.message
        });
    }
};

/*
============================================================
SAVE CORRECTIVE ACTION RECORD
============================================================
*/
const saveRecord = async (req, res) => {
    let transaction;

    try {
        const machineShop = req.body.machineShop ?? req.body.shopId;
        const recordDate = req.body.recordDate ?? req.body.date;
        const entries = req.body.entries ?? req.body.rows;

        if (machineShop === undefined || machineShop === null || machineShop === '') {
            return res.status(400).json({ message: 'machineShop is required' });
        }

        if (!recordDate) {
            return res.status(400).json({ message: 'recordDate is required' });
        }

        if (!Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ message: 'At least one entry is required' });
        }

        const machineShopNumber = parseInt(machineShop, 10);
        if (Number.isNaN(machineShopNumber)) {
            return res.status(400).json({ message: 'Invalid machineShop' });
        }

        const cleanDate = String(recordDate).split('T')[0];
        const pool = await sql.connect();

        const preparedEntries = [];

        for (let index = 0; index < entries.length; index++) {
            const entry = entries[index];
            const entryDate = String(entry.date || recordDate).split('T')[0];
            const productEngineer = String(entry.productEngineer || '').trim();
            const partName =
                typeof entry.partName === 'object'
                    ? entry.partName?.partName || ''
                    : entry.partName || '';

            if (!partName.trim()) {
                return res.status(400).json({
                    message: `Part Name is required for row ${index + 1}`
                });
            }

            if (!entry.date) {
                return res.status(400).json({ message: `Date is required for row ${index + 1}` });
            }

            if (!productEngineer) {
                return res.status(400).json({ message: `Product Engineer selection is required for row ${index + 1}` });
            }

            if (!entry.problemCategory || !['A', 'B', 'C', 'D', 'E'].includes(entry.problemCategory)) {
                return res.status(400).json({
                    message: `Problem category (A, B, C, D, or E) is required for row ${index + 1}`
                });
            }

            const lineCode = '';

            preparedEntries.push({
                recordDate: entryDate,
                lineCode,
                partName,
                problemDescription: entry.problemDescription || '',
                problemCategory: entry.problemCategory,
                quantity: Number(entry.quantity) || 1,
                rootCause: entry.rootCause || '',
                correctiveAction: entry.correctiveAction || '',
                result: entry.result || 'OK',
                operatorSignature: '',
                shiftInchargeSignature: productEngineer
            });
        }

        transaction = new sql.Transaction(pool);
        await transaction.begin();

        for (const entry of preparedEntries) {
            await transaction
                .request()
                .input('machineShop', sql.Int, machineShopNumber)
                .input('recordDate', sql.Date, entry.recordDate)
                .input('partName', sql.NVarChar(200), entry.partName)
                .query(`
                    DELETE FROM CorrectiveActionRegister
                    WHERE machineShop = @machineShop
                      AND CAST(recordDate AS DATE) = @recordDate
                      AND partName = @partName
                `);
        }

        for (const entry of preparedEntries) {
            await transaction
                .request()
                .input('machineShop', sql.Int, machineShopNumber)
                .input('lineCode', sql.NVarChar(100), entry.lineCode)
                .input('recordDate', sql.Date, entry.recordDate)
                .input('partName', sql.NVarChar(200), entry.partName)
                .input('problemDescription', sql.NVarChar(sql.MAX), entry.problemDescription)
                .input('problemCategory', sql.NVarChar(10), entry.problemCategory)
                .input('quantity', sql.Int, entry.quantity)
                .input('rootCause', sql.NVarChar(sql.MAX), entry.rootCause)
                .input('correctiveAction', sql.NVarChar(sql.MAX), entry.correctiveAction)
                .input('result', sql.NVarChar(50), entry.result)
                .input('operatorSignature', sql.NVarChar(100), entry.operatorSignature)
                .input('shiftInchargeSignature', sql.NVarChar(100), entry.shiftInchargeSignature)
                .query(`
                    INSERT INTO CorrectiveActionRegister
                    (
                        machineShop,
                        lineCode,
                        recordDate,
                        partName,
                        problemDescription,
                        problemCategory,
                        quantity,
                        rootCause,
                        correctiveAction,
                        result,
                        operatorSignature,
                        shiftInchargeSignature
                    )
                    VALUES
                    (
                        @machineShop,
                        @lineCode,
                        @recordDate,
                        @partName,
                        @problemDescription,
                        @problemCategory,
                        @quantity,
                        @rootCause,
                        @correctiveAction,
                        @result,
                        @operatorSignature,
                        @shiftInchargeSignature
                    )
                `);
        }

        await transaction.commit();

        return res.status(200).json({
            message: 'Corrective Action Register saved successfully',
            machineShop: machineShopNumber,
            recordDate: cleanDate,
            rowsSaved: preparedEntries.length
        });
    } catch (error) {
        console.error('Save corrective action error:', error);
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError);
            }
        }

        return res.status(500).json({
            message: 'Failed to save corrective action record',
            error: error.message
        });
    }
};

const getPendingPeRecords = async (req, res) => {
    try {
        const productEngineer = String(req.params.name || '').trim();
        const machineShop = parseInt(req.query.shopId, 10);
        if (!productEngineer || Number.isNaN(machineShop)) {
            return res.status(400).json({ message: 'Product Engineer and shopId are required' });
        }
        const pool = await sql.connect();
        const result = await pool.request()
            .input('productEngineer', sql.NVarChar(100), productEngineer)
            .input('machineShop', sql.Int, machineShop)
            .query(`
                SELECT id, machineShop, lineCode, recordDate, partName, problemDescription,
                       problemCategory, quantity, rootCause, correctiveAction, result,
                       shiftInchargeSignature AS productEngineer
                FROM CorrectiveActionRegister
                WHERE machineShop = @machineShop
                  AND shiftInchargeSignature = @productEngineer
                  AND NULLIF(LTRIM(RTRIM(ISNULL(operatorSignature, ''))), '') IS NULL
                ORDER BY recordDate DESC, id ASC
            `);
        return res.status(200).json(result.recordset || []);
    } catch (error) {
        console.error('Get pending corrective action approvals error:', error);
        return res.status(500).json({ message: 'Failed to fetch pending corrective action approvals' });
    }
};

const signPeApproval = async (req, res) => {
    try {
        const id = parseInt(req.body.id, 10);
        const signature = String(req.body.signature || req.body.peUsername || '').trim();
        if (Number.isNaN(id) || !signature) {
            return res.status(400).json({ message: 'Record id and Product Engineer signature are required' });
        }
        const pool = await sql.connect();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('signature', sql.NVarChar(100), signature)
            .query(`
                UPDATE CorrectiveActionRegister
                SET operatorSignature = @signature
                WHERE id = @id
                  AND shiftInchargeSignature = @signature
                  AND NULLIF(LTRIM(RTRIM(ISNULL(operatorSignature, ''))), '') IS NULL;
                SELECT @@ROWCOUNT AS affectedRows;
            `);
        if (!result.recordset?.[0]?.affectedRows) {
            return res.status(404).json({ message: 'Pending approval was not found for this Product Engineer' });
        }
        return res.status(200).json({ message: 'Corrective Action Register row approved successfully' });
    } catch (error) {
        console.error('Sign corrective action approval error:', error);
        return res.status(500).json({ message: 'Failed to approve corrective action row' });
    }
};

/*
============================================================
GENERATE CORRECTIVE ACTION PDF (BY DATE RANGE) WITH DYNAMIC QF
============================================================
*/

const generatePdfReport = async (req, res) => {
    const { shopId, date, fromDate, toDate, partName } = req.query;
    const rangeStart = fromDate || date;
    const rangeEnd = toDate || date;

    if (!shopId || !rangeStart || !rangeEnd) {
        return res.status(400).json({ message: 'shopId, fromDate and toDate are required' });
    }
    if (new Date(rangeStart) > new Date(rangeEnd)) return res.status(400).json({ message: 'fromDate cannot be later than toDate' });

    const machineShop = parseInt(shopId, 10);
    if (Number.isNaN(machineShop)) {
        return res.status(400).json({ message: 'Invalid shopId' });
    }

    const cleanFromDate = String(rangeStart).split('T')[0];
    const cleanToDate = String(rangeEnd).split('T')[0];

    try {
        const pool = await sql.connect();

        // Format recordDate as string directly from SQL
        let query = `
            SELECT
                id,
                machineShop,
                lineCode,
                FORMAT(recordDate, 'yyyy-MM-dd') AS recordDate,
                partName,
                problemDescription,
                problemCategory,
                quantity,
                rootCause,
                correctiveAction,
                result,
                operatorSignature,
                shiftInchargeSignature
            FROM CorrectiveActionRegister
            WHERE machineShop = @machineShop
              AND CONVERT(date, recordDate) >= CONVERT(date, @fromDate)
              AND CONVERT(date, recordDate) <= CONVERT(date, @toDate)
        `;

        const request = pool.request();
        request.input('machineShop', sql.Int, machineShop);
        request.input('fromDate', sql.NVarChar(50), cleanFromDate);
        request.input('toDate', sql.NVarChar(50), cleanToDate);

        if (partName && partName.trim()) {
            request.input('partName', sql.NVarChar(200), partName.trim());
            query += ` AND partName = @partName`;
        }

        query += ` ORDER BY recordDate ASC, lineCode ASC, id ASC`;

        const result = await request.query(query);
        const records = result.recordset;

        if (!records || records.length === 0) {
            return res.status(404).json({
                message: 'No corrective action records found for the selected date range.'
            });
        }

        // --- Fetch QF History dynamically with formatted date ---
        let qfHistory = [];
        try {
            const qfRes = await sql.query(`
                SELECT id, formName, qfValue, FORMAT(date, 'yyyy-MM-dd') AS date 
                FROM CorrectiveActionQFvalues 
                ORDER BY date DESC, id DESC
            `);
            qfHistory = qfRes.recordset || [];
        } catch (qfErr) {
            console.error("Warning: Could not fetch CorrectiveActionQFvalues:", qfErr.message);
        }

        const getEffectiveQfValue = (recordDateStr) => {
            const fallback = "QF/08/MRO-04, Rev. No.:03 dt 20.08.2024";
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

        // Group records by unique compound key: lineCode + recordDate
        const groupedMap = new Map();
        records.forEach((r) => {
            const rawDate = r.recordDate ? String(r.recordDate).split('T')[0] : cleanFromDate;
            const groupKey = `${r.lineCode || 'ALL'}_${rawDate}`;
            if (!groupedMap.has(groupKey)) {
                groupedMap.set(groupKey, []);
            }
            groupedMap.get(groupKey).push(r);
        });

        const groups = Array.from(groupedMap.values());

        const doc = new PDFDocument({
            margin: 20,
            size: 'A4',
            layout: 'landscape',
            bufferPages: true,
            autoPageBreak: false
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="Corrective_Action_Register_${cleanFromDate}_to_${cleanToDate}.pdf"`
        );

        doc.pipe(res);

        const startX = 20;
        const totalWidth = doc.page.width - 40; // 802pt landscape width
        const pageBottom = doc.page.height - 20;
        const topMargin = 20;

        // Table layout definitions
        const headers = ["Sl No", "Part Name", "Problem Description", "Category (A-E)", "Qty", "Root Cause", "Corrective Action", "Result"];
        const colWidths = [35, 115, 145, 55, 35, 140, 150, 125];
        const pad = 3;
        const fontSize = 7.5;

        const formatSigText = (sig) => {
            if (!sig) return "";
            const trimmed = String(sig).trim();
            if (trimmed.toUpperCase() === "APPROVED") return "APPROVED";
            return `APPROVED (${trimmed.toUpperCase()})`;
        };

        const computeEntryHeight = (groupRecords) => {
            const headerH = 40;
            const tableHeaderH = 16;
            const sigBlockH = 36;
            const qfH = 20;
            let rowsTotalH = 0;

            doc.font("Helvetica").fontSize(fontSize);
            groupRecords.forEach((r, idx) => {
                const rowCells = [
                    String(idx + 1),
                    r.partName || "-",
                    r.problemDescription || "-",
                    r.problemCategory || "-",
                    String(r.quantity ?? "-"),
                    r.rootCause || "-",
                    r.correctiveAction || "-",
                    r.result || "-"
                ];
                let rowH = 16;
                rowCells.forEach((c, i) => {
                    const textH = doc.heightOfString(String(c), { width: colWidths[i] - pad * 2 }) + 4;
                    if (textH > rowH) rowH = textH;
                });
                rowsTotalH += rowH;
            });

            return headerH + 3 + tableHeaderH + rowsTotalH + sigBlockH + qfH + 15;
        };

        const drawEntry = (groupRecords, blockStartY) => {
            const first = groupRecords[0];
            const rawDate = first.recordDate ? String(first.recordDate).split('T')[0] : cleanFromDate;
            const [yy, mm, dd] = rawDate.split('-');
            const displayDate = yy && mm && dd ? `${dd}/${mm}/${yy}` : rawDate;
            
            // Dynamically evaluate QF value corresponding to this specific entry's date
            const effectiveQf = getEffectiveQfValue(rawDate);

            // 1. Header Box
            const headerH = 40;
            const logoWidth = 120;
            const rightWidth = 220;
            const midWidth = totalWidth - (logoWidth + rightWidth);

            doc.lineWidth(0.8).strokeColor('black');
            doc.rect(startX, blockStartY, logoWidth, headerH).stroke();

            const possibleLogoPaths = [
                path.join(__dirname, 'logo.jpg'),
                path.join(__dirname, '../logo.jpg'),
                path.join(process.cwd(), 'logo.jpg')
            ];
            const logoPath = possibleLogoPaths.find((f) => fs.existsSync(f));

            if (logoPath) {
                try {
                    doc.image(logoPath, startX + 5, blockStartY + 6, { width: 110, height: 28 });
                } catch {
                    doc.font("Helvetica-Bold").fontSize(9).fillColor('black').text("SAKTHI AUTO", startX, blockStartY + 14, { width: logoWidth, align: "center" });
                }
            } else {
                doc.font("Helvetica-Bold").fontSize(9).fillColor('black').text("SAKTHI AUTO", startX, blockStartY + 14, { width: logoWidth, align: "center" });
            }

            doc.rect(startX + logoWidth, blockStartY, midWidth, headerH).stroke();
            doc.font("Helvetica-Bold").fontSize(10).fillColor('black')
               .text("CORRECTIVE ACTION REGISTER", startX + logoWidth, blockStartY + 9, { width: midWidth, align: "center" });
            doc.font("Helvetica").fontSize(8).fillColor('black')
               .text(`LINE CODE: ${first.lineCode || '-'}`, startX + logoWidth, blockStartY + 24, { width: midWidth, align: "center" });

            const rightX = startX + totalWidth - rightWidth;
            doc.rect(rightX, blockStartY, rightWidth, headerH).stroke();
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor('black')
               .text(`MACHINE SHOP: ${machineShop}`, rightX + 6, blockStartY + 6, { width: rightWidth - 12 });
            doc.font("Helvetica").fontSize(7.5).fillColor('black')
               .text(`DATE: ${displayDate}`, rightX + 6, blockStartY + 22, { width: rightWidth - 12 });

            // 2. Table Header
            let currY = blockStartY + headerH + 3;
            doc.font("Helvetica-Bold").fontSize(fontSize);
            let colX = startX;
            headers.forEach((h, i) => {
                doc.rect(colX, currY, colWidths[i], 16).fillAndStroke('#e5e7eb', 'black');
                doc.fillColor('black').text(h, colX + pad, currY + 4, { width: colWidths[i] - pad * 2, align: "center" });
                colX += colWidths[i];
            });
            currY += 16;

            // 3. Table Rows
            doc.font("Helvetica").fontSize(fontSize);
            doc.lineWidth(0.5).strokeColor('black');

            groupRecords.forEach((r, idx) => {
                const rowCells = [
                    String(idx + 1),
                    r.partName || "-",
                    r.problemDescription || "-",
                    r.problemCategory || "-",
                    String(r.quantity ?? "-"),
                    r.rootCause || "-",
                    r.correctiveAction || "-",
                    r.result || "-"
                ];

                let rowH = 16;
                rowCells.forEach((c, i) => {
                    const textH = doc.heightOfString(String(c), { width: colWidths[i] - pad * 2 }) + 4;
                    if (textH > rowH) rowH = textH;
                });

                let rowX = startX;
                rowCells.forEach((c, i) => {
                    doc.rect(rowX, currY, colWidths[i], rowH).stroke();
                    doc.fillColor('black').text(String(c), rowX + pad, currY + 4, {
                        width: colWidths[i] - pad * 2,
                        align: i === 1 || i === 2 || i === 5 || i === 6 ? "left" : "center"
                    });
                    rowX += colWidths[i];
                });

                currY += rowH;
            });

            // 4. Signatures Block
            const sigY = currY + 4;
            const sigColWidth = totalWidth / 2;

            doc.lineWidth(0.5).strokeColor('black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(7.5).text("Operator Signature", startX, sigY, { width: sigColWidth - 10, align: "center" });
            doc.rect(startX + 10, sigY + 11, sigColWidth - 20, 22).stroke();
            const opSig = first.operatorSignature;
            if (opSig) {
                doc.lineWidth(1.2).strokeColor('#16a34a').moveTo(startX + 18, sigY + 22).lineTo(startX + 21, sigY + 26).lineTo(startX + 26, sigY + 17).stroke();
                doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(7).text(formatSigText(opSig), startX + 30, sigY + 18);
            } else {
                doc.fillColor('red').font('Helvetica').fontSize(7).text("Pending", startX + 10, sigY + 18, { width: sigColWidth - 20, align: "center" });
            }

            const inchargeX = startX + sigColWidth;
            doc.lineWidth(0.5).strokeColor('black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(7.5).text("Shift Incharge Signature", inchargeX, sigY, { width: sigColWidth - 10, align: "center" });
            doc.rect(inchargeX + 10, sigY + 11, sigColWidth - 20, 22).stroke();
            const incSig = first.shiftInchargeSignature;
            if (incSig) {
                doc.lineWidth(1.2).strokeColor('#16a34a').moveTo(inchargeX + 18, sigY + 22).lineTo(inchargeX + 21, sigY + 26).lineTo(inchargeX + 26, sigY + 17).stroke();
                doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(7).text(formatSigText(incSig), inchargeX + 30, sigY + 18);
            } else {
                doc.fillColor('red').font('Helvetica').fontSize(7).text("Pending", inchargeX + 10, sigY + 18, { width: sigColWidth - 20, align: "center" });
            }

            // 5. Print corresponding QF Value below signatures for this specific form block
            let qfY = sigY + 35;
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#374151')
                .text(`${effectiveQf} - Machine Shop Quality Assurance Register`, startX, qfY + 4, { align: 'left' });

            return qfY + 18;
        };

        // Render groups dynamically across pages
        let currentY = topMargin;
        let isFirstOnPage = true;

        groups.forEach((groupRecords) => {
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
                    .moveTo(startX, currentY - 6)
                    .lineTo(startX + totalWidth, currentY - 6)
                    .stroke()
                    .restore();
            }

            const endY = drawEntry(groupRecords, currentY);
            currentY = endY + 12;
            isFirstOnPage = false;
        });

        doc.end();
    } catch (error) {
        console.error('PDF generation error:', error);
        if (!res.headersSent) {
            return res.status(500).json({ message: 'PDF generation failed', error: error.message });
        }
    }
};
module.exports = {
    getPartNames,
    getProductEngineers,
    getRecord,
    saveRecord,
    getPendingPeRecords,
    signPeApproval,
    generatePdfReport
};