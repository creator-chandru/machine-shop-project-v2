const express = require('express');
const router = express.Router();

const {
  getMachineShopDetails,
  getPartQuantities,
  getIncharges,
  getPeIncharges,
  getHofIncharges,
  getPEUsers,
  getPartTraceability,
  getDailyProductionIdleTime,
  saveDailyProductionIdleTime,
  getQcIdleTimeReports,
  signQcIdleTimeApproval,
  getPendingPEIdleTimeData,
  signPEApproval,
  getHofIdleTimeReports,
  signHofIdleTimeApproval,
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

// Get Approver Dropdowns
router.get(
  '/daily-production-idle-time/incharges',
  getIncharges
);
router.get(
  '/daily-production-idle-time/pe-incharges',
  getPeIncharges
);
router.get(
  '/daily-production-idle-time/hof-incharges',
  getHofIncharges
);

// Get PE Users for selection dropdown
router.get(
  '/daily-production-idle-time/pe/users',
  getPEUsers
);

// Traceability
router.get(
  '/daily-production-idle-time/traceability',
  getPartTraceability
);

// Get QC Pending Idle Time Reports & Sign
router.get(
  '/daily-production-idle-time/qc/:name',
  getQcIdleTimeReports
);
router.post(
  '/daily-production-idle-time/sign-qc',
  signQcIdleTimeApproval
);

// Get Pending Idle Time Reports for Product Engineer Dashboard & Sign
router.get(
  '/daily-production-idle-time/pe/pending/:name',
  getPendingPEIdleTimeData
);
router.get(
  '/daily-production-idle-time/pe/:name',
  getPendingPEIdleTimeData
);
router.post(
  '/daily-production-idle-time/pe/sign',
  signPEApproval
);
router.post(
  '/daily-production-idle-time/sign-pe',
  signPEApproval
);

// Get HOF Pending Idle Time Reports & Sign
router.get(
  '/daily-production-idle-time/hof/:name',
  getHofIdleTimeReports
);
router.post(
  '/daily-production-idle-time/sign-hof',
  signHofIdleTimeApproval
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