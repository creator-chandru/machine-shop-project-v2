const express = require('express');
const router = express.Router();

const {
    saveErrorProofingChecksheet,
    getErrorProofingRecord,
    generateErrorProofingReport
} = require('../controllers/errorProofingCheckSheetController.js');

// Save / update checksheet
router.post('/error-proofing-checksheet', saveErrorProofingChecksheet);

// Load existing record by date & line
router.get('/error-proofing-checksheet/record', getErrorProofingRecord);

// Download PDF report
router.get('/error-proofing-checksheet/report', generateErrorProofingReport);

module.exports = router;