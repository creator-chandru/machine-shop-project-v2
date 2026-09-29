const express = require('express');
const router = express.Router();
const partMappingController = require('../controllers/partMappingController');

router.get('/:shopId/lines', partMappingController.getLineCodes);
router.get('/:shopId/part-sets', partMappingController.getPartSets);
router.put('/:shopId/mapping', partMappingController.updateMapping);

module.exports = router;