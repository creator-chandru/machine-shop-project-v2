const sql = require('../db');
const PDFDocument = require("pdfkit");

// ============================================================
// HELPER: SAFELY ENSURE TABLE COLUMNS EXIST
// ============================================================
const ensureCompetencyColumns = async () => {
    try {
        const req = new sql.Request();
        await req.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CompetencyQualificationExam' AND xtype='U')
            BEGIN
                CREATE TABLE CompetencyQualificationExam (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    employeeNo NVARCHAR(50),
                    employeeName NVARCHAR(100),
                    line NVARCHAR(50),
                    doj NVARCHAR(50) NULL,
                    examDate NVARCHAR(50) NULL,
                    qualification NVARCHAR(100) NULL,
                    answers NVARCHAR(MAX) NULL,
                    score INT DEFAULT 0,
                    evaluatedBy NVARCHAR(100) NULL,
                    status NVARCHAR(50) DEFAULT 'Pending Verification',
                    verifiedBy NVARCHAR(100) NULL,
                    verifiedAt DATETIME NULL,
                    createdAt DATETIME DEFAULT GETDATE()
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('CompetencyQualificationExam', 'status') IS NULL
                    ALTER TABLE CompetencyQualificationExam ADD status NVARCHAR(50) DEFAULT 'Pending Verification';
                IF COL_LENGTH('CompetencyQualificationExam', 'verifiedBy') IS NULL
                    ALTER TABLE CompetencyQualificationExam ADD verifiedBy NVARCHAR(100) NULL;
                IF COL_LENGTH('CompetencyQualificationExam', 'verifiedAt') IS NULL
                    ALTER TABLE CompetencyQualificationExam ADD verifiedAt DATETIME NULL;
            END

            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CompetencyExamQuestions' AND xtype='U')
            BEGIN
                CREATE TABLE CompetencyExamQuestions (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    questionText NVARCHAR(MAX) NOT NULL,
                    optionsJson NVARCHAR(MAX) NOT NULL,
                    correctAnswer VARCHAR(10) NOT NULL,
                    createdAt DATETIME DEFAULT GETDATE()
                );
            END
        `);
    } catch (e) {
        console.warn("Table column migration notice:", e.message);
    }
};

ensureCompetencyColumns();

// ============================================================
// 1. GET ALL LINE CODES
// ============================================================
const getAllLines = async (req, res) => {
    try {
        const request = new sql.Request();
        const query = `
            SELECT DISTINCT lineCode 
            FROM MachineShop3Details 
            WHERE lineCode IS NOT NULL AND lineCode <> ''
            ORDER BY lineCode ASC
        `;
        const result = await request.query(query);
        const lineList = result.recordset.map(row => row.lineCode);
        return res.status(200).json(lineList);
    } catch (err) {
        console.error("Fetch lines error:", err);
        return res.status(500).json({ error: 'Failed to fetch line codes' });
    }
};

// ============================================================
// 2. GET ALL SHIFT INCHARGES FOR DROPDOWN
// ============================================================
const getShiftIncharges = async (req, res) => {
    try {
        const request = new sql.Request();
        let inchargeList = [];

        try {
            const userResult = await request.query(`
                SELECT DISTINCT 
                    username AS inchargeName
                FROM MachineShopUsers 
                WHERE LOWER(role) LIKE '%shift%' 
                 
                ORDER BY inchargeName ASC
            `);
            inchargeList = userResult.recordset
                .map(u => u.inchargeName)
                .filter(name => name && name.trim() !== "");
        } catch (e) {
            console.warn("Could not query Users for shift incharges:", e.message);
        }

        try {
            const prev = await request.query(`
                SELECT DISTINCT evaluatedBy 
                FROM CompetencyQualificationExam 
                WHERE evaluatedBy IS NOT NULL AND evaluatedBy <> ''
            `);
            const prevList = prev.recordset.map(r => r.evaluatedBy);
            inchargeList = [...inchargeList, ...prevList];
        } catch (err2) {}

        const standardList = [
            
        ];

        const allUniqueIncharges = Array.from(new Set([...inchargeList, ...standardList]))
            .filter(Boolean)
            .sort();

        return res.status(200).json(allUniqueIncharges);
    } catch (err) {
        console.error("Fetch shift incharges error:", err);
        return res.status(200).json(["Shift Incharge 1", "Shift Incharge 2"]);
    }
};

// ============================================================
// 3. GET DYNAMIC COMPETENCY QUESTIONS
// ============================================================
const getCompetencyQuestions = async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query(`
            SELECT id, questionText, optionsJson, correctAnswer 
            FROM CompetencyExamQuestions 
            ORDER BY id ASC
        `);

        const questions = result.recordset.map(row => {
            let opts = [];
            try {
                opts = typeof row.optionsJson === 'string' ? JSON.parse(row.optionsJson || '[]') : row.optionsJson;
            } catch (je) {
                opts = [];
            }
            return {
                id: row.id,
                text: row.questionText,
                options: opts,
                correctAnswer: row.correctAnswer
            };
        });

        return res.status(200).json(questions);
    } catch (err) {
        console.error("Fetch questions error:", err);
        return res.status(500).json({ error: 'Failed to fetch competency questions' });
    }
};

// ============================================================
// 4. ADD DYNAMIC COMPETENCY QUESTION (HOD)
// ============================================================
const addCompetencyQuestion = async (req, res) => {
    const { questionText, options, correctAnswer } = req.body;
    if (!questionText || !options || !correctAnswer) {
        return res.status(400).json({ error: 'Missing question fields' });
    }

    try {
        const request = new sql.Request();
        request.input('questionText', sql.NVarChar(sql.MAX), questionText)
            .input('optionsJson', sql.NVarChar(sql.MAX), JSON.stringify(options))
            .input('correctAnswer', sql.VarChar(10), correctAnswer);

        await request.query(`
            INSERT INTO CompetencyExamQuestions (questionText, optionsJson, correctAnswer)
            VALUES (@questionText, @optionsJson, @correctAnswer)
        `);

        return res.status(200).json({ message: 'Question added successfully' });
    } catch (err) {
        console.error("Add question error:", err);
        return res.status(500).json({ error: 'Failed to add question' });
    }
};

// ============================================================
// 5. DELETE COMPETENCY QUESTION (HOD)
// ============================================================
const deleteCompetencyQuestion = async (req, res) => {
    const { id } = req.params;
    try {
        const request = new sql.Request();
        request.input('id', sql.Int, id);
        await request.query(`DELETE FROM CompetencyExamQuestions WHERE id = @id`);

        return res.status(200).json({ message: 'Question deleted successfully' });
    } catch (err) {
        console.error("Delete question error:", err);
        return res.status(500).json({ error: 'Failed to delete question' });
    }
};

// ============================================================
// 6. SAVE OR UPDATE EXAM RESPONSE (LOCKED EVALUATOR ENFORCEMENT)
// ============================================================
const saveCompetencyExam = async (req, res) => {
    const { header, answers } = req.body;
    const lineValue = (header?.line || header?.lineCode || '').trim();

    if (!header || !header.employeeNo || !header.examDate || !lineValue) {
        return res.status(400).json({ error: 'Header parameters missing' });
    }

    try {
        await ensureCompetencyColumns();

        const request = new sql.Request();
        const qResult = await request.query(`SELECT id, correctAnswer FROM CompetencyExamQuestions`);
        const answerKey = {};
        qResult.recordset.forEach(row => {
            answerKey[row.id] = row.correctAnswer;
        });

        const totalQuestions = qResult.recordset.length;
        const marksPerQ = totalQuestions > 0 ? Math.round(100 / totalQuestions) : 5;

        let calculatedScore = 0;
        Object.keys(answers || {}).forEach((qId) => {
            if (answers[qId] === answerKey[qId]) {
                calculatedScore += marksPerQ;
            }
        });

        const cleanDate = String(header.examDate).split('T')[0];

        const checkReq = new sql.Request();
        checkReq.input('employeeNo', sql.NVarChar(50), header.employeeNo)
            .input('line', sql.NVarChar(50), lineValue)
            .input('examDate', sql.NVarChar(50), cleanDate);

        const checkQuery = `
            SELECT id, evaluatedBy FROM CompetencyQualificationExam 
            WHERE employeeNo = @employeeNo 
              AND line = @line 
              AND CONVERT(date, examDate) = CONVERT(date, @examDate)
        `;
        const existing = await checkReq.query(checkQuery);

        let finalEvaluatedBy = (header.evaluatedBy || '').trim();
        if (existing.recordset.length > 0 && existing.recordset[0].evaluatedBy) {
            finalEvaluatedBy = existing.recordset[0].evaluatedBy;
        }

        const saveReq = new sql.Request();
        saveReq.input('employeeNo', sql.NVarChar(50), header.employeeNo)
            .input('employeeName', sql.NVarChar(100), header.employeeName || '')
            .input('line', sql.NVarChar(50), lineValue)
            .input('doj', sql.Date, header.doj || null)
            .input('examDate', sql.NVarChar(50), cleanDate)
            .input('qualification', sql.NVarChar(100), header.qualification || '')
            .input('answers', sql.NVarChar(sql.MAX), JSON.stringify(answers || {}))
            .input('score', sql.Int, calculatedScore)
            .input('evaluatedBy', sql.NVarChar(100), finalEvaluatedBy)
            .input('status', sql.NVarChar(50), 'Pending Verification');

        if (existing.recordset.length > 0) {
            await saveReq.query(`
                UPDATE CompetencyQualificationExam 
                SET employeeName = @employeeName, 
                    doj = @doj, 
                    qualification = @qualification,
                    answers = @answers, 
                    score = @score, 
                    evaluatedBy = @evaluatedBy,
                    status = @status
                WHERE employeeNo = @employeeNo 
                  AND line = @line 
                  AND CONVERT(date, examDate) = CONVERT(date, @examDate)
            `);
        } else {
            await saveReq.query(`
                INSERT INTO CompetencyQualificationExam 
                (employeeNo, employeeName, line, doj, examDate, qualification, answers, score, evaluatedBy, status)
                VALUES 
                (@employeeNo, @employeeName, @line, @doj, @examDate, @qualification, @answers, @score, @evaluatedBy, @status)
            `);
        }

        return res.status(200).json({ 
            message: 'Exam saved successfully', 
            score: calculatedScore,
            evaluatedBy: finalEvaluatedBy 
        });
    } catch (err) {
        console.error("Save exam error:", err);
        return res.status(500).json({ error: 'Failed to save exam response' });
    }
};

// ============================================================
// 7. FETCH SAVED EXAM DATA
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
                evaluatedBy,
                ISNULL(status, 'Pending Verification') AS status,
                verifiedBy,
                FORMAT(verifiedAt, 'yyyy-MM-dd HH:mm') AS verifiedAt
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
// 8. FETCH PENDING EXAMS FOR SUPERVISOR QUEUE
// ============================================================
// ============================================================
// 8. FETCH PENDING EXAMS FOR SUPERVISOR QUEUE
// ============================================================

const getCompetencyReports = async (req, res) => {
    try {
        await ensureCompetencyColumns();

        const { shiftIncharge } = req.query;
        const request = new sql.Request();

        let query = `
            SELECT
                id,
                employeeNo,
                employeeName,
                line,

                CONVERT(
                    VARCHAR(10),
                    TRY_CONVERT(DATE, doj, 23),
                    23
                ) AS doj,

                CONVERT(
                    VARCHAR(10),
                    TRY_CONVERT(DATE, examDate, 23),
                    23
                ) AS examDate,

                qualification,
                score,
                evaluatedBy,

                ISNULL(
                    status,
                    'Pending Verification'
                ) AS status,

                verifiedBy,

                CONVERT(
                    VARCHAR(16),
                    verifiedAt,
                    120
                ) AS verifiedAt

            FROM CompetencyQualificationExam

            WHERE ISNULL(
                status,
                'Pending Verification'
            ) = 'Pending Verification'
        `;

        if (shiftIncharge) {
            request.input(
                'shiftIncharge',
                sql.NVarChar(100),
                shiftIncharge.trim()
            );

            query += `
                AND (
                    LOWER(evaluatedBy) = LOWER(@shiftIncharge)
                    OR evaluatedBy IS NULL
                    OR evaluatedBy = ''
                )
            `;
        }

        query += ` ORDER BY id DESC`;

        const result = await request.query(query);

        return res.status(200).json(result.recordset);

    } catch (err) {
        console.error("Fetch reports error:", err);

        return res.status(500).json({
            error: 'Failed to fetch exam reports'
        });
    }
};

// ============================================================
// 9. SHIFT INCHARGE VERIFY EXAM
// ============================================================
const verifyCompetencyExam = async (req, res) => {
    const { employeeNo, line, examDate, verifiedBy } = req.body;

    if (!employeeNo || !line || !examDate) {
        return res.status(400).json({ error: 'Missing employeeNo, line, or examDate' });
    }

    try {
        await ensureCompetencyColumns();
        const cleanDate = String(examDate).split('T')[0];

        const request = new sql.Request();
        request.input('employeeNo', sql.NVarChar(50), employeeNo)
            .input('line', sql.NVarChar(50), line)
            .input('examDate', sql.NVarChar(50), cleanDate)
            .input('verifiedBy', sql.NVarChar(100), verifiedBy || 'Shift Incharge');

        const updateQuery = `
            UPDATE CompetencyQualificationExam
            SET status = 'Verified',
                verifiedBy = @verifiedBy,
                verifiedAt = GETDATE()
            WHERE employeeNo = @employeeNo
              AND line = @line
              AND CONVERT(date, examDate) = CONVERT(date, @examDate)
        `;

        const result = await request.query(updateQuery);
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Exam record not found for verification' });
        }

        return res.status(200).json({ message: 'Exam verified successfully!' });
    } catch (err) {
        console.error("Verify exam error:", err);
        return res.status(500).json({ error: 'Failed to verify exam record' });
    }
};

// ============================================================
// 10. GENERATE STRUCTURED TABLE PDF (SINGLE OR MULTI-RECORD DATE RANGE)
// ============================================================
const generateCompetencyReport = async (req, res) => {
    try {
        const { employeeNo, line, lineCode, examDate, fromDate, toDate } = req.query;
        const lineParam = line || lineCode;

        await ensureCompetencyColumns();

        const request = new sql.Request();
        let query = `SELECT * FROM CompetencyQualificationExam WHERE 1=1`;

        if (fromDate && toDate) {
            query += ` AND CONVERT(date, examDate) BETWEEN @fromDate AND @toDate`;
            request.input('fromDate', sql.Date, fromDate);
            request.input('toDate', sql.Date, toDate);
        } else if (employeeNo && examDate) {
            const cleanDate = String(examDate).split('T')[0];
            query += ` AND employeeNo = @employeeNo AND CONVERT(date, examDate) = CONVERT(date, @examDate)`;
            request.input('employeeNo', sql.NVarChar(50), employeeNo);
            request.input('examDate', sql.NVarChar(50), cleanDate);

            if (lineParam) {
                query += ` AND line = @line`;
                request.input('line', sql.NVarChar(50), lineParam);
            }
        } else {
            return res.status(400).json({ error: "Provide either (fromDate and toDate) or (employeeNo and examDate)." });
        }

        query += ` ORDER BY examDate ASC, employeeNo ASC`;

        const result = await request.query(query);
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "No exam records found." });
        }

        const records = result.recordset;

        // Fetch dynamic answer key
        const qReq = new sql.Request();
        const qResult = await qReq.query(`SELECT id, questionText, correctAnswer FROM CompetencyExamQuestions ORDER BY id ASC`);
        const answerKey = {};
        const questionTextMap = {};
        qResult.recordset.forEach(row => {
            answerKey[row.id] = row.correctAnswer;
            questionTextMap[row.id] = row.questionText;
        });

        const doc = new PDFDocument({ margin: 30, size: "A4", bufferPages: true });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition", 
            `attachment; filename=Competency_Report_${fromDate || employeeNo}_${toDate || examDate}.pdf`
        );
        doc.pipe(res);

        records.forEach((data, recIdx) => {
            if (recIdx > 0) doc.addPage();

            const answers = JSON.parse(data.answers || '{}');
            const cleanDate = data.examDate ? String(data.examDate).split('T')[0] : '';

            // --- TITLE HEADER ---
            doc.font("Helvetica-Bold").fontSize(13).text("SAKTHI AUTO COMPONENT LIMITED", { align: "center" });
            doc.fontSize(10).fillColor("#444444").text("LEVEL 3 COMPETENCY QUALIFICATION EVALUATION REPORT - VTL & HTL", { align: "center" });
            doc.moveDown(0.8);

            // --- EMPLOYEE DETAILS PANEL ---
            const boxTop = doc.y;
            doc.rect(30, boxTop, 535, 60).strokeColor("#B0B0B0").lineWidth(1).stroke();
            
            doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#000000");
            doc.text(`Emp No:`, 40, boxTop + 8);
            doc.font("Helvetica").text(data.employeeNo, 90, boxTop + 8);

            doc.font("Helvetica-Bold").text(`Name:`, 210, boxTop + 8);
            doc.font("Helvetica").text(data.employeeName || 'N/A', 245, boxTop + 8);

            doc.font("Helvetica-Bold").text(`Line:`, 410, boxTop + 8);
            doc.font("Helvetica").text(data.line || 'N/A', 440, boxTop + 8);

            doc.font("Helvetica-Bold").text(`DOJ:`, 40, boxTop + 24);
            doc.font("Helvetica").text(data.doj ? new Date(data.doj).toISOString().split('T')[0] : 'N/A', 90, boxTop + 24);

            doc.font("Helvetica-Bold").text(`Date:`, 210, boxTop + 24);
            doc.font("Helvetica").text(cleanDate, 245, boxTop + 24);

            doc.font("Helvetica-Bold").text(`Qualification:`, 410, boxTop + 24);
            doc.font("Helvetica").text(data.qualification || 'N/A', 475, boxTop + 24);

            doc.font("Helvetica-Bold").text(`Evaluated By:`, 40, boxTop + 40);
            doc.font("Helvetica").text(data.evaluatedBy || 'N/A', 110, boxTop + 40);

            doc.font("Helvetica-Bold").text(`Status:`, 210, boxTop + 40);
            const isVerified = (data.status === 'Verified');
            doc.font("Helvetica-Bold").fillColor(isVerified ? "#008000" : "#D97706").text(
                isVerified ? `Verified (${data.verifiedBy || 'Shift Incharge'})` : 'Pending Verification', 
                250, 
                boxTop + 40
            );

            doc.font("Helvetica-Bold").fillColor("#000000").text(`Score:`, 410, boxTop + 40);
            doc.font("Helvetica-Bold").fillColor(data.score >= 70 ? "#008000" : "#D32F2F").text(`${data.score} / 100`, 445, boxTop + 40);

            doc.moveDown(3.2);

            // --- TABLE LAYOUT ---
            const startX = 30;
            const colWidths = [50, 140, 160, 185]; 
            const rowHeight = 20;
            let currentY = doc.y;

            doc.fillColor("#000000").font("Helvetica-Bold").fontSize(9);
            doc.rect(startX, currentY, 535, rowHeight).fill("#E2E8F0").stroke();
            
            doc.fillColor("#000000");
            doc.text("Q. No", startX + 10, currentY + 6, { width: colWidths[0], align: "left" });
            doc.text("Selected Answer", startX + colWidths[0], currentY + 6, { width: colWidths[1], align: "center" });
            doc.text("Status", startX + colWidths[0] + colWidths[1], currentY + 6, { width: colWidths[2], align: "center" });
            doc.text("Correct Answer (Key)", startX + colWidths[0] + colWidths[1] + colWidths[2], currentY + 6, { width: colWidths[3], align: "center" });

            currentY += rowHeight;

            // --- TABLE ROWS ---
            doc.font("Helvetica").fontSize(9);
            const questionIds = Object.keys(answerKey);
            for (let idx = 0; idx < questionIds.length; idx++) {
                const qId = questionIds[idx];
                if (currentY > 750) { 
                    doc.addPage();
                    currentY = 40;
                }

                const selectedOpt = answers[qId] || "Unanswered";
                const correctOpt = answerKey[qId];
                const isCorrect = selectedOpt === correctOpt;

                const rowBg = idx % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
                doc.rect(startX, currentY, 535, rowHeight).fill(rowBg).strokeColor("#CBD5E1").lineWidth(0.5).stroke();

                doc.fillColor("#000000").font("Helvetica-Bold");
                doc.text(`Q${idx + 1}`, startX + 10, currentY + 6, { width: colWidths[0], align: "left" });

                doc.font("Helvetica");
                doc.text(`Option ${selectedOpt}`, startX + colWidths[0], currentY + 6, { width: colWidths[1], align: "center" });

                if (isCorrect) {
                    doc.fillColor("#16A34A").font("Helvetica-Bold");
                    doc.text("✓ Correct", startX + colWidths[0] + colWidths[1], currentY + 6, { width: colWidths[2], align: "center" });

                    doc.fillColor("#334155").font("Helvetica");
                    doc.text(`Option ${correctOpt}`, startX + colWidths[0] + colWidths[1] + colWidths[2], currentY + 6, { width: colWidths[3], align: "center" });
                } else {
                    doc.fillColor("#DC2626").font("Helvetica-Bold");
                    doc.text("X Incorrect", startX + colWidths[0] + colWidths[1], currentY + 6, { width: colWidths[2], align: "center" });

                    doc.save();
                    const badgeX = startX + colWidths[0] + colWidths[1] + colWidths[2] + 45;
                    const badgeY = currentY + 3;
                    doc.roundedRect(badgeX, badgeY, 95, 14, 3).fill("#FEF08A").stroke();
                    doc.fillColor("#854D0E").font("Helvetica-Bold");
                    doc.text(`Option ${correctOpt}`, badgeX, badgeY + 3, { width: 95, align: "center" });
                    doc.restore();
                }

                currentY += rowHeight;
            }
        });

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
    getShiftIncharges,
    getCompetencyQuestions,
    addCompetencyQuestion,
    deleteCompetencyQuestion,
    saveCompetencyExam,
    getCompetencyExam,
    getCompetencyReports,
    verifyCompetencyExam,
    generateCompetencyReport
};