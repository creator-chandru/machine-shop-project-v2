const sql = require('../db');

// POST: Save Breakdown Intimation / Service Report into single table
const saveBreakdownIntimationReport = async (req, res) => {
    const {
        slNo,
        onlineDocNo,
        basicInfo,
        natureOfFailure,
        maintenanceReceived,
        observation,
        correctiveAction,
        workCompleted,
        performanceReport,
        timeLoss,
        workers,
        spares
    } = req.body;

    try {
        const transaction = new sql.Transaction();
        await transaction.begin();

        const reportResult = await transaction.request()
            .input('slNo', sql.NVarChar, slNo || '')
            .input('onlineDocNo', sql.NVarChar, onlineDocNo || '')
            .input('plantName', sql.NVarChar, basicInfo?.plantName || '')
            .input('lineNo', sql.NVarChar, basicInfo?.lineNo || '')
            .input('machineNo', sql.NVarChar, basicInfo?.machineNo || '')
            .input('reportDate', basicInfo?.date ? sql.Date : sql.NVarChar, basicInfo?.date || null)
            .input('shift', sql.NVarChar, basicInfo?.shift || 'I')
            .input('reportTime', sql.NVarChar, basicInfo?.time || '')
            .input('categoryMechanical', sql.Bit, basicInfo?.category?.mechanical ? 1 : 0)
            .input('categoryElectrical', sql.Bit, basicInfo?.category?.electrical ? 1 : 0)
            .input('failureDescription', sql.NVarChar(sql.MAX), natureOfFailure?.description || '')
            .input('inchargeName', sql.NVarChar, natureOfFailure?.inchargeName || '')
            .input('inchargeSignature', sql.NVarChar, natureOfFailure?.signature || '')
            .input('maintReceivedTime', sql.NVarChar, maintenanceReceived?.time || '')
            .input('maintReceivedName', sql.NVarChar, maintenanceReceived?.name || '')
            .input('maintReceivedSignature', sql.NVarChar, maintenanceReceived?.signature || '')
            .input('observationStartTime', sql.NVarChar, observation?.workStartTime || '')
            .input('observationDescription', sql.NVarChar(sql.MAX), observation?.description || '')
            .input('correctiveActionType', sql.NVarChar, correctiveAction?.actionType || 'Electrical')
            .input('correctiveActionDescription', sql.NVarChar(sql.MAX), correctiveAction?.description || '')
            .input('workCompletedDate', workCompleted?.date ? sql.Date : sql.NVarChar, workCompleted?.date || null)
            .input('workCompletedTime', sql.NVarChar, workCompleted?.time || '')
            .input('workCompletedName', sql.NVarChar, workCompleted?.name || '')
            .input('workCompletedSignature', sql.NVarChar, workCompleted?.signature || '')
            .input('performanceReportDate', performanceReport?.date ? sql.Date : sql.NVarChar, performanceReport?.date || null)
            .input('performanceReportTime', sql.NVarChar, performanceReport?.time || '')
            .input('performanceReportName', sql.NVarChar, performanceReport?.name || '')
            .input('performanceReportSignature', sql.NVarChar, performanceReport?.signature || '')
            .input('timeLossDetailsOt', sql.NVarChar(sql.MAX), timeLoss?.detailsOfOt || '')
            .input('timeLossData', sql.NVarChar(sql.MAX), timeLoss ? JSON.stringify(timeLoss) : '')
            .input('workersData', sql.NVarChar(sql.MAX), workers ? JSON.stringify(workers) : '')
            .input('sparesData', sql.NVarChar(sql.MAX), spares ? JSON.stringify(spares) : '')
            .query(`
                INSERT INTO BreakdownIntimationReport
                (
                    slNo, onlineDocNo, plantName, [lineNo], machineNo,
                    reportDate, shift, reportTime, categoryMechanical, categoryElectrical,
                    failureDescription, inchargeName, inchargeSignature,
                    maintReceivedTime, maintReceivedName, maintReceivedSignature,
                    observationStartTime, observationDescription,
                    correctiveActionType, correctiveActionDescription,
                    workCompletedDate, workCompletedTime, workCompletedName, workCompletedSignature,
                    performanceReportDate, performanceReportTime, performanceReportName, performanceReportSignature,
                    timeLossDetailsOt, timeLossData, workersData, sparesData
                )
                OUTPUT INSERTED.id
                VALUES
                (
                    @slNo, @onlineDocNo, @plantName, @lineNo, @machineNo,
                    @reportDate, @shift, @reportTime, @categoryMechanical, @categoryElectrical,
                    @failureDescription, @inchargeName, @inchargeSignature,
                    @maintReceivedTime, @maintReceivedName, @maintReceivedSignature,
                    @observationStartTime, @observationDescription,
                    @correctiveActionType, @correctiveActionDescription,
                    @workCompletedDate, @workCompletedTime, @workCompletedName, @workCompletedSignature,
                    @performanceReportDate, @performanceReportTime, @performanceReportName, @performanceReportSignature,
                    @timeLossDetailsOt, @timeLossData, @workersData, @sparesData
                )
            `);

        await transaction.commit();

        const reportId = reportResult.recordset[0].id;

        res.status(201).json({
            message: 'Breakdown Intimation / Service Report saved successfully!',
            reportId
        });

    } catch (err) {
        console.error('Error saving breakdown intimation report:', err);
        res.status(500).json({
            error: 'Failed to save breakdown intimation report'
        });
    }
};

// GET: Fetch Breakdown Reports from single table
const getBreakdownIntimationReports = async (req, res) => {
    const { lineNo, machineNo, date } = req.query;

    try {
        let query = `SELECT * FROM BreakdownIntimationReport WHERE 1=1`;
        const request = new sql.Request();

        if (lineNo) {
            request.input('lineNo', sql.NVarChar, `%${lineNo}%`);
            query += ` AND [lineNo] LIKE @lineNo`;
        }

        if (machineNo) {
            request.input('machineNo', sql.NVarChar, `%${machineNo}%`);
            query += ` AND machineNo LIKE @machineNo`;
        }

        if (date) {
            request.input('date', sql.Date, date);
            query += ` AND reportDate = @date`;
        }

        query += ` ORDER BY id DESC`;

        const result = await request.query(query);

        const records = result.recordset.map(r => ({
            ...r,
            timeLoss: r.timeLossData ? JSON.parse(r.timeLossData) : null,
            workers: r.workersData ? JSON.parse(r.workersData) : [],
            spares: r.sparesData ? JSON.parse(r.sparesData) : []
        }));

        res.json(records);

    } catch (err) {
        console.error('Error fetching breakdown reports:', err);
        res.status(500).json({
            error: 'Failed to fetch breakdown reports'
        });
    }
};

module.exports = {
    saveBreakdownIntimationReport,
    getBreakdownIntimationReports
};
