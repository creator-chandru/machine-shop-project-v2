const sql = require('../db');


// ============================================================
// GET MACHINE SHOP DETAILS
// ============================================================

const getJigFixtureMachineDetails = async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT
                id,
                lineCode,
                partName,
                partNo,
                machineNo,
                machineType
            FROM MachineShop3Details
            ORDER BY
                lineCode,
                partName,
                partNo,
                machineNo
        `);

        res.status(200).json(result.recordset);

    } catch (err) {

        console.error(
            'Error fetching Jig & Fixture machine details:',
            err
        );

        res.status(500).json({
            error: 'Failed to fetch machine details'
        });
    }
};


// ============================================================
// SAVE JIG & FIXTURE ISSUE INTIMATION
// ============================================================

const saveJigFixtureIssue = async (req, res) => {

    const {
        header,
        stockCards,
        checklist,
        signatures
    } = req.body;

    let transaction;

    try {

        transaction = new sql.Transaction();

        await transaction.begin();


        // =====================================================
        // MAIN FORM
        // =====================================================

        const request = transaction.request();

        request.input(
            'machineShop',
            sql.Int,
            header.machineShop
        );

        request.input(
            'lineCode',
            sql.NVarChar(100),
            header.lineCode || null
        );

        request.input(
            'departmentSection',
            sql.NVarChar(200),
            header.departmentSection || null
        );

        request.input(
            'reportDate',
            sql.Date,
            header.reportDate
        );

        request.input(
            'jfWhdReferenceNo',
            sql.NVarChar(100),
            header.jfWhdReferenceNo || null
        );

        request.input(
            'shiftTime',
            sql.NVarChar(100),
            header.shiftTime || null
        );

        request.input(
            'natureOfProblem',
            sql.NVarChar(sql.MAX),
            header.natureOfProblem || null
        );

        request.input(
            'receivedBy',
            sql.NVarChar(200),
            header.receivedBy || null
        );

        request.input(
            'actionIntimatedBy',
            sql.NVarChar(200),
            header.actionIntimatedBy || null
        );

        request.input(
            'actionTakenDetails',
            sql.NVarChar(sql.MAX),
            header.actionTakenDetails || null
        );

        request.input(
            'toolingObservation',
            sql.NVarChar(sql.MAX),
            header.toolingObservation || null
        );

        request.input(
            'actionTakenBy',
            sql.NVarChar(200),
            header.actionTakenBy || null
        );

        request.input(
            'workStartedAt',
            sql.DateTime,
            header.workStartedAt || null
        );

        request.input(
            'workCompletedAt',
            sql.DateTime,
            header.workCompletedAt || null
        );

        request.input(
            'timeLost',
            sql.NVarChar(100),
            header.timeLost || null
        );

        request.input(
            'correctiveActionFeedback',
            sql.NVarChar(sql.MAX),
            header.correctiveActionFeedback || null
        );

        request.input(
            'feedbackGivenBy',
            sql.NVarChar(200),
            header.feedbackGivenBy || null
        );

        request.input(
            'reasonForUndueDelay',
            sql.NVarChar(sql.MAX),
            header.reasonForUndueDelay || null
        );

        request.input(
            'workAndSparesDetails',
            sql.NVarChar(sql.MAX),
            header.workAndSparesDetails || null
        );

        request.input(
            'mexMydouJf',
            sql.NVarChar(200),
            header.mexMydouJf || null
        );

        request.input(
            'preventiveAction',
            sql.NVarChar(sql.MAX),
            header.preventiveAction || null
        );

     

        request.input(
            'shiftInchargeSignature',
            sql.NVarChar(100),
            signatures?.["Shift Incharge"] || ''
        );


        const result = await request.query(`
            INSERT INTO JigFixtureIssueIntimation
            (
                machineShop,
                lineCode,
                departmentSection,
                reportDate,
                jfWhdReferenceNo,
                shiftTime,
                natureOfProblem,
                receivedBy,
                actionIntimatedBy,
                actionTakenDetails,
                toolingObservation,
                actionTakenBy,
                workStartedAt,
                workCompletedAt,
                timeLost,
                correctiveActionFeedback,
                feedbackGivenBy,
                reasonForUndueDelay,
                workAndSparesDetails,
                mexMydouJf,
                preventiveAction,
                
                shiftInchargeSignature
            )
            VALUES
            (
                @machineShop,
                @lineCode,
                @departmentSection,
                @reportDate,
                @jfWhdReferenceNo,
                @shiftTime,
                @natureOfProblem,
                @receivedBy,
                @actionIntimatedBy,
                @actionTakenDetails,
                @toolingObservation,
                @actionTakenBy,
                @workStartedAt,
                @workCompletedAt,
                @timeLost,
                @correctiveActionFeedback,
                @feedbackGivenBy,
                @reasonForUndueDelay,
                @workAndSparesDetails,
                @mexMydouJf,
                @preventiveAction,
             
                @shiftInchargeSignature
            );

            SELECT SCOPE_IDENTITY() AS issueId;
        `);


        const issueId = result.recordset[0].issueId;


        // =====================================================
        // STOCK CARDS
        // =====================================================

        if (Array.isArray(stockCards)) {

            for (const card of stockCards) {

                await transaction
                    .request()
                    .input(
                        'issueId',
                        sql.Int,
                        issueId
                    )
                    .input(
                        'tableNo',
                        sql.Int,
                        card.tableNo
                    )
                    .input(
                        'slNo',
                        sql.Int,
                        card.slNo
                    )
                    .input(
                        'stockCardNo',
                        sql.NVarChar(100),
                        card.stockCardNo || null
                    )
                    .input(
                        'qty',
                        sql.NVarChar(50),
                        card.qty || null
                    )
                    .input(
                        'sign',
                        sql.NVarChar(100),
                        card.sign || null
                    )
                    .query(`
                        INSERT INTO JigFixtureStockCard
                        (
                            issueId,
                            tableNo,
                            slNo,
                            stockCardNo,
                            qty,
                            sign
                        )
                        VALUES
                        (
                            @issueId,
                            @tableNo,
                            @slNo,
                            @stockCardNo,
                            @qty,
                            @sign
                        )
                    `);
            }
        }


        // =====================================================
        // CHECKLIST
        // =====================================================

        if (Array.isArray(checklist)) {

            for (const item of checklist) {

                await transaction
                    .request()
                    .input(
                        'issueId',
                        sql.Int,
                        issueId
                    )
                    .input(
                        'slNo',
                        sql.Int,
                        item.slNo
                    )
                    .input(
                        'checklistItem',
                        sql.NVarChar(255),
                        item.checklistItem
                    )
                    .input(
                        'status',
                        sql.NVarChar(50),
                        item.status || null
                    )
                    .query(`
                        INSERT INTO JigFixtureChecklist
                        (
                            issueId,
                            slNo,
                            checklistItem,
                            status
                        )
                        VALUES
                        (
                            @issueId,
                            @slNo,
                            @checklistItem,
                            @status
                        )
                    `);
            }
        }


        await transaction.commit();


        res.status(201).json({
            message: 'Jig & Fixture Issue Intimation saved successfully',
            issueId
        });


    } catch (err) {

        console.error(
            'Error saving Jig & Fixture Issue Intimation:',
            err
        );


        if (transaction) {

            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(
                    'Rollback error:',
                    rollbackError
                );
            }
        }


        res.status(500).json({
            error: 'Failed to save Jig & Fixture Issue Intimation'
        });
    }
};


module.exports = {
    getJigFixtureMachineDetails,
    saveJigFixtureIssue
};