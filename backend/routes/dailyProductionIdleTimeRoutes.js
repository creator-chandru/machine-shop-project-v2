const express = require('express');
const router = express.Router();

const {
  getMachineShopDetails,
  getPartQuantities,
  getPEUsers,
  getDailyProductionIdleTime,
  saveDailyProductionIdleTime,
  getPendingPEIdleTimeData,
  signPEApproval,
  generateIdleTimeReport
} = require('../controllers/dailyProductionIdleTimeController.js');

// Auto-fetch master data endpoint 
router.get(
  '/machine-shop/:shopId/details',
  getMachineShopDetails
);

// Auto-fetch part quantities endpoint
router.get(
  '/machine-shop/:shopId/part-quantities',
  getPartQuantities
);

// Get PE Users for selection dropdown
router.get(
  '/daily-production-idle-time/pe/users',
  getPEUsers
);

// Get Pending Idle Time Reports for Product Engineer Dashboard
router.get(
  '/daily-production-idle-time/pe/pending/:name',
  getPendingPEIdleTimeData
);

// PE sign and approve endpoint
router.post(
  '/daily-production-idle-time/pe/sign',
  signPEApproval
);

// Generate PDF Report Preview endpoint
router.get(
  '/daily-production-idle-time/report',
  generateIdleTimeReport
);

// Fetch saved form data endpoint
router.get(
  '/daily-production-idle-time',
  getDailyProductionIdleTime
);

// Save form endpoint
router.post(
  '/daily-production-idle-time',
  saveDailyProductionIdleTime
);

module.exports = router;