const express = require('express');
const router = express.Router();

const {
  getMachineShopDetails,
  saveDailyProductionReport
} = require('../controllers/dailyProductionReportController.js');

// ============================================================
// MACHINE SHOP MASTER DATA (DYNAMIC)
// ============================================================

// Get all Machine Shop data based on dynamic shopId
router.get(
  '/machine-shop/:shopId/details',
  getMachineShopDetails
);

// ============================================================
// DAILY PRODUCTION REPORT
// ============================================================

// Save daily production report
router.post(
  '/daily-production-report',
  saveDailyProductionReport
);

module.exports = router;