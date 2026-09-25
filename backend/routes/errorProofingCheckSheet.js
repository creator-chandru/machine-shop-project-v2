const express = require('express');
const router = express.Router();

const {
    saveErrorProofingChecksheet
} = require('../controllers/errorProofingCheckSheetController.js');

router.post(
    '/error-proofing-checksheet',
    saveErrorProofingChecksheet
);

module.exports = router;