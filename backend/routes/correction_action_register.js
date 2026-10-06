const express = require('express');

const router = express.Router();

const correctiveActionController = require('../controllers/correctiveActionController');

// Get part names
router.get(
    '/part-names/:shopId',
    correctiveActionController.getPartNames
);

// Get existing record
router.get(
    '/record',
    correctiveActionController.getRecord
);

// Save record
router.post(
    '/',
    correctiveActionController.saveRecord
);

// Generate PDF
router.get(
    '/report',
    correctiveActionController.generatePdfReport
);

module.exports = router;