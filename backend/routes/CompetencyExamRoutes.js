const express = require('express');
const router = express.Router();

const {
    getAllLines,
    getCompetencyQuestions,
    addCompetencyQuestion,
    deleteCompetencyQuestion,
    saveCompetencyExam,
    getCompetencyExam,
    generateCompetencyReport
} = require('../controllers/CompetencyExamController.js');

// 1. Line Codes Dropdown
router.get('/competency-exam/lines', getAllLines);

// 2. Dynamic Questions Endpoints
router.get('/competency-exam/questions', getCompetencyQuestions);
router.post('/competency-exam/questions', addCompetencyQuestion);
router.delete('/competency-exam/questions/:id', deleteCompetencyQuestion);

// 3. Main Exam CRUD Endpoints
router.post('/competency-exam', saveCompetencyExam);
router.get('/competency-exam', getCompetencyExam);

// 4. Download PDF Report
router.get('/competency-exam/report', generateCompetencyReport);

module.exports = router;