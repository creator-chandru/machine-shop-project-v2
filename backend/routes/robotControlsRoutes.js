const express = require('express');
const router = express.Router();

const {
    getHOFUsers,
    saveRobotControls,
    getPendingHOFData,
    signHOFApproval,
    getRobotControls,
    generateReport,
    generateDayReport,
    getRobotControlsQfHistory
} = require('../controllers/robotControlsController.js');

// 1. Get HOF Users for Dropdown
router.get('/robot-controls/hof/users', getHOFUsers);

// 2. Save Checksheet
router.post('/robot-controls', saveRobotControls);

// 3. Get Pending Reports for HOF Dashboard
router.get('/robot-controls/hof/pending/:name', getPendingHOFData);

// 4. HOF Signature Approval endpoint
router.post('/robot-controls/hof/sign', signHOFApproval);

// 5. Get Saved Robot Controls Checksheet Data
router.get('/robot-controls', getRobotControls);

// 6. Report PDF
router.get('/robot-controls/report', (req, res) =>
    (req.query.fromDate && req.query.toDate)
        ? generateReport(req, res)
        : generateDayReport(req, res)
);

// 7. QF History Endpoint (same as pre-operation)
router.get('/robot-controls/qf-history', getRobotControlsQfHistory);

module.exports = router;