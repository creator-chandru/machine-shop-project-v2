const express = require('express');
const router = express.Router();

const {
    getIncharges,
    saveToolChangeRecord,
    getToolChangeRecords,
    getQcReports,
    signQcApproval,
    generateReport,
    getPartTraceability
} = require('../controllers/toolChangeRecordController.js');

// 1. GET QC Incharges List (For Shift Incharge dropdown)
router.get('/incharges', getIncharges);
// Same handler under the path the frontend actually calls
router.get('/tool-change-record/incharges', getIncharges);


// 2. POST Save / Submit Tool Change Record
router.post('/tool-change-record', saveToolChangeRecord);

// 3. GET Fetch Tool Change Records (By lineCode, date, machineNo)
router.get('/tool-change-record', getToolChangeRecords);

// 4. GET Generate Traceability Code
router.get('/tool-change-record/traceability', getPartTraceability);

// 5. GET QC Dashboard Pending Reports
router.get('/tool-change-record/qc/:name', getQcReports);

// 6. POST QC Signature Approval
router.post('/tool-change-record/sign-qc', signQcApproval);

// 7. GET PDF Preview / Download
router.get('/tool-change-record/report', generateReport);

module.exports = router;