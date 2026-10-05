const express = require('express');

const router = express.Router();

const {
    getJigFixtureMachineDetails,
    saveJigFixtureIssue
} = require('../controllers/jig_fixture_issue_intimation');


// Get line / machine details
router.get(
    '/machine-details',
    getJigFixtureMachineDetails
);


// Save form
router.post(
    '/',
    saveJigFixtureIssue
);


module.exports = router;