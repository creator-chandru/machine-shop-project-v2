const express = require('express');
const router = express.Router();

const {
    saveFourMChangeMonitoring
} = require('../controllers/fourMChangeMonitoringCheckSheetController.js');

router.post(
    '/four-m-change-monitoring',
    saveFourMChangeMonitoring
);

module.exports = router;