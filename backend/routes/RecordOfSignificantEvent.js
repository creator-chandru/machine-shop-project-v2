const express = require('express');
const router = express.Router();

const {
    saveSignificantEvent,
    getSignificantEventRecords,
    getMachineShopUsers,
    getPendingSignificantEvents,
    signSignificantEvent,
    generateSignificantEventPDF
} = require('../controllers/recordOfSignificantEventController.js');

// POST: Save Record of Significant Event
router.post('/significant-event-record', saveSignificantEvent);

// GET: Fetch Records
router.get('/significant-event-record', getSignificantEventRecords);

// GET: Fetch Users for Dropdowns (PE, QC, HOF)
router.get('/significant-event-users', getMachineShopUsers);

// GET: Fetch Pending approvals for a specific role
router.get('/significant-event-pending/:role/:username', getPendingSignificantEvents);

// POST: Sign the report
router.post('/significant-event-sign', signSignificantEvent);

// GET: Generate PDF
router.get('/significant-event-report', generateSignificantEventPDF);

module.exports = router;