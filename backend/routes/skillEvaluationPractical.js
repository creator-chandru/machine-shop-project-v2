const express = require('express');
const router = express.Router();

const {
    saveSkillEvaluationPractical,
    getSkillEvaluationPractical
} = require('../controllers/skillEvaluationPracticalController.js');

// ============================================================
// SAVE SKILL EVALUATION PRACTICAL
// ============================================================
router.post(
    '/skill-evaluation-practical',
    saveSkillEvaluationPractical
);

// ============================================================
// GET SAVED SKILL EVALUATION PRACTICAL DATA
// ============================================================
router.get(
    '/skill-evaluation-practical',
    getSkillEvaluationPractical
);

module.exports = router;