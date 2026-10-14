const express = require('express');
const router = express.Router();

const {
    getPEUsers,
    saveAirGapSensor,
    getPendingPEAirGapData,
    signPEApproval,
    getPendingAirGapData,
    getAirGapSensorCheckSheet,
    generateAirGapReport,
    generateAirGapDayReport
} = require('../controllers/airGapSensorController.js');

// 1. Get PE Users for Dropdown
router.get('/air-gap-sensor/pe/users', getPEUsers);

// 2. Save Checksheet
router.post('/air-gap-sensor', saveAirGapSensor);

// 3. Get Pending Reports for Product Engineer Dashboard
router.get('/air-gap-sensor/pe/pending/:name', getPendingPEAirGapData);

// 4. PE Signature Approval endpoint
router.post('/air-gap-sensor/pe/sign', signPEApproval);

// 5. Get Pending Data from Error Proofing (Standard)
router.get('/air-gap-sensor/pending', getPendingAirGapData);

// 6. Get Saved Air Gap Sensor Data (Standard)
router.get('/air-gap-sensor', getAirGapSensorCheckSheet);

// 7. Report PDF
//    - Form page  -> fromDate + toDate  -> range PDF
//    - PE dashboard -> lineCode + date  -> single-day PDF
router.get('/air-gap-sensor/report', (req, res) =>
    (req.query.fromDate && req.query.toDate)
        ? generateAirGapReport(req, res)
        : generateAirGapDayReport(req, res)
);

module.exports = router;