const express = require('express');
const router = express.Router();

const {
  getMachineShopDetails,
  saveDailyProductionReport,
  getPartTraceability
} = require('../controllers/dailyProductionReportController.js');

// ============================================================
// MACHINE SHOP MASTER DATA (DYNAMIC)
// ============================================================
router.get(
  '/machine-shop/:shopId/details',
  getMachineShopDetails
);

// ============================================================
// DAILY PRODUCTION REPORT
// ============================================================
router.post(
  '/daily-production-report',
  saveDailyProductionReport
);

// Get Part Traceability
router.get(
  '/daily-production-report/traceability',
  getPartTraceability
);

module.exports = router;