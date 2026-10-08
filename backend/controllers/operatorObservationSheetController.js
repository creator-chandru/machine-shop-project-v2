const sql = require('../db');
const PDFDocument = require("pdfkit");
const fs = require('fs');
const path = require('path');

// ============================================================
// SAVE OPERATOR OBSERVATION SHEET
// ============================================================
const saveOperatorObservationSheet = async (req, res) => {
    const { header, sections, footer } = req.body;

    if (!header || !header.employeeName || !header.employeeCode) {
        return res.status(400).json({ error: 'Employee Name and Employee Code are required.' });
    }

    let transaction;

    try {
        transaction = new sql.Transaction();
        await transaction.begin();

        // Prevent duplicates for the same day and employee
        await transaction.request()
            .input('machineShop', sql.Int, parseInt(header.machineShop || 3))
            .input('employeeCode', sql.NVarChar(50), header.employeeCode)
            .input('testDate', sql.Date, header.testDate)
            .query(`
                DELETE FROM OperatorObservationSheet
                WHERE machineShop = @machineShop
                  AND employeeCode = @employeeCode
                  AND CONVERT(date, testDate) = CONVERT(date, @testDate)
            `);

        const sectionList = sections || [];

        for (const sec of sectionList) {
            const items = sec.items || [];

            for (const item of items) {
                const request = new sql.Request(transaction);

                request
                    .input('machineShop', sql.Int, parseInt(header.machineShop || 3))
                    .input('employeeName', sql.NVarChar(150), header.employeeName)
                    .input('employeeCode', sql.NVarChar(50), header.employeeCode)
                    .input('department', sql.NVarChar(100), header.department || '')
                    .input('testDate', sql.Date, header.testDate)
                    .input('marksPercentage', sql.NVarChar(20), header.marksPercentage || '')
                    .input('totalMarksObtained', sql.Int, header.totalMarksObtained || 0)
                    .input('maxMarks', sql.Int, header.maxMarks || 125)
                    .input('method', sql.NVarChar(100), header.method || 'Practical & Demo')

                    // Item level values
                    .input('sectionId', sql.Int, sec.id)
                    .input('sectionName', sql.NVarChar(150), sec.title)
                    .input('slNo', sql.Int, item.slNo)
                    .input('parameterText', sql.NVarChar(500), item.parameter)
                    .input('rating', sql.NVarChar(50), item.rating || '')
                    .input('score', sql.Int, item.score !== undefined ? item.score : 0)

                    // Footer values
                    .input('operatorFeedback', sql.NVarChar(sql.MAX), footer?.operatorFeedback || '')
                    .input('reviewedBy', sql.NVarChar(100), footer?.reviewedBy || '')
                    .input('approvedBy', sql.NVarChar(100), footer?.approvedBy || '')
                    .input('reviewDate', sql.Date, footer?.reviewDate || header.testDate);

                await request.query(`
                    INSERT INTO OperatorObservationSheet
                    (
                        machineShop, employeeName, employeeCode, department, testDate,
                        marksPercentage, totalMarksObtained, maxMarks, method,
                        sectionId, sectionName, slNo, parameterText, rating, score,
                        operatorFeedback, reviewedBy, approvedBy, reviewDate
                    )
                    VALUES
                    (
                        @machineShop, @employeeName, @employeeCode, @department, @testDate,
                        @marksPercentage, @totalMarksObtained, @maxMarks, @method,
                        @sectionId, @sectionName, @slNo, @parameterText, @rating, @score,
                        @operatorFeedback, @reviewedBy, @approvedBy, @reviewDate
                    )
                `);
            }
        }

        await transaction.commit();

        return res.status(201).json({ message: 'Operator Observation Sheet saved successfully' });

    } catch (err) {
        console.error('Error saving Operator Observation Sheet:', err);
        if (transaction) {
            try { await transaction.rollback(); } catch (rollbackErr) { }
        }
        return res.status(500).json({ error: 'Failed to save Operator Observation Sheet' });
    }
};

// ============================================================
// GET SAVED OPERATOR OBSERVATION SHEET DATA
// ============================================================
const getOperatorObservationSheet = async (req, res) => {
    const { machineShop, employeeCode, testDate } = req.query;

    try {
        let query = `
            SELECT
                id, machineShop, employeeName, employeeCode, department,
                FORMAT(testDate, 'yyyy-MM-dd') as testDate, marksPercentage,
                totalMarksObtained, maxMarks, method, sectionId, sectionName,
                slNo, parameterText, rating, score, operatorFeedback,
                reviewedBy, approvedBy, FORMAT(reviewDate, 'yyyy-MM-dd') as reviewDate
            FROM OperatorObservationSheet
            WHERE 1 = 1
        `;

        const request = new sql.Request();

        if (machineShop) {
            query += ` AND machineShop = @machineShop`;
            request.input('machineShop', sql.Int, parseInt(machineShop));
        }
        if (employeeCode) {
            query += ` AND employeeCode = @employeeCode`;
            request.input('employeeCode', sql.NVarChar(50), employeeCode);
        }
        if (testDate) {
            query += ` AND CONVERT(date, testDate) = CONVERT(date, @testDate)`;
            request.input('testDate', sql.Date, testDate);
        }

        query += ` ORDER BY sectionId ASC, slNo ASC`;

        const result = await request.query(query);
        return res.status(200).json(result.recordset);

    } catch (err) {
        console.error('Error fetching Operator Observation Sheet:', err);
        return res.status(500).json({ error: 'Failed to fetch Operator Observation Sheet data' });
    }
};

