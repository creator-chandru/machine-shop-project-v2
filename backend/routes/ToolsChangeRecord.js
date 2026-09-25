const express = require('express');
const router = express.Router();

const {
    saveToolChangeRecord,
    getToolChangeRecords
} = require('../controllers/toolChangeRecordController.js');


// POST: Save Tool Change Record
router.post(
    '/tool-change-record',
    saveToolChangeRecord
);


// GET: Fetch Tool Change Records
router.get(
    '/tool-change-record',
    getToolChangeRecords
);


module.exports = router;