const express = require('express');
const router = express.Router();

const {
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
} = require('../controllers/CompetencyExamController.js');

// 1. Line Codes Dropdown / Helper
router.get('/competency-exam/lines', getAllLines);

// 2. Shift Incharge Dropdown (For Operator to Select)
router.get('/competency-exam/shift-incharges', getShiftIncharges);

// 3. Dynamic Questions Endpoints
router.get('/competency-exam/questions', getCompetencyQuestions);
router.post('/competency-exam/questions', addCompetencyQuestion);
router.delete('/competency-exam/questions/:id', deleteCompetencyQuestion);

// 4. Main Exam CRUD Endpoints
router.post('/competency-exam', saveCompetencyExam);
router.get('/competency-exam', getCompetencyExam);

// 5. Shift Incharge Reports & Verification
router.get('/competency-exam/reports', getCompetencyReports);
router.post('/competency-exam/verify', verifyCompetencyExam);

// 6. Download PDF Report (Single or Date-Range)
router.get('/competency-exam/report', generateCompetencyReport);

module.exports = router;