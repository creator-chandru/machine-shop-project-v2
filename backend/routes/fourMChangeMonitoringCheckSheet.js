const express = require('express');
const router = express.Router();

const {
    getFourMChangeMonitoringDetails,
    getFourMChangeMonitoringLineDetails,
    saveFourMChangeMonitoring
} = require('../controllers/fourMChangeMonitoringCheckSheetController.js');


// ============================================================
// GET ALL DETAILS FOR SELECTED MACHINE SHOP
// Example:
// GET /api/four-m-change-monitoring/3/details
// ============================================================
router.get(
    '/four-m-change-monitoring/:shopId/details',
    getFourMChangeMonitoringDetails
);


// ============================================================
// GET DETAILS FOR SELECTED LINE CODE
// Example:
// GET /api/four-m-change-monitoring/3/line-details?lineCode=L01
// ============================================================
router.get(
    '/four-m-change-monitoring/:shopId/line-details',
    getFourMChangeMonitoringLineDetails
);


// ============================================================
// SAVE FOUR M CHANGE MONITORING
// Example:
// POST /api/four-m-change-monitoring
// ============================================================
router.post(
    '/four-m-change-monitoring',
    saveFourMChangeMonitoring
);


module.exports = router;