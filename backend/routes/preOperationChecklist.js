const express = require('express');

const router = express.Router();

const {
  getMachineShop3Details,
  getMachineShop3LineDetails,
  savePreOperationChecklist,
  getLatestMachineParams
} = require('../controllers/preOperationChecklistController.js');


// ============================================================
// MACHINE SHOP 3 MASTER DATA
// ============================================================

// Get all Machine Shop 3 data
router.get(
  '/machine-shop/3/pre-operation-details',
  getMachineShop3Details
);


// Get data for a specific line code
router.get(
  '/machine-shop/3/pre-operation-details/:lineCode',
  getMachineShop3LineDetails
);


// ============================================================
// PRE-OPERATION CHECKLIST
// ============================================================

// Save pre-operation checklist
router.post(
  '/pre-operation-checklist',
  savePreOperationChecklist
);

// Add this below your existing routes:
router.get(
  '/machine-shop/:shopId/latest-params',
  getLatestMachineParams
);


module.exports = router;