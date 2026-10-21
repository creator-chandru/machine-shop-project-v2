const express = require('express');
const router = express.Router();

const {
    getOperatorAllotmentLines,
    getProductManagers,
    getOperatorAllotmentQfValue,
    getOperatorAllotment,
    saveOperatorAllotment,
    getPendingPEOperatorAllotment,
    signPEOperatorAllotment,
    generateOperatorAllotmentReport
} = require('../controllers/operatorAllotmentController');

router.get('/operator-allotment/lines', getOperatorAllotmentLines);
router.get('/operator-allotment/product-managers', getProductManagers);
router.get('/operator-allotment/qf-value', getOperatorAllotmentQfValue);
router.get('/operator-allotment/report', generateOperatorAllotmentReport);
router.get('/operator-allotment', getOperatorAllotment);
router.post('/operator-allotment', saveOperatorAllotment);

// Split routes (instead of an optional param) to avoid the path-to-regexp PathError
router.get('/operator-allotment/pe/pending', getPendingPEOperatorAllotment);
router.get('/operator-allotment/pe/pending/:name', getPendingPEOperatorAllotment);

router.post('/operator-allotment/pe/sign', signPEOperatorAllotment);

module.exports = router;