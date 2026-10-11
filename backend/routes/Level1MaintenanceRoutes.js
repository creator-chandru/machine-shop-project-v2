const express = require("express");

const router = express.Router();

const {
  getProductEngineers,
  saveLevel1Checklist,
  getLevel1Record,
  getPendingLevel1Reports,
  signLevel1PE,
  generateLevel1Report,
} = require("../controllers/Level1MaintenanceController");

// ============================================================
// GET PRODUCT ENGINEERS
// ============================================================

router.get(
  "/level1-maintenance-checklist/product-engineers",
  getProductEngineers
);

// ============================================================
// SAVE CHECKLIST
// ============================================================

router.post(
  "/level1-maintenance-checklist",
  saveLevel1Checklist
);

// ============================================================
// GET EXISTING RECORD
// ============================================================

router.get(
  "/level1-maintenance-checklist/record",
  getLevel1Record
);

// ============================================================
// GET PENDING REPORTS FOR PE
// ============================================================

router.get(
  "/level1-maintenance-checklist/pe/pending",
  getPendingLevel1Reports
);

// ============================================================
// PRODUCT ENGINEER APPROVAL
// ============================================================

router.post(
  "/level1-maintenance-checklist/pe/sign",
  signLevel1PE
);

// ============================================================
// GENERATE PDF
// ============================================================

router.get(
  "/level1-maintenance-checklist/report",
  generateLevel1Report
);

module.exports = router;