const express = require('express');
const router = express.Router();

const {
    saveOperatorObservationSheet,
    getOperatorObservationSheet,
    generateOperatorObservationPDF
} = require('../controllers/operatorObservationSheetController.js');

// ============================================================
// SAVE OPERATOR OBSERVATION SHEET
// ============================================================
router.post(
    '/operator-observation-sheet',
    saveOperatorObservationSheet
);

// ============================================================
// GET SAVED OPERATOR OBSERVATION SHEET DATA
// ============================================================
router.get(
    '/operator-observation-sheet',
    getOperatorObservationSheet
);

// ============================================================
// GENERATE PDF REPORT
// ============================================================
router.get(
    '/operator-observation-sheet/report',
    generateOperatorObservationPDF
);

module.exports = router;