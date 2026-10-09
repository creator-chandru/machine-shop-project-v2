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
        const { shopId } = req.query;
        const request = new sql.Request();
        
        let query = `
            SELECT DISTINCT lineCode 
            FROM LineMappings 
            WHERE lineCode IS NOT NULL AND lineCode <> ''
        `;

        if (shopId && !isNaN(parseInt(shopId, 10))) {
            request.input('shopId', sql.Int, parseInt(shopId, 10));
            query += ` AND (shopId = @shopId OR machineShop = @shopId)`;
        }

        query += ` ORDER BY lineCode ASC`;

        const result = await request.query(query);
        const lineList = result.recordset.map(row => row.lineCode);
        
        return res.status(200).json(lineList);
    } catch (err) {
        console.error("Fetch lines error from LineMappings:", err);
        
        // Fallback: Query distinct line codes from ErrorProofingCheckSheet if LineMappings fails
        try {
            const fallbackReq = new sql.Request();
            let fallbackQuery = `
                SELECT DISTINCT lineCode 
                FROM ErrorProofingCheckSheet 
                WHERE lineCode IS NOT NULL AND lineCode <> ''
            `;

            if (req.query.shopId && !isNaN(parseInt(req.query.shopId, 10))) {
                fallbackReq.input('shopId', sql.Int, parseInt(req.query.shopId, 10));
                fallbackQuery += ` AND machineShop = @shopId`;
            }

            fallbackQuery += ` ORDER BY lineCode ASC`;

            const fallbackRes = await fallbackReq.query(fallbackQuery);
            const lineList = fallbackRes.recordset.map(row => row.lineCode);
            return res.status(200).json(lineList);
        } catch (fallbackErr) {
            console.error("Fallback fetch lines error:", fallbackErr);
            return res.status(500).json({ error: 'Failed to fetch line codes' });
        }
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
// 3. FETCH SAVED EXAM DATA (BY EMP NO, LINE, & DATE)
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
// 4. GENERATE PDF REPORT
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

        const doc = new PDFDocument({ margin: 25, size: "A4" });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=Exam_${employeeNo}_${cleanDate}.pdf`);
        doc.pipe(res);

        // Header Section
        doc.font("Helvetica-Bold").fontSize(14).text("SAKTHI AUTO COMPONENT LIMITED", { align: "center" });
        doc.fontSize(11).text("LEVEL 3 COMPETENCY QUALIFICATION - VTL & HTL MACHINE", { align: "center" });
        doc.moveDown(0.5);

        doc.fontSize(9).font("Helvetica");
        doc.text(`Emp No: ${data.employeeNo} | Name: ${data.employeeName} | Line: ${data.line}`);
        doc.text(`DOJ: ${data.doj ? new Date(data.doj).toISOString().split('T')[0] : 'N/A'} | Date: ${new Date(data.examDate).toISOString().split('T')[0]} | Qualification: ${data.qualification}`);
        doc.text(`Score: ${data.score} / 100 | Evaluated By: ${data.evaluatedBy || 'N/A'}`);
        doc.moveDown();

        doc.moveTo(25, doc.y).lineTo(570, doc.y).stroke();
        doc.moveDown(0.5);

        doc.font("Helvetica-Bold").fontSize(10).text("Submitted Answers:");
        doc.moveDown(0.5);

        doc.font("Helvetica").fontSize(9);
        for (let i = 1; i <= 20; i++) {
            const selectedOpt = answers[i] || "Unanswered";
            const isCorrect = selectedOpt === answerKey[i] ? "✓ Correct" : `X Incorrect (Key: ${answerKey[i]})`;
            doc.text(`Q${i}: Option ${selectedOpt}   ---   ${isCorrect}`);
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