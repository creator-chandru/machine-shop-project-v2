const express = require('express');
const router = express.Router();
const partQtyController = require('../controllers/partQtyController');

// GET /api/parts/:shopId
router.get('/:shopId', partQtyController.getPartsByShop);

// PUT /api/parts/:shopId/:partId
router.put('/:shopId/:partId', partQtyController.updatePartQuantities);

module.exports = router;