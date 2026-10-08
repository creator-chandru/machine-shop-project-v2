const express = require('express');
const router = express.Router();

const {
  saveEightDReport,
  getEightDReports,
  getEightDReportById,
  generateEightDPdf,
  signEightDApproval,
  getPartSets
} = require('../controllers/8DProblemSolvingReportController.js');

// 1. Static literal endpoints MUST come first
router.get('/8d-report/part-sets', getPartSets);
router.get('/8d-report/pdf', generateEightDPdf);

// 2. Collection endpoints
router.get('/8d-report', getEightDReports);
router.post('/8d-report', saveEightDReport);
router.post('/8d-report/sign', signEightDApproval);

// 3. Parameterized (:id) endpoints MUST come LAST
router.get('/8d-report/:id', getEightDReportById);

module.exports = router;