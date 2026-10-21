const express = require("express");
const router = express.Router();
const qfController = require("../controllers/QFController.js");

// --- FORM SETTINGS (QF VALUES) ROUTES ---
router.get("/qf-values", qfController.getFormSettings);
router.put("/qf-values", qfController.updateFormSettings);
router.get("/qf-values/history/:formName", qfController.getFormQfHistory);

module.exports = router;