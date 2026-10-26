const express = require('express');
const router = express.Router();

const {
    getApproverUsers,
    saveRobotManualTransition,
    getPendingApprovals,
    signApproval,
    getRobotManualTransition,
    generateReport,
    generateDayReport
} = require('../controllers/robotManualTransitionController.js');

// 1. Get Approver Users for Dropdown
router.get('/robot-manual/approver/users', getApproverUsers);

// 2. Save Checksheet
router.post('/robot-manual', saveRobotManualTransition);

// 3. Get Pending Reports for Approver Dashboard
router.get('/robot-manual/approver/pending/:name', getPendingApprovals);

// 4. Signature Approval endpoint
router.post('/robot-manual/approver/sign', signApproval);

// 5. Get Saved Robot Manual Transition Checksheet Data
router.get('/robot-manual', getRobotManualTransition);

// 6. Report PDF
//    - Form page         -> fromDate + toDate -> range PDF
//    - Approver dashboard -> lineCode + date   -> single-day PDF
router.get('/robot-manual/report', (req, res) =>
    (req.query.fromDate && req.query.toDate)
        ? generateReport(req, res)
        : generateDayReport(req, res)
);

module.exports = router;