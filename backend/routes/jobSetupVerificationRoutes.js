const express = require("express");
const router = express.Router();
const {
  getControlSpecifications,
  saveControlSpecifications,
  saveJobSetupVerification,
  getJobSetupVerificationById,
  generatePdfReport
} = require("../controllers/jobSetupVerificationController");

// 1. Fetch reusable master control specifications
router.get("/job-setup-verification/specifications", getControlSpecifications);

// 2. Save or update master control specifications
router.put("/job-setup-verification/specifications", saveControlSpecifications);

// 3. Save / Update actual verification record
router.post("/job-setup-verification", saveJobSetupVerification);

// 4. Retrieve single verification record by ID
router.get("/job-setup-verification/:id", getJobSetupVerificationById);

// 5. PDF Report Generation & Preview (Matches exampleRoutes.js)
router.get("/job-setup-verification/report", generatePdfReport);

module.exports = router;