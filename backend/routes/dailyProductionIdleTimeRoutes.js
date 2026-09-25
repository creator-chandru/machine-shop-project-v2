const express = require('express');
const router = express.Router();

const {
  getMachineShopDetails,
  getPartQuantities, // <-- Import the new function
  saveDailyProductionIdleTime
} = require('../controllers/dailyProductionIdleTimeController.js');

// Auto-fetch master data endpoint 
router.get(
  '/machine-shop/:shopId/details',
  getMachineShopDetails
);

// Auto-fetch part quantities endpoint (NEW)
router.get(
  '/machine-shop/:shopId/part-quantities',
  getPartQuantities
);

// Save form endpoint
router.post(
  '/daily-production-idle-time',
  saveDailyProductionIdleTime
);

module.exports = router;