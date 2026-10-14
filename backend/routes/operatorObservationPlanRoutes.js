const express = require('express');
const router = express.Router();

const {
  getEmployeePlans,
  saveOperatorObservationPlan,
  generateReport,
  getEmployeeNumberOptions,
  removeEmployeeNumberOption
} = require('../controllers/operatorObservationPlanController.js');

// Existing routes
router.get('/operator-observation-plan/employee', getEmployeePlans);
router.post('/operator-observation-plan', saveOperatorObservationPlan);
router.get('/operator-observation-plan/report', generateReport);

// Employee options dropdown routes
router.get('/operator-observation-plan/employee-options', getEmployeeNumberOptions);
router.delete('/operator-observation-plan/employee-options', removeEmployeeNumberOption);

module.exports = router;