const express = require('express');
const router = express.Router();

const {
  saveEightDReport,
  getEightDReports,
  getEightDReportById,
  generateEightDPdf,
  signEightDApproval,
  getPartSets,
  // Approver dashboard & signing controllers
  getQcEightDReports,
  getPeEightDReports,
  getHofEightDReports,
  signQcEightDApproval,
  signPeEightDApproval,
  signHofEightDApproval
} = require('../controllers/8DProblemSolvingReportController.js');

// 1. Static literal endpoints MUST come first
router.get('/8d-report/part-sets', getPartSets);
router.get('/8d-report/pdf', generateEightDPdf);

// 2. Pending lists for dashboards
router.get('/8d-report/qc/:name', getQcEightDReports);
router.get('/8d-report/pe/:name', getPeEightDReports);
router.get('/8d-report/hof/:name', getHofEightDReports);

// 3. Approval signature endpoints
router.post('/8d-report/sign-qc', signQcEightDApproval);
router.post('/8d-report/sign-pe', signPeEightDApproval);
router.post('/8d-report/sign-hof', signHofEightDApproval);

// 4. General Report APIs
router.get('/8d-report', getEightDReports);
router.post('/8d-report', saveEightDReport);
router.post('/8d-report/sign', signEightDApproval);

// 5. Parameterized endpoint (:id) MUST come LAST
router.get('/8d-report/:id', getEightDReportById);

module.exports = router;