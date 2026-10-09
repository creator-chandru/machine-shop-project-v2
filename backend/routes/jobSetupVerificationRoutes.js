const express = require("express");
const router = express.Router();
const {
  getControlSpecifications,
  listMasterSpecifications,
  saveControlSpecifications,
  getJobSetupRecord,
  saveJobSetupVerification,
  getJobSetupVerificationById,
  getHofInspectionUsers,
  getQcPending,
  getHofInspectionPending,
  getHofProductionPending,
  signQcApproval,
  signHofInspectionApproval,
  signHofProductionApproval,
  generatePdfReport,
} = require("../controllers/jobSetupVerificationController");

// NOTE: all static routes must be declared BEFORE "/job-setup-verification/:id"

// 1. Master control specifications (keyed by part name only)
router.get("/job-setup-verification/specifications", getControlSpecifications);
router.put("/job-setup-verification/specifications", saveControlSpecifications);
router.get("/job-setup-verification/masters", listMasterSpecifications);

// 2. Approver dropdown for the new HOF-Inspection role
router.get("/job-setup-verification/hof-inspection-users", getHofInspectionUsers);

// 3. Existing filled record lookup (part name + date)
router.get("/job-setup-verification/record", getJobSetupRecord);

// 4. PDF preview
router.get("/job-setup-verification/report", generatePdfReport);

// 5. Pending lists + sign (QC = Inspector, HOF-INSPN, HOF-PRODN)
router.get("/job-setup-verification/qc/:name", getQcPending);
router.post("/job-setup-verification/sign-qc", signQcApproval);

router.get("/job-setup-verification/hof-inspn/:name", getHofInspectionPending);
router.post("/job-setup-verification/sign-hof-inspn", signHofInspectionApproval);

router.get("/job-setup-verification/hof/:name", getHofProductionPending);
router.post("/job-setup-verification/sign-hof", signHofProductionApproval);

// 6. Save verification record (create only; locked afterwards)
router.post("/job-setup-verification", saveJobSetupVerification);

// 7. Single record by ID (keep last)
router.get("/job-setup-verification/:id", getJobSetupVerificationById);

module.exports = router;