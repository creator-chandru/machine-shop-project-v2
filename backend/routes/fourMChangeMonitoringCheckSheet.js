const express = require('express');
const router = express.Router();

const {
    getFourMChangeMonitoringDetails,
    getFourMChangeMonitoringLineDetails,
    getHODUsers,
    saveFourMChangeMonitoring,
    getPendingHODReports,
    signHODApproval,
    generate4MReport
} = require('../controllers/fourMChangeMonitoringCheckSheetController.js');

router.get('/four-m-change-monitoring/:shopId/details', getFourMChangeMonitoringDetails);
router.get('/four-m-change-monitoring/:shopId/line-details', getFourMChangeMonitoringLineDetails);

// HOD User Dropdown
router.get('/four-m-change-monitoring/hods', getHODUsers);

// Save logic
router.post('/four-m-change-monitoring', saveFourMChangeMonitoring);

// HOD Pending Dashboard Route
router.get('/four-m-change-monitoring/hod/pending/:name', getPendingHODReports);

// HOD Sign Approval
router.post('/four-m-change-monitoring/hod/sign', signHODApproval);

// HOD Report Download
router.get('/four-m-change-monitoring/report', generate4MReport);

module.exports = router;