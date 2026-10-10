const sql = require('../db');
const PDFDocument = require("pdfkit");

// Master Answer Key for Scoring (5 Marks per correct answer)
const answerKey = {
    1: 'A', 2: 'B', 3: 'A', 4: 'C', 5: 'A', 6: 'A', 7: 'A', 8: 'A', 9: 'A', 10: 'A',
    11: 'A', 12: 'A', 13: 'A', 14: 'A', 15: 'C', 16: 'A', 17: 'A', 18: 'C', 19: 'A', 20: 'A'
};

// ============================================================
// 1. GET ALL LINE CODES FOR DROPDOWN
// ============================================================
const getAllLines = async (req, res) => {
    try {
        const request = new sql.Request();
        
        const query = `
            SELECT DISTINCT lineCode 
            FROM ErrorProofingCheckSheet 
            WHERE lineCode IS NOT NULL AND lineCode <> ''
            ORDER BY lineCode ASC
        `;

        const result = await request.query(query);
        const lineList = result.recordset.map(row => row.lineCode);
        
        return res.status(200).json(lineList);
    } catch (err) {
        console.error("Fetch lines error from ErrorProofingCheckSheet:", err);
        return res.status(500).json({ error: 'Failed to fetch line codes' });
    }
};

// ============================================================
// 2. SAVE OR UPDATE EXAM RESPONSE
// ============================================================
const saveCompetencyExam = async (req, res) => {
    const { header, answers } = req.body;
    const lineValue = header?.line || header?.lineCode;

    if (!header || !header.employeeNo || !header.examDate || !lineValue) {
        return res.status(400).json({ error: 'Header parameters missing' });
    }

    try {
        let calculatedScore = 0;
        Object.keys(answers || {}).forEach((qId) => {
            if (answers[qId] === answerKey[qId]) {
                calculatedScore += 5;
            }
        });

        const cleanDate = String(header.examDate).split('T')[0];

        const request = new sql.Request();
        request.input('employeeNo', sql.NVarChar(50), header.employeeNo)
            .input('employeeName', sql.NVarChar(100), header.employeeName || '')
            .input('line', sql.NVarChar(50), lineValue)
            .input('doj', sql.Date, header.doj || null)
            .input('examDate', sql.NVarChar(50), cleanDate)
            .input('qualification', sql.NVarChar(100), header.qualification || '')
            .input('answers', sql.NVarChar(sql.MAX), JSON.stringify(answers || {}))
            .input('score', sql.Int, calculatedScore)
            .input('evaluatedBy', sql.NVarChar(100), header.evaluatedBy || '');

        const checkQuery = `
            SELECT id FROM CompetencyQualificationExam 
            WHERE employeeNo = @employeeNo 
              AND line = @line 
              AND CONVERT(date, examDate) = CONVERT(date, @examDate)
        `;
        const existing = await request.query(checkQuery);

        if (existing.recordset.length > 0) {
            await request.query(`
                UPDATE CompetencyQualificationExam 
                SET employeeName = @employeeName, 
                    doj = @doj, 
                    qualification = @qualification,
                    answers = @answers, 
                    score = @score, 
                    evaluatedBy = @evaluatedBy
                WHERE employeeNo = @employeeNo 
                  AND line = @line 
                  AND CONVERT(date, examDate) = CONVERT(date, @examDate)
            `);
        } else {
            await request.query(`
                INSERT INTO CompetencyQualificationExam 
                (employeeNo, employeeName, line, doj, examDate, qualification, answers, score, evaluatedBy)
                VALUES 
                (@employeeNo, @employeeName, @line, @doj, @examDate, @qualification, @answers, @score, @evaluatedBy)
            `);
        }

        return res.status(200).json({ message: 'Exam saved successfully', score: calculatedScore });
    } catch (err) {
        console.error("Save exam error:", err);
        return res.status(500).json({ error: 'Failed to save exam response' });
    }
};

