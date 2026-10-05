const express = require('express');
const router = express.Router();

const {
  getMachineShopDetails,
  saveDailyProductionReport,
  getDailyProductionRecords,
  getQcReports,
  signQcApproval,
  generateReport,
  getPartTraceability,
  getIncharges
} = require('../controllers/dailyProductionReportController.js');

// 1. Master Data
router.get('/machine-shop/:shopId/details', getMachineShopDetails);

// 2. QC Incharges List for dropdown
router.get('/daily-production-report/incharges', getIncharges);

// 3. Traceability
router.get('/daily-production-report/traceability', getPartTraceability);

// 4. Save / Update Daily Production Report
router.post('/daily-production-report', saveDailyProductionReport);

// 5. Fetch Daily Production Record (by lineCode, date, shift)
router.get('/daily-production-report', getDailyProductionRecords);

// 6. QC Pending Reports List
router.get('/daily-production-report/qc/:name', getQcReports);

// 7. QC Sign Approval
router.post('/daily-production-report/sign-qc', signQcApproval);

// 8. PDF Preview & Report Generation
router.get('/daily-production-report/report', generateReport);

module.exports = router;