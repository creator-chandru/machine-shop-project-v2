const express = require('express');
const router = express.Router();

const {
    saveOperatorObservationSheet,
    getOperatorObservationSheet,
    generateOperatorObservationPDF,
    getPendingObservationsForHof, // NEW: Fetch pending approvals for HOF
    signOperatorObservationHof,   // NEW: HOF signature submission
    getHofUsers                   // NEW: Fetch HOF users for dropdown
} = require('../controllers/operatorObservationSheetController.js');

// --- ADDED: QF Values Controller Imports ---
const {
  getFormSettings,
  updateFormSettings,
  getFormQfHistory,
} = require('../controllers/qfController.js');

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

// ============================================================
// GET PENDING OBSERVATIONS FOR HOF DASHBOARD
// ============================================================
router.get(
    '/operator-observation-sheet/pending/hof/:hofUsername',
    getPendingObservationsForHof
);

// ============================================================
// SIGN OPERATOR OBSERVATION (HOF)
// ============================================================
router.post(
    '/operator-observation-sheet/sign-hof',
    signOperatorObservationHof
);

// ============================================================
// GET HOF USERS (For Approved By Dropdown)
// ============================================================
router.get(
    '/users/hof',
    getHofUsers
);

// --- ADDED: QF Values Routes ---
router.get('/qf-values', getFormSettings);
router.put('/qf-values', updateFormSettings);
router.get('/qf-values/history/:formName', getFormQfHistory);

module.exports = router;