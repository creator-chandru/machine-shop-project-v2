const express = require('express');
const router = express.Router();

const {
    saveAirGapSensor,
    getPendingAirGapData,
    getAirGapSensorCheckSheet
} = require('../controllers/airGapSensorController.js');

// ============================================================
// SAVE AIR GAP SENSOR CHECK SHEET
// ============================================================

router.post(
    '/air-gap-sensor',
    saveAirGapSensor
);

// ============================================================
// GET PENDING DATA FROM ERROR PROOFING
// ============================================================

router.get(
    '/air-gap-sensor/pending',
    getPendingAirGapData
);
// ============================================================
// GET SAVED AIR GAP SENSOR DATA
// ============================================================
router.get(
    '/air-gap-sensor',
    getAirGapSensorCheckSheet
);
module.exports = router;