// ============================================================
// PDF GENERATOR
// ============================================================
const generateOperatorObservationPDF = async (req, res) => {
    try {
        const { machineShop, employeeCode, testDate } = req.query;
        if (!employeeCode || !testDate) return res.status(400).json({ error: "Missing required parameters." });

        const request = new sql.Request();
        request.input('machineShop', sql.Int, parseInt(machineShop || 3))
            .input('employeeCode', sql.NVarChar(50), employeeCode)
            .input('testDate', sql.Date, testDate);

        const result = await request.query(`
            SELECT * FROM OperatorObservationSheet 
            WHERE machineShop = @machineShop 
              AND employeeCode = @employeeCode 
              AND CONVERT(date, testDate) = CONVERT(date, @testDate)
            ORDER BY sectionId ASC, slNo ASC
        `);

        if (result.recordset.length === 0) return res.status(404).json({ error: "No records found." });
        const records = result.recordset;
        const header = records[0];

        // Safely parse dates before generating PDF to prevent crashes
        const rawDate = header.testDate;
        const dt = new Date(rawDate);
        const displayDate = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;

        const rawReviewDate = header.reviewDate;
        let reviewDisplayDate = displayDate;
        if (rawReviewDate) {
            const rd = new Date(rawReviewDate);
            if (!isNaN(rd.getTime())) {
                reviewDisplayDate = `${String(rd.getDate()).padStart(2, '0')}/${String(rd.getMonth() + 1).padStart(2, '0')}/${rd.getFullYear()}`;
            }
        }

        const doc = new PDFDocument({ margin: 20, size: "A4", layout: "portrait", bufferPages: true });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=OperatorObservation_${employeeCode}_${displayDate.replace(/\//g, '-')}.pdf`);
        doc.pipe(res);

        const startX = 20;
        let currentY = 20;
        const fullW = doc.page.width - 40;

        doc.lineWidth(1).strokeColor('black');

        // 1. HEADER BOXES
        doc.rect(startX, currentY, 150, 40).stroke();
        const logoPath = path.join(__dirname, 'logo.jpg');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, startX + 10, currentY + 5, { fit: [130, 30], align: 'center', valign: 'center' });
        } else {
            doc.font("Helvetica-Bold").fontSize(10).text("SAKTHI AUTO COMPONENT LTD", startX + 5, currentY + 12, { width: 140, align: "center" });
        }

        doc.rect(startX + 150, currentY, fullW - 150, 40).stroke();
        doc.font("Helvetica-Bold").fontSize(16).text("OPERATOR OBSERVATION SHEET", startX + 150, currentY + 14, { width: fullW - 150, align: "center" });
        currentY += 40;

        // 2. EMPLOYEE DETAILS GRID
        const c1 = 150, c2 = fullW - c1 - 200, c3 = 80, c4 = 120;
        const rowH = 18;

        const drawInfoRow = (l1, v1, l2, v2, y) => {
            doc.rect(startX, y, c1, rowH).stroke(); doc.font("Helvetica").fontSize(9).text(l1, startX + 5, y + 5);
            doc.rect(startX + c1, y, c2, rowH).stroke(); doc.font("Helvetica-Bold").text(v1 || '', startX + c1 + 5, y + 5);
            doc.rect(startX + c1 + c2, y, c3, rowH).stroke(); doc.font("Helvetica").text(l2, startX + c1 + c2 + 5, y + 5);
            doc.rect(startX + c1 + c2 + c3, y, c4, rowH).stroke(); doc.font("Helvetica-Bold").text(v2 || '', startX + c1 + c2 + c3 + 5, y + 5);
        };

        drawInfoRow("Employee Name", header.employeeName, "Test Date :", displayDate, currentY); currentY += rowH;
        drawInfoRow("Employee Code", header.employeeCode, "Marks :", header.marksPercentage || '', currentY); currentY += rowH;
        drawInfoRow("Department :", header.department, "Method :", header.method || 'Practical & Demo', currentY); currentY += rowH;

        // 3. TABLE HEADERS
        const wSno = 40, wParam = fullW - wSno - (55 * 4), wR = 55;
        const headers = ["Followed", "Partially Followed", "Not Followed", "Not Aware"];
        doc.rect(startX, currentY, wSno, rowH).fillAndStroke('#f3f4f6', 'black'); doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("S.NO.", startX, currentY + 5, { width: wSno, align: "center" });
        doc.rect(startX + wSno, currentY, wParam, rowH).fillAndStroke('#f3f4f6', 'black'); doc.fillColor('black').text("PARAMETERS", startX + wSno, currentY + 5, { width: wParam, align: "center" });
        headers.forEach((h, i) => {
            doc.rect(startX + wSno + wParam + (i * wR), currentY, wR, rowH).fillAndStroke('#f3f4f6', 'black');
            doc.fillColor('black').fontSize(6).text(h, startX + wSno + wParam + (i * wR), currentY + 6, { width: wR, align: "center" });
        });
        currentY += rowH;

        // 4. GROUP DATA BY SECTION
        const sections = {};
        records.forEach(r => {
            if (!sections[r.sectionId]) sections[r.sectionId] = { title: r.sectionName, items: [] };
            sections[r.sectionId].items.push(r);
        });

        const ratingKeys = ["followed", "partiallyFollowed", "notFollowed", "notAware"];
        const ratingPoints = [5, 3, 1, 0];

        Object.values(sections).forEach(sec => {
            if (currentY > doc.page.height - 50) { doc.addPage(); currentY = 20; }
            doc.rect(startX, currentY, wSno + wParam, rowH).fillAndStroke('#e5e7eb', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(9).text(sec.title, startX + 5, currentY + 5);
            ratingPoints.forEach((pts, i) => {
                doc.rect(startX + wSno + wParam + (i * wR), currentY, wR, rowH).fillAndStroke('#e5e7eb', 'black');
                doc.fillColor('black').text(String(pts), startX + wSno + wParam + (i * wR), currentY + 5, { width: wR, align: "center" });
            });
            currentY += rowH;

            sec.items.forEach(item => {
                const textHeight = doc.heightOfString(item.parameterText, { width: wParam - 10, fontSize: 8 });
                const itemRowH = textHeight < 15 ? 20 : textHeight + 10;

                if (currentY + itemRowH > doc.page.height - 50) { doc.addPage(); currentY = 20; }

                doc.rect(startX, currentY, wSno, itemRowH).stroke();
                doc.font("Helvetica").fontSize(8).text(String(item.slNo), startX, currentY + 5, { width: wSno, align: "center" });

                doc.rect(startX + wSno, currentY, wParam, itemRowH).stroke();
                doc.text(item.parameterText, startX + wSno + 5, currentY + 5, { width: wParam - 10 });

                ratingKeys.forEach((key, i) => {
                    doc.rect(startX + wSno + wParam + (i * wR), currentY, wR, itemRowH).stroke();
                    if (item.rating === key) {
                        const cellX = startX + wSno + wParam + (i * wR);
                        const cellY = currentY;

                        // Center of the rating cell
                        const centerX = cellX + (wR / 2);
                        const centerY = cellY + (itemRowH / 2);

                        // Green tick mark
                        doc.save();
                        doc.strokeColor('green');
                        doc.lineWidth(1.8);

                        // First stroke: lower-left to center
                        doc.moveTo(centerX - 7, centerY)
                            .lineTo(centerX - 2, centerY + 5)
                            .stroke();

                        // Second stroke: center to upper-right
                        doc.moveTo(centerX - 2, centerY + 5)
                            .lineTo(centerX + 8, centerY - 6)
                            .stroke();

                        doc.restore();
                    }
                });
                currentY += itemRowH;
            });
        });

        // 5. FOOTER
        if (currentY > doc.page.height - 80) { doc.addPage(); currentY = 20; }

        doc.rect(startX, currentY, fullW / 2, 20).stroke();
        doc.font("Helvetica-Bold").fontSize(9).text(`Date: ${reviewDisplayDate}`, startX + 5, currentY + 6);
        doc.rect(startX + (fullW / 2), currentY, fullW / 4, 20).stroke();
        doc.text(`Reviewed By: ${header.reviewedBy || ''}`, startX + (fullW / 2) + 5, currentY + 6);
        doc.rect(startX + (fullW * 0.75), currentY, fullW / 4, 20).stroke();
        doc.text(`Approved By: ${header.approvedBy || ''}`, startX + (fullW * 0.75) + 5, currentY + 6);
        currentY += 20;

        doc.rect(startX, currentY, fullW, 15).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').text("NOTE:- 75% More than score = GOOD", startX + 5, currentY + 3);
        currentY += 15;

        doc.rect(startX, currentY, fullW, 40).stroke();
        doc.text("Operator feed back :", startX + 5, currentY + 5);
        doc.font("Helvetica").text(header.operatorFeedback || "", startX + 5, currentY + 18, { width: fullW - 10 });

        doc.end();
    } catch (err) {
        console.error("PDF generation error:", err);
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to generate PDF" });
        }
    }
};

module.exports = {
    saveOperatorObservationSheet,
    getOperatorObservationSheet,
    generateOperatorObservationPDF
};