const express = require('express');
const router = express.Router();

const {
    saveSignificantEvent,
    getSignificantEventRecords
} = require('../controllers/recordOfSignificantEventController.js');


// POST: Save Record of Significant Event
router.post(
    '/significant-event-record',
    saveSignificantEvent
);


// GET: Fetch Records
router.get(
    '/significant-event-record',
    getSignificantEventRecords
);


module.exports = router;