const express = require('express');
const router = express.Router();

const {
  saveEightDReport,
  getEightDReports,
  getEightDReportById,
  generateEightDPdf,
  signEightDApproval
} = require('../controllers/8DProblemSolvingReportController.js');

// 1. Save or Update 8D Report
router.post('/8d-report', saveEightDReport);

// 2. Fetch 8D Reports (by shopId, customer, partNo, date)
router.get('/8d-report', getEightDReports);

// 3. Fetch single 8D Report by ID
router.get('/8d-report/:id', getEightDReportById);

// 4. Role Sign-off
router.post('/8d-report/sign', signEightDApproval);

// 5. Generate Landscape PDFkit 8D Report (2 Pages)
router.get('/8d-report/pdf', generateEightDPdf);

module.exports = router;