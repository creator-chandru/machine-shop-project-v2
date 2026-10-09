const express = require('express');
const router = express.Router();
const { addPartSet } = require('../controllers/partSetController.js');

router.post('/', addPartSet);

module.exports = router;