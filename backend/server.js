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
const dailyProductionRoutes = require("./routes/dailyProductionRoutes.js");
const dailyProductionIdleTimeRoutes = require("./routes/dailyProductionIdleTimeRoutes.js"); 
const partQtyRoutes = require("./routes/partQtyRoutes.js");

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

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
app.use('/api/parts', partQtyRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});