const express = require('express');
const router = express.Router();

const {
    getPEUsers,
    saveAirGapSensor,
    getPendingPEAirGapData,
    signPEApproval,
    getPendingAirGapData,
    getAirGapSensorCheckSheet,
    generateAirGapReport
} = require('../controllers/airGapSensorController.js');

// 1. Get PE Users for Dropdown
router.get('/air-gap-sensor/pe/users', getPEUsers);

// 2. Save Checksheet
router.post('/air-gap-sensor', saveAirGapSensor);

// 3. Get Pending Reports for Product Engineer Dashboard
// THE FIX: Added "/:name" so Express knows to catch "dinesh pre" from the URL
router.get('/air-gap-sensor/pe/pending/:name', getPendingPEAirGapData);

// 4. PE Signature Approval endpoint
router.post('/air-gap-sensor/pe/sign', signPEApproval);

// 5. Get Pending Data from Error Proofing (Standard)
router.get('/air-gap-sensor/pending', getPendingAirGapData);

// 6. Get Saved Air Gap Sensor Data (Standard)
router.get('/air-gap-sensor', getAirGapSensorCheckSheet);

// 7. Download / Preview Monthly Report PDF
router.get('/air-gap-sensor/report', generateAirGapReport);

module.exports = router;