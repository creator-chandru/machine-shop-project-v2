require("dotenv").config();
const express = require("express");
const cors = require("cors");
require("./db");

const authRoutes = require("./routes/auth");
const verifyToken = require('./middleware/authMiddleware');
const preOperationCheckListRoutes = require("./routes/preOperationChecklist.js");
const errorProofingCheckSheetRoutes = require("./routes/errorProofingCheckSheet.js");
const airGapSensorCheckSheetRoutes = require("./routes/airGapSensorCheckSheet.js");
const fourMChangeMonitoringCheckSheetRoutes = require("./routes/fourMChangeMonitoringCheckSheet.js");
const ToolsChangeRecord=require("./routes/ToolsChangeRecord.js");
const RecordofSignifcantEvent=require("./routes/RecordOfSignificantEvent.js");
const dailyProductionRoutes = require("./routes/dailyProductionReport.js");
const dailyProductionIdleTimeRoutes = require("./routes/dailyProductionIdleTimeRoutes.js"); 
const partQtyRoutes = require("./routes/partQtyRoutes.js");
const partMappingRoutes = require("./routes/partMappingRoutes.js");
const operatorObservationSheetRoutes = require("./routes/operatorObservationSheetRouter.js");
const skillEvaluationPracticalRoutes = require("./routes/skillEvaluationPractical.js");
const competencyEvaluationFormRoutes = require("./routes/competencyEvaluationFormRoutes.js");
const correctiveActionRoutes = require("./routes/correction_action_register.js");
const jigFixtureIntimationReportRoutes=require("./routes/jig_fixture_intimation_report.js");
const eightDProblemSolvingReportRoutes = require("./routes/8DProblemSolvingReport.js");
const operatorAllotmentRoutes = require("./routes/OperatorAllotment.js");
const jobSetupVerificationRoutes = require("./routes/jobSetupVerificationRoutes.js");
const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use('/api', operatorAllotmentRoutes);
// Protect all other routes starting with /api
app.use("/api", verifyToken);

app.use("/api", preOperationCheckListRoutes);
app.use('/api', errorProofingCheckSheetRoutes);
app.use('/api',airGapSensorCheckSheetRoutes);
app.use('/api',fourMChangeMonitoringCheckSheetRoutes);
app.use('/api',ToolsChangeRecord);
app.use('/api',RecordofSignifcantEvent);
app.use('/api', dailyProductionRoutes);
app.use('/api', dailyProductionIdleTimeRoutes);
app.use('/api', operatorObservationSheetRoutes);
app.use('/api', skillEvaluationPracticalRoutes);
app.use('/api', competencyEvaluationFormRoutes);
app.use('/api/parts', partQtyRoutes);
app.use('/api/mappings', partMappingRoutes);
app.use('/api/corrective-action-register', correctiveActionRoutes);
app.use('/api/jig-fixture-issue', jigFixtureIntimationReportRoutes);
app.use('/api', eightDProblemSolvingReportRoutes);
app.use('/api', jobSetupVerificationRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});