const express = require('express');
const router = express.Router();

const {
  saveCompetencyEvaluationForm,
  getCompetencyEvaluationForms,
  getCompetencyEvaluationFormByEmp,
  getHodIncharges,
  getPendingHodReports,
  signHodApproval,
  generateReport
} = require('../controllers/competencyEvaluationFormController.js');

// 1. HOD Incharges List Dropdown
router.get('/competency-evaluation-form/hod-incharges', getHodIncharges);

// 2. Pending Evaluations for HOD Review & Signature
router.get('/competency-evaluation-form/hod/pending/:name', getPendingHodReports);
router.post('/competency-evaluation-form/sign-hod', signHodApproval);

// 3. PDF Report Generator (Date Range & Single Employee)
// MUST BE REGISTERED BEFORE '/competency-evaluation-form/:employeeNo'
router.get('/competency-evaluation-form/report', generateReport);

// 4. Save / Update Competency Evaluation Form
router.post('/competency-evaluation-form', saveCompetencyEvaluationForm);

// 5. Get Saved Competency Evaluation Forms
router.get('/competency-evaluation-form', getCompetencyEvaluationForms);

// 6. Get Form by Employee No & Date
router.get('/competency-evaluation-form/:employeeNo', getCompetencyEvaluationFormByEmp);

module.exports = router;