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

router.get('/competency-evaluation-form/hod-incharges', getHodIncharges);
router.get('/competency-evaluation-form/hod/pending/:name', getPendingHodReports);
router.post('/competency-evaluation-form/sign-hod', signHodApproval);
router.get('/competency-evaluation-form/report', generateReport);
router.post('/competency-evaluation-form', saveCompetencyEvaluationForm);
router.get('/competency-evaluation-form', getCompetencyEvaluationForms);
router.get('/competency-evaluation-form/:employeeNo', getCompetencyEvaluationFormByEmp);

module.exports = router;