// ============================================================
// 3. FETCH SAVED EXAM DATA
// ============================================================
const getCompetencyExam = async (req, res) => {
    const employeeNo = req.query.employeeNo;
    const lineParam = req.query.line || req.query.lineCode;
    const examDate = req.query.examDate;

    if (!employeeNo || !lineParam || !examDate) {
        return res.status(400).json({ error: 'Missing employeeNo, line, or examDate query parameters' });
    }

    try {
        const cleanDate = String(examDate).split('T')[0];

        const request = new sql.Request();
        request.input('employeeNo', sql.NVarChar(50), employeeNo)
            .input('line', sql.NVarChar(50), lineParam)
            .input('examDate', sql.NVarChar(50), cleanDate);

        const result = await request.query(`
            SELECT 
                id,
                employeeNo,
                employeeName,
                line,
                FORMAT(doj, 'yyyy-MM-dd') AS doj,
                FORMAT(examDate, 'yyyy-MM-dd') AS examDate,
                qualification,
                answers,
                score,
                evaluatedBy
            FROM CompetencyQualificationExam 
            WHERE employeeNo = @employeeNo 
              AND line = @line 
              AND CONVERT(date, examDate) = CONVERT(date, @examDate)
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'No record found' });
        }

        return res.status(200).json(result.recordset[0]);
    } catch (err) {
        console.error("Fetch exam error:", err);
        return res.status(500).json({ error: 'Failed to fetch exam record' });
    }
};

// ============================================================
// 4. GENERATE STRUCTURED TABLE PDF REPORT
// ============================================================
const generateCompetencyReport = async (req, res) => {
    try {
        const employeeNo = req.query.employeeNo;
        const lineParam = req.query.line || req.query.lineCode;
        const examDate = req.query.examDate;

        if (!employeeNo || !lineParam || !examDate) {
            return res.status(400).json({ error: "Missing required query parameters" });
        }

        const cleanDate = String(examDate).split('T')[0];

        const request = new sql.Request();
        request.input('employeeNo', sql.NVarChar(50), employeeNo)
            .input('line', sql.NVarChar(50), lineParam)
            .input('examDate', sql.NVarChar(50), cleanDate);

        const result = await request.query(`
            SELECT * FROM CompetencyQualificationExam 
            WHERE employeeNo = @employeeNo 
              AND line = @line 
              AND CONVERT(date, examDate) = CONVERT(date, @examDate)
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Record not found for PDF generation" });
        }

        const data = result.recordset[0];
        const answers = JSON.parse(data.answers || '{}');

        const doc = new PDFDocument({ margin: 30, size: "A4" });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=Competency_Report_${employeeNo}_${cleanDate}.pdf`);
        doc.pipe(res);

        // --- TITLE HEADER ---
        doc.font("Helvetica-Bold").fontSize(13).text("SAKTHI AUTO COMPONENT LIMITED", { align: "center" });
        doc.fontSize(10).fillColor("#444444").text("LEVEL 3 COMPETENCY QUALIFICATION EVALUATION REPORT - VTL & HTL", { align: "center" });
        doc.moveDown(0.8);

        // --- EMPLOYEE DETAILS PANEL ---
        const boxTop = doc.y;
        doc.rect(30, boxTop, 535, 55).strokeColor("#B0B0B0").lineWidth(1).stroke();
        
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#000000");
        doc.text(`Emp No:`, 40, boxTop + 10);
        doc.font("Helvetica").text(data.employeeNo, 90, boxTop + 10);

        doc.font("Helvetica-Bold").text(`Name:`, 210, boxTop + 10);
        doc.font("Helvetica").text(data.employeeName || 'N/A', 245, boxTop + 10);

        doc.font("Helvetica-Bold").text(`Line:`, 410, boxTop + 10);
        doc.font("Helvetica").text(data.line, 440, boxTop + 10);

        doc.font("Helvetica-Bold").text(`DOJ:`, 40, boxTop + 25);
        doc.font("Helvetica").text(data.doj ? new Date(data.doj).toISOString().split('T')[0] : 'N/A', 90, boxTop + 25);

        doc.font("Helvetica-Bold").text(`Date:`, 210, boxTop + 25);
        doc.font("Helvetica").text(cleanDate, 245, boxTop + 25);

        doc.font("Helvetica-Bold").text(`Qualification:`, 410, boxTop + 25);
        doc.font("Helvetica").text(data.qualification || 'N/A', 475, boxTop + 25);

        doc.font("Helvetica-Bold").text(`Evaluated By:`, 40, boxTop + 40);
        doc.font("Helvetica").text(data.evaluatedBy || 'N/A', 110, boxTop + 40);

        doc.font("Helvetica-Bold").text(`Score:`, 410, boxTop + 40);
        doc.font("Helvetica-Bold").fillColor(data.score >= 70 ? "#008000" : "#D32F2F").text(`${data.score} / 100`, 445, boxTop + 40);

        doc.moveDown(2.8);

        // --- TABLE LAYOUT CONFIGURATION ---
        const startX = 30;
        const colWidths = [50, 140, 160, 185]; 
        const rowHeight = 20;
        let currentY = doc.y;

        // Draw Table Header Row
        doc.fillColor("#000000").font("Helvetica-Bold").fontSize(9);
        doc.rect(startX, currentY, 535, rowHeight).fill("#E2E8F0").stroke();
        
        doc.fillColor("#000000");
        doc.text("Q. No", startX + 10, currentY + 6, { width: colWidths[0], align: "left" });
        doc.text("Selected Answer", startX + colWidths[0], currentY + 6, { width: colWidths[1], align: "center" });
        doc.text("Status", startX + colWidths[0] + colWidths[1], currentY + 6, { width: colWidths[2], align: "center" });
        doc.text("Correct Answer (Key)", startX + colWidths[0] + colWidths[1] + colWidths[2], currentY + 6, { width: colWidths[3], align: "center" });

        currentY += rowHeight;

        // --- TABLE DATA ROWS ---
        doc.font("Helvetica").fontSize(9);
        for (let i = 1; i <= 20; i++) {
            if (currentY > 750) { 
                doc.addPage();
                currentY = 40;
            }

            const selectedOpt = answers[i] || "Unanswered";
            const correctOpt = answerKey[i];
            const isCorrect = selectedOpt === correctOpt;

            // Alternating row background for clean structure
            const rowBg = i % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
            doc.rect(startX, currentY, 535, rowHeight).fill(rowBg).strokeColor("#CBD5E1").lineWidth(0.5).stroke();

            // Text columns
            doc.fillColor("#000000").font("Helvetica-Bold");
            doc.text(`Q${i}`, startX + 10, currentY + 6, { width: colWidths[0], align: "left" });

            doc.font("Helvetica");
            doc.text(`Option ${selectedOpt}`, startX + colWidths[0], currentY + 6, { width: colWidths[1], align: "center" });

            if (isCorrect) {
                // Correct: Green status text
                doc.fillColor("#16A34A").font("Helvetica-Bold");
                doc.text("✓ Correct", startX + colWidths[0] + colWidths[1], currentY + 6, { width: colWidths[2], align: "center" });

                doc.fillColor("#334155").font("Helvetica");
                doc.text(`Option ${correctOpt}`, startX + colWidths[0] + colWidths[1] + colWidths[2], currentY + 6, { width: colWidths[3], align: "center" });
            } else {
                // Incorrect: Red status text
                doc.fillColor("#DC2626").font("Helvetica-Bold");
                doc.text("X Incorrect", startX + colWidths[0] + colWidths[1], currentY + 6, { width: colWidths[2], align: "center" });

                // Correct Answer highlighted with Yellow background box indicator
                doc.save();
                const badgeX = startX + colWidths[0] + colWidths[1] + colWidths[2] + 45;
                const badgeY = currentY + 3;
                doc.roundedRect(badgeX, badgeY, 95, 14, 3).fill("#FEF08A").stroke(); // Yellow / Amber highlight box
                doc.fillColor("#854D0E").font("Helvetica-Bold");
                doc.text(`Option ${correctOpt}`, badgeX, badgeY + 3, { width: 95, align: "center" });
                doc.restore();
            }

            currentY += rowHeight;
        }

        doc.end();
    } catch (err) {
        console.error("PDF generation error:", err);
        if (!res.headersSent) {
            res.status(500).json({ error: "PDF generation failed" });
        }
    }
};

module.exports = {
    getAllLines,
    saveCompetencyExam,
    getCompetencyExam,
    generateCompetencyReport
};