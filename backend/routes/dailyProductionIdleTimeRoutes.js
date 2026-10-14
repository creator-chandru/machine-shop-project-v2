const express = require('express');
const router = express.Router();

const {
  getMachineShopDetails,
  getPartQuantities,
  getPEUsers,
  getPartTraceability,
  getDailyProductionIdleTime,
  saveDailyProductionIdleTime,
  getPendingPEIdleTimeData,
  signPEApproval,
  generateIdleTimeReport,
  generateIdleTimeDayReport // <--- Add single-day report generator
} = require('../controllers/dailyProductionIdleTimeController.js');

// Master data (line codes / part names) 
router.get('/machine-shop/:shopId/details', getMachineShopDetails);

// Capacity per part, set by HOD/HOF
router.get('/machine-shop/:shopId/part-quantities', getPartQuantities);

// PE users for the "Section Incharge (PE)" dropdown
// NOTE: must stay above '/pe/:name'
router.get('/daily-production-idle-time/pe/users', getPEUsers);

// Traceability
router.get('/daily-production-idle-time/traceability', getPartTraceability);

// PE dashboard: pending reports + sign
router.get('/daily-production-idle-time/pe/pending/:name', getPendingPEIdleTimeData);
router.get('/daily-production-idle-time/pe/:name', getPendingPEIdleTimeData);
router.post('/daily-production-idle-time/pe/sign', signPEApproval);
router.post('/daily-production-idle-time/sign-pe', signPEApproval);

// PDF preview / download: Routes range query to generateIdleTimeReport, else single-day approval report
router.get('/daily-production-idle-time/report', (req, res) =>
  (req.query.fromDate && req.query.toDate)
    ? generateIdleTimeReport(req, res)
    : generateIdleTimeDayReport(req, res)
);

// Load saved report for shopId + date (+ lineCode)
router.get('/daily-production-idle-time', getDailyProductionIdleTime);

// Save report (shift incharge submit)
router.post('/daily-production-idle-time', saveDailyProductionIdleTime);

module.exports = router;