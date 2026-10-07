const express = require('express');
const router = express.Router();
const correctiveActionController = require('../controllers/correctiveActionController');

// GET PART NAMES (Dropdown list)
router.get('/part-names/:shopId', correctiveActionController.getPartNames);

// GET EXISTING RECORD (By machineShop, date, and partName)
router.get('/record', correctiveActionController.getRecord);

// SAVE RECORD (With approval signature and category constraint validations)
router.post('/', correctiveActionController.saveRecord);

// GENERATE PDF REPORT (By shopId, date, and partName)
router.get('/report', correctiveActionController.generatePdfReport);

module.exports = router;