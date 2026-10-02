const express = require('express');

const router = express.Router();

const {
    getCorrectiveActionRecords,
    getCorrectiveActionRecordById,
    saveCorrectiveActionRecord,
    updateCorrectiveActionRecord,
    deleteCorrectiveActionRecord
} = require('../controllers/correctiveActionController');


// GET ALL RECORDS
router.get(
    '/:shopId',
    getCorrectiveActionRecords
);


// GET ONE RECORD
router.get(
    '/record/:id',
    getCorrectiveActionRecordById
);


// SAVE
router.post(
    '/',
    saveCorrectiveActionRecord
);


// UPDATE
router.put(
    '/:id',
    updateCorrectiveActionRecord
);


// DELETE
router.delete(
    '/:id',
    deleteCorrectiveActionRecord
);


module.exports = router;