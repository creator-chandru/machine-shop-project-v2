const express = require('express');
const router = express.Router();

const {
  getEmployeePlans,
  saveOperatorObservationPlan,
  generateReport
} = require('../controllers/operatorObservationPlanController.js');

// 1. Load an employee's saved plans (by machineShop + empNo)
router.get('/operator-observation-plan/employee', getEmployeePlans);

// 2. Save / Update Operator Observation Plan
router.post('/operator-observation-plan', saveOperatorObservationPlan);

// 3. PDF report for a specific empNo
router.get('/operator-observation-plan/report', generateReport);

module.exports = router;