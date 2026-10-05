const express = require('express');
const router = express.Router();

const {
  getMachineShop3Details,
  getMachineShop3LineDetails,
  savePreOperationChecklist,
  getLatestMachineParams,
  getPreOperationRecord,
  generatePreOperationReport
} = require('../controllers/preOperationChecklistController.js');

// ============================================================
// MACHINE SHOP 3 MASTER DATA
// ============================================================
router.get('/machine-shop/3/pre-operation-details', getMachineShop3Details);
router.get('/machine-shop/3/pre-operation-details/:lineCode', getMachineShop3LineDetails);

// ============================================================
// PRE-OPERATION CHECKLIST DATA & OPERATIONS
// ============================================================
router.post('/pre-operation-checklist', savePreOperationChecklist);
router.get('/pre-operation-checklist/record', getPreOperationRecord);
router.get('/pre-operation-checklist/report', generatePreOperationReport);
router.get('/machine-shop/:shopId/latest-params', getLatestMachineParams);

module.exports = router;