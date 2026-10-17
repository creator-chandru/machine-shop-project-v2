const express = require('express');
const router = express.Router();

const {
    saveErrorProofingChecksheet,
    getErrorProofingRecord,
    generateErrorProofingReport,
    getErrorProofSuggestions          
} = require('../controllers/errorProofingCheckSheetController.js');

// ...existing routes...

// Dropdown suggestions (master table)
router.get('/error-proofing-checksheet/suggestions', getErrorProofSuggestions);
// Save / update checksheet
router.post('/error-proofing-checksheet', saveErrorProofingChecksheet);

// Load existing record by date & line
router.get('/error-proofing-checksheet/record', getErrorProofingRecord);

// Download PDF report
router.get('/error-proofing-checksheet/report', generateErrorProofingReport);

module.exports = router;