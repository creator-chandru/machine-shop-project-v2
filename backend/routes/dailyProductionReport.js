const express = require('express');
const router = express.Router();

const {
  getMachineShopDetails,
  saveDailyProductionReport,
  getDailyProductionRecords,
  getQcReports,
  getPeReports,
  getHofReports,
  signQcApproval,
  signPeApproval,
  signHofApproval,
  generateReport,
  getPartTraceability,
  getIncharges,
  getPeIncharges,
  getHofIncharges
} = require('../controllers/dailyProductionReportController.js');

// 1. Master Data
router.get('/machine-shop/:shopId/details', getMachineShopDetails);

// 2. Approver Dropdowns
router.get('/daily-production-report/incharges', getIncharges);
router.get('/daily-production-report/pe-incharges', getPeIncharges);
router.get('/daily-production-report/hof-incharges', getHofIncharges);

// 3. Traceability
router.get('/daily-production-report/traceability', getPartTraceability);

// 4. Save / Update Daily Production Report
router.post('/daily-production-report', saveDailyProductionReport);

// 5. Fetch Daily Production Record (by lineCode, date, shift)
router.get('/daily-production-report', getDailyProductionRecords);

// 6. QC Pending Reports List & Sign
router.get('/daily-production-report/qc/:name', getQcReports);
router.post('/daily-production-report/sign-qc', signQcApproval);

// 7. PE Pending Reports List & Sign
router.get('/daily-production-report/pe/:name', getPeReports);
router.post('/daily-production-report/sign-pe', signPeApproval);

// 8. HOF Pending Reports List & Sign
router.get('/daily-production-report/hof/:name', getHofReports);
router.post('/daily-production-report/sign-hof', signHofApproval);

// 9. PDF Preview & Report Generation
router.get('/daily-production-report/report', generateReport);

module.exports = router;