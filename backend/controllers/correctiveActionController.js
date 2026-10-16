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
    try {
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
              AND CAST(recordDate AS DATE) BETWEEN @fromDate AND @toDate
        `;

        const request = pool.request();
        request.input('machineShop', sql.Int, machineShop);
        request.input('fromDate', sql.Date, cleanFromDate);
        request.input('toDate', sql.Date, cleanToDate);

        if (partName && partName.trim()) {
            request.input('partName', sql.NVarChar(200), partName.trim());
            query += ` AND partName = @partName`;
        }

        query += ` ORDER BY id ASC`;

        const result = await request.query(query);
        const records = result.recordset;

        if (!records || records.length === 0) {
            return res.status(404).json({
                message: 'No corrective action records found for the selected date range.'
            });
        }

        // --- Fetch QF History dynamically ---
        let qfHistory = [];
        try {
            const qfRes = await sql.query(`
                SELECT id, formName, qfValue, date 
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
        let startY = 20;
        const totalWidth = 800;

        doc.lineWidth(0.5).strokeColor('black');

        // Header Block
        const logoBoxWidth = 140;
        const metaBoxWidth = 220;
        const titleBoxWidth = totalWidth - logoBoxWidth - metaBoxWidth;
        const headerHeight = 52;

        doc.rect(startX, startY, logoBoxWidth, headerHeight).stroke();
        const possibleLogoPaths = [
            path.join(__dirname, 'logo.jpg'),
            path.join(__dirname, '../logo.jpg'),
            path.join(process.cwd(), 'logo.jpg')
        ];
        const logoPath = possibleLogoPaths.find((f) => fs.existsSync(f));

        if (logoPath) {
            try {
                doc.image(logoPath, startX + 10, startY + 8, {
                    fit: [120, 36],
                    align: 'center',
                    valign: 'center'
                });
            } catch {
                doc.font('Helvetica-Bold').fontSize(11).text('SAKTHI AUTO', startX, startY + 20, {
                    width: logoBoxWidth,
                    align: 'center'
                });
            }
        } else {
            doc.font('Helvetica-Bold').fontSize(11).text('SAKTHI AUTO', startX, startY + 20, {
                width: logoBoxWidth,
                align: 'center'
            });
        }

        doc.rect(startX + logoBoxWidth, startY, titleBoxWidth, headerHeight).stroke();
        doc.font('Helvetica-Bold').fontSize(14).text('CORRECTIVE ACTION REGISTER', startX + logoBoxWidth, startY + 18, {
            width: titleBoxWidth,
            align: 'center'
        });

        const effectiveQf = getEffectiveQfValue(cleanFromDate);

        const metaX = startX + logoBoxWidth + titleBoxWidth;
        doc.rect(metaX, startY, metaBoxWidth, headerHeight).stroke();
        doc.font('Helvetica-Bold').fontSize(8).text(effectiveQf, metaX + 8, startY + 8);
        doc.text(`MACHINE SHOP: ${machineShop}`, metaX + 8, startY + 22);
        doc.font('Helvetica').fontSize(8).text(`PERIOD: ${cleanFromDate} to ${cleanToDate}`, metaX + 8, startY + 36);

        startY += headerHeight + 10;

        const headers = [
            { label: 'Date', w: 55 },
            { label: 'Line Code', w: 60 },
            { label: 'Part Name', w: 130 },
            { label: 'Problem Description', w: 120 },
            { label: 'Category\n(A-E)', w: 45 },
            { label: 'Qty', w: 35 },
            { label: 'Root Cause', w: 110 },
            { label: 'Corrective Action', w: 115 },
            { label: 'Result', w: 50 },
            { label: 'Signature', w: 80 }
        ];

        const headerWidth = headers.reduce((sum, h) => sum + h.w, 0);

        const drawHeaders = (yPos) => {
            doc.rect(startX, yPos, headerWidth, 32).fillAndStroke('#e5e7eb', 'black');
            let currentX = startX;
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('black');

            headers.forEach((h) => {
                doc.rect(currentX, yPos, h.w, 32).stroke();
                doc.text(h.label, currentX + 2, yPos + 6, {
                    width: h.w - 4,
                    align: 'center'
                });
                currentX += h.w;
            });

            return yPos + 32;
        };

        let currentY = drawHeaders(startY);

        records.forEach((record) => {
            const rowData = [
                record.recordDate
                    ? new Date(record.recordDate).toISOString().split('T')[0]
                    : cleanFromDate,
                record.lineCode || '-',
                record.partName || '-',
                record.problemDescription || '-',
                record.problemCategory || '-',
                String(record.quantity ?? '-'),
                record.rootCause || '-',
                record.correctiveAction || '-',
                record.result || '-',
                record.operatorSignature || 'Pending'
            ];

            doc.font('Helvetica').fontSize(7);
            const textHeights = [
                doc.heightOfString(String(rowData[2]), { width: headers[2].w - 6 }),
                doc.heightOfString(String(rowData[3]), { width: headers[3].w - 6 }),
                doc.heightOfString(String(rowData[6]), { width: headers[6].w - 6 }),
                doc.heightOfString(String(rowData[7]), { width: headers[7].w - 6 })
            ];

            let rowHeight = Math.max(26, Math.max(...textHeights) + 10);

            if (currentY + rowHeight > doc.page.height - 55) {
                doc.addPage();
                currentY = 20;
                currentY = drawHeaders(currentY);
            }

            let currentX = startX;
            rowData.forEach((val, i) => {
                doc.rect(currentX, currentY, headers[i].w, rowHeight).stroke();

                if (i === 9 && val && val !== '-' && val !== 'Pending') {
                    doc.save()
                        .lineWidth(1.2)
                        .strokeColor('#16a34a')
                        .moveTo(currentX + 6, currentY + rowHeight / 2)
                        .lineTo(currentX + 10, currentY + rowHeight / 2 + 3)
                        .lineTo(currentX + 16, currentY + rowHeight / 2 - 4)
                        .stroke()
                        .restore();

                    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#16a34a')
                        .text('Approved', currentX + 18, currentY + rowHeight / 2 - 8, {
                            width: headers[i].w - 20,
                            align: 'center'
                        });

                    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('black')
                        .text(String(val).toUpperCase().substring(0, 14), currentX + 2, currentY + rowHeight / 2 + 1, {
                            width: headers[i].w - 4,
                            align: 'center'
                        });
                } else {
                    doc.font(i === 4 || i === 8 ? 'Helvetica-Bold' : 'Helvetica')
                        .fontSize(7)
                        .fillColor('black')
                        .text(String(val), currentX + 3, currentY + 5, {
                            width: headers[i].w - 6,
                            align: i === 2 || i === 3 || i === 6 || i === 7 ? 'left' : 'center'
                        });
                }

                currentX += headers[i].w;
            });

            currentY += rowHeight;
        });

        // Legend / Footer Note with Dynamic QF
        currentY += 8;
        if (currentY + 36 > doc.page.height - 20) {
            doc.addPage();
            currentY = 20;
        }

        doc.rect(startX, currentY, totalWidth, 34).stroke();
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('black')
            .text('Category Legend: A: >5 parts in same defect | B: Repeated rejections | C: Critical/Safety characteristics | D: Crack/Broken | E: New defect', startX + 6, currentY + 6);
        doc.font('Helvetica').fontSize(7)
            .text(`${effectiveQf} - Machine Shop Quality Assurance Register`, startX + 6, currentY + 20);

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