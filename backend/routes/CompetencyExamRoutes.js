const express = require('express');
const router = express.Router();

const {
    getAllLines,
    saveCompetencyExam,
    getCompetencyExam,
    generateCompetencyReport
} = require('../controllers/competencyExamController.js');

// 1. Line Codes Dropdown
router.get('/competency-exam/lines', getAllLines);

// 2. Main Exam CRUD Endpoints
router.post('/competency-exam', saveCompetencyExam);
router.get('/competency-exam', getCompetencyExam);
router.get('/competency-exam/report', generateCompetencyReport);

module.exports = router;