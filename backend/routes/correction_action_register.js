const express = require('express');
const router = express.Router();
const correctiveActionController = require('../controllers/correctiveActionController');

// GET PART NAMES (Dropdown list)
router.get('/part-names/:shopId', correctiveActionController.getPartNames);

// PRODUCT ENGINEERS AVAILABLE FOR ASSIGNMENT
router.get('/product-engineers', correctiveActionController.getProductEngineers);

// GET EXISTING RECORD (By machineShop, date, and partName)
router.get('/record', correctiveActionController.getRecord);

// SAVE RECORD (With approval signature and category constraint validations)
router.post('/', correctiveActionController.saveRecord);

// PRODUCT ENGINEER PENDING ROWS AND APPROVAL
router.get('/pe/:name', correctiveActionController.getPendingPeRecords);
router.post('/sign-pe', correctiveActionController.signPeApproval);

// GENERATE PDF REPORT (By shopId and date range)
router.get('/report', correctiveActionController.generatePdfReport);

module.exports = router;

