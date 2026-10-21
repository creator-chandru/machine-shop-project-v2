const express = require('express');
const router = express.Router();

const {
  saveBreakdownIntimationReport,
  getBreakdownIntimationReports,
  getPePendingBreakdownReports,
  signPeBreakdownReport,
  generateBreakdownPdfReport,
} = require('../controllers/breakDownController.js');

// --- ADDED: QF Values Controller Imports ---
const {
  getFormSettings,
  updateFormSettings,
  getFormQfHistory,
} = require('../controllers/QFController.js');

// 1. Save or submit Breakdown Intimation Report
router.post('/breakdown-intimation-report', saveBreakdownIntimationReport);

// 2. Fetch records (with query params lineNo, machineNo, date, shift)
router.get('/breakdown-intimation-report', getBreakdownIntimationReports);

// 3. PE Pending Breakdown Reports
router.get('/breakdown-intimation-report/pe/:name', getPePendingBreakdownReports);

// 4. PE Sign/Approve Breakdown Report
router.post('/breakdown-intimation-report/sign-pe', signPeBreakdownReport);

// 5. PDF generation for review modal & download
router.get('/breakdown-intimation-report/report', generateBreakdownPdfReport);

// --- ADDED: QF Values Routes ---
router.get('/qf-values', getFormSettings);
router.put('/qf-values', updateFormSettings);
router.get('/qf-values/history/:formName', getFormQfHistory);

module.exports = router;