const sql = require("../db");


// ============================================================
// GET MACHINE SHOP DETAILS
// ============================================================
const getFourMChangeMonitoringDetails = async (req, res) => {

    const { shopId } = req.params;

    try {

        // Validate machine shop
        if (!shopId || ![1, 2, 3, 4, 5].includes(Number(shopId))) {
            return res.status(400).json({
                message: "Invalid machine shop"
            });
        }

        const tableName = `MachineShop${shopId}Details`;

        const result = await sql.query(`
            SELECT
                id,
                lineCode,
                partName,
                partNo,
                machineNo,
                machineType
            FROM ${tableName}
            ORDER BY lineCode, partName, partNo, machineNo
        `);

        res.status(200).json(result.recordset);

    } catch (error) {

        console.error(
            "Error fetching Four M Change Monitoring machine shop details:",
            error
        );

        res.status(500).json({
            message: "Failed to fetch machine shop details",
            error: error.message
        });
    }
};


// ============================================================
// GET DETAILS FOR SELECTED LINE CODE
// ============================================================
const getFourMChangeMonitoringLineDetails = async (req, res) => {

    const { shopId } = req.params;
    const { lineCode } = req.query;

    try {

        // Validate machine shop
        if (!shopId || ![1, 2, 3, 4, 5].includes(Number(shopId))) {
            return res.status(400).json({
                message: "Invalid machine shop"
            });
        }

        // Validate line code
        if (!lineCode) {
            return res.status(400).json({
                message: "lineCode is required"
            });
        }

        const tableName = `MachineShop${shopId}Details`;

        const request = new sql.Request();

        request.input(
            "lineCode",
            sql.NVarChar(100),
            lineCode
        );

        const result = await request.query(`
            SELECT
                id,
                lineCode,
                partName,
                partNo,
                machineNo,
                machineType
            FROM ${tableName}
            WHERE lineCode = @lineCode
            ORDER BY partName, partNo, machineNo
        `);

        res.status(200).json(result.recordset);

    } catch (error) {

        console.error(
            "Error fetching Four M Change Monitoring line details:",
            error
        );

        res.status(500).json({
            message: "Failed to fetch line details",
            error: error.message
        });
    }
};


// ============================================================
// SAVE FOUR M CHANGE MONITORING
// ============================================================
const saveFourMChangeMonitoring = async (req, res) => {

    const {
        headerInfo,
        rows,
        hodSign
    } = req.body;


    // --------------------------------------------------------
    // Validate header
    // --------------------------------------------------------

    if (!headerInfo) {
        return res.status(400).json({
            message: "Header information is required"
        });
    }


    const {
        machineShop,
        lineCode,
        partName
    } = headerInfo;


    if (!machineShop) {
        return res.status(400).json({
            message: "Machine shop is required"
        });
    }


    if (!lineCode) {
        return res.status(400).json({
            message: "Line code is required"
        });
    }


    if (!partName) {
        return res.status(400).json({
            message: "Part name is required"
        });
    }


    // --------------------------------------------------------
    // Validate machine shop
    // --------------------------------------------------------

    if (![1, 2, 3, 4, 5].includes(Number(machineShop))) {
        return res.status(400).json({
            message: "Invalid machine shop"
        });
    }


    // --------------------------------------------------------
    // Validate rows
    // --------------------------------------------------------

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({
            message: "At least one row is required"
        });
    }


    const transaction = new sql.Transaction();


    try {

        await transaction.begin();


        // ----------------------------------------------------
        // Insert every row
        // ----------------------------------------------------

        for (let index = 0; index < rows.length; index++) {

            const row = rows[index];

            const request = new sql.Request(transaction);


            // ------------------------------------------------
            // Header fields
            // ------------------------------------------------

            request.input(
                "machineShop",
                sql.Int,
                Number(machineShop)
            );

            request.input(
                "lineCode",
                sql.NVarChar(100),
                lineCode
            );

            request.input(
                "partName",
                sql.NVarChar(255),
                partName
            );


            // ------------------------------------------------
            // Row fields
            // ------------------------------------------------

            request.input(
                "slNo",
                sql.Int,
                row.slNo
                    ? Number(row.slNo)
                    : index + 1
            );


            const dateShift =
                row.dateShift ||
                `${row.date || ""} ${row.shift || ""}`.trim();


            request.input(
                "dateShift",
                sql.NVarChar(100),
                dateShift || null
            );


            request.input(
                "mcNo",
                sql.NVarChar(100),
                row.mcNo || null
            );


            request.input(
                "typeOf4M",
                sql.NVarChar(255),
                row.typeOf4M || null
            );


            request.input(
                "description",
                sql.NVarChar(sql.MAX),
                row.description || null
            );


            request.input(
                "firstPart",
                sql.NVarChar(100),
                row.firstPart || null
            );


            request.input(
                "lastPart",
                sql.NVarChar(100),
                row.lastPart || null
            );


            request.input(
                "inspectionFrequency",
                sql.NVarChar(255),
                row.inspectionFrequency || null
            );


            request.input(
                "retroChecking",
                sql.NVarChar(255),
                row.retroChecking || null
            );


            request.input(
                "quarantine",
                sql.NVarChar(255),
                row.quarantine || null
            );


            request.input(
                "partIdentification",
                sql.NVarChar(255),
                row.partIdentification || null
            );


            request.input(
                "internalCommunication",
                sql.NVarChar(255),
                row.internalCommunication || null
            );


            request.input(
                "inchargeSign",
                sql.NVarChar(255),
                row.inchargeSign || null
            );


            request.input(
                "hodSign",
                sql.NVarChar(255),
                hodSign || null
            );


            // ------------------------------------------------
            // INSERT
            // ------------------------------------------------

            await request.query(`
                INSERT INTO FourMChangeMonitoring (
                    machineShop,
                    lineCode,
                    partName,
                    slNo,
                    dateShift,
                    mcNo,
                    typeOf4M,
                    description,
                    firstPart,
                    lastPart,
                    inspectionFrequency,
                    retroChecking,
                    quarantine,
                    partIdentification,
                    internalCommunication,
                    inchargeSign,
                    hodSign
                )
                VALUES (
                    @machineShop,
                    @lineCode,
                    @partName,
                    @slNo,
                    @dateShift,
                    @mcNo,
                    @typeOf4M,
                    @description,
                    @firstPart,
                    @lastPart,
                    @inspectionFrequency,
                    @retroChecking,
                    @quarantine,
                    @partIdentification,
                    @internalCommunication,
                    @inchargeSign,
                    @hodSign
                )
            `);
        }


        // ----------------------------------------------------
        // COMMIT
        // ----------------------------------------------------

        await transaction.commit();


        return res.status(201).json({
            message: "4M Change Monitoring data saved successfully"
        });


    } catch (error) {

        // ----------------------------------------------------
        // ROLLBACK
        // ----------------------------------------------------

        try {
            await transaction.rollback();
        } catch (rollbackError) {
            console.error(
                "Rollback error:",
                rollbackError
            );
        }


        console.error(
            "Error saving Four M Change Monitoring:",
            error
        );


        return res.status(500).json({
            message: "Failed to save 4M Change Monitoring data",
            error: error.message
        });
    }
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    getFourMChangeMonitoringDetails,
    getFourMChangeMonitoringLineDetails,
    saveFourMChangeMonitoring
};