const express = require('express');
const router = express.Router();

const {
    saveCompetencyEvaluationForm,
    getCompetencyEvaluationForms,
    getCompetencyEvaluationFormByEmp
} = require('../controllers/competencyEvaluationFormController.js');

// ============================================================
// SAVE COMPETENCY EVALUATION FORM
// ============================================================
router.post(
    '/competency-evaluation-form',
    saveCompetencyEvaluationForm
);

// ============================================================
// GET SAVED COMPETENCY EVALUATION FORMS
// ============================================================
router.get(
    '/competency-evaluation-form',
    getCompetencyEvaluationForms
);

// ============================================================
// GET FORM BY EMPLOYEE NO & DATE
// ============================================================
router.get(
    '/competency-evaluation-form/:employeeNo',
    getCompetencyEvaluationFormByEmp
);

module.exports = router;