const express = require('express');
const router = express.Router();

const {
    getHOFUsers,
    saveLPABottomLevel,
    getPendingHOFLPAData,
    signHOFApproval,
    getLPABottomLevel,
    generateLPAReport,
    generateLPADayReport
} = require('../controllers/layeredProcessAuditController.js');

// 1. Get HOF Users for Dropdown
router.get('/lpa-bottom/hof/users', getHOFUsers);

// 2. Save Checksheet
router.post('/lpa-bottom', saveLPABottomLevel);

// 3. Get Pending Reports for HOF Dashboard
router.get('/lpa-bottom/hof/pending/:name', getPendingHOFLPAData);

// 4. HOF Signature Approval endpoint
router.post('/lpa-bottom/hof/sign', signHOFApproval);
router.post('/lpa-bottom/sign-hof', signHOFApproval);
// 5. Get Saved LPA Bottom Level Checksheet Data
router.get('/lpa-bottom', getLPABottomLevel);

// 6. Report PDF
//    - Form page      -> fromDate + toDate -> range PDF
//    - HOF dashboard  -> lineCode + date   -> single-day PDF
router.get('/lpa-bottom/report', (req, res) =>
    (req.query.fromDate && req.query.toDate)
        ? generateLPAReport(req, res)
        : generateLPADayReport(req, res)
);

module.exports = router;