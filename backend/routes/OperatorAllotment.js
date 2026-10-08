const express = require('express');
const router = express.Router();

const {
    getOperatorAllotmentLines,
    getProductManagers,
    getOperatorAllotment,
    saveOperatorAllotment,
    getPendingPEOperatorAllotment,
    signPEOperatorAllotment,
    generateOperatorAllotmentReport
} = require('../controllers/operatorAllotmentController');

router.get('/operator-allotment/lines', getOperatorAllotmentLines);
router.get('/operator-allotment/product-managers', getProductManagers);
router.get('/operator-allotment', getOperatorAllotment);
router.post('/operator-allotment', saveOperatorAllotment);

// FIX: Split routes or use :name* to prevent path-to-regexp PathError
router.get('/operator-allotment/pe/pending', getPendingPEOperatorAllotment);
router.get('/operator-allotment/pe/pending/:name', getPendingPEOperatorAllotment);

router.post('/operator-allotment/pe/sign', signPEOperatorAllotment);
router.get('/operator-allotment/report', generateOperatorAllotmentReport);

module.exports = router;