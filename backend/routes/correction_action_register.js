const express = require('express');

const router = express.Router();

const correctiveActionController =
    require('../controllers/correctiveActionController');


// ============================================================
// GET PART NAMES
// ============================================================

router.get(
    '/part-names/:shopId',
    correctiveActionController.getPartNames
);


// ============================================================
// GET EXISTING RECORD
// ============================================================

router.get(
    '/record',
    correctiveActionController.getRecord
);


// ============================================================
// SAVE RECORD
// ============================================================

router.post(
    '/',
    correctiveActionController.saveRecord
);


// ============================================================
// GENERATE PDF
// ============================================================

router.get(
    '/report',
    correctiveActionController.generatePdfReport
);


module.exports = router;