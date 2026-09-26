const sql = require('../db');

// ============================================================
// GET MACHINE SHOP DETAILS
// ============================================================
const getMachineShopDetails = async (req, res) => {
    const { shopId } = req.params;

    try {
        const parsedShopId = parseInt(shopId);

        if (isNaN(parsedShopId) || parsedShopId < 1 || parsedShopId > 5) {
            return res.status(400).json({
                error: 'Invalid machine shop ID'
            });
        }

        const tableName = `MachineShop${parsedShopId}Details`;

        const result = await sql.query(`
            SELECT
                id,
                lineCode,
                partName,
                partNo,
                machineNo,
                machineType
            FROM ${tableName}
            ORDER BY lineCode, partName
        `);

        res.status(200).json(result.recordset);

    } catch (err) {
        console.error(
            `Error fetching Machine Shop ${shopId} details:`,
            err
        );

        res.status(500).json({
            error: `Failed to fetch Machine Shop ${shopId} details`
        });
    }
};


// ============================================================
// SAVE DAILY PRODUCTION & IDLE TIME REPORT
// ============================================================
const saveDailyProductionIdleTime = async (req, res) => {

    const {
        machineShop,
        date,
        lineColumns,
        signatures
    } = req.body;

    let transaction;

    try {

        if (!machineShop) {
            return res.status(400).json({
                error: 'Machine shop is required'
            });
        }

        if (!date) {
            return res.status(400).json({
                error: 'Report date is required'
            });
        }

        if (!Array.isArray(lineColumns) || lineColumns.length === 0) {
            return res.status(400).json({
                error: 'At least one line column is required'
            });
        }

        transaction = new sql.Transaction();

        await transaction.begin();


        // Insert one row for every line column
        for (const col of lineColumns) {

            const reqInput = transaction.request();


            // ==================================================
            // HEADER
            // ==================================================

            reqInput.input(
                'MachineShop',
                sql.Int,
                parseInt(machineShop)
            );

            reqInput.input(
                'ReportDate',
                sql.Date,
                date
            );


            // ==================================================
            // LINE DETAILS
            // ==================================================

            reqInput.input(
                'LineCode',
                sql.NVarChar(50),
                col.lineCode || ''
            );

            reqInput.input(
                'PartName',
                sql.NVarChar(100),
                col.partName || ''
            );

            reqInput.input(
                'BrakeType',
                sql.NVarChar(50),
                col.brakeType || ''
            );


            // ==================================================
            // CAPACITY
            // ==================================================

            reqInput.input(
                'Capacity_Shift1',
                sql.Int,
                col.capacity?.shift1 !== ''
                    ? parseInt(col.capacity?.shift1)
                    : null
            );

            reqInput.input(
                'Capacity_Shift2',
                sql.Int,
                col.capacity?.shift2 !== ''
                    ? parseInt(col.capacity?.shift2)
                    : null
            );

            reqInput.input(
                'Capacity_Shift3',
                sql.Int,
                col.capacity?.shift3 !== ''
                    ? parseInt(col.capacity?.shift3)
                    : null
            );


            // ==================================================
            // ACTUAL PRODUCTION - LH
            // ==================================================

            reqInput.input(
                'ActualProd_LH_Shift1',
                sql.Int,
                col.actualProd?.lh?.shift1 !== ''
                    ? parseInt(col.actualProd?.lh?.shift1)
                    : null
            );

            reqInput.input(
                'ActualProd_LH_Shift2',
                sql.Int,
                col.actualProd?.lh?.shift2 !== ''
                    ? parseInt(col.actualProd?.lh?.shift2)
                    : null
            );

            reqInput.input(
                'ActualProd_LH_Shift3',
                sql.Int,
                col.actualProd?.lh?.shift3 !== ''
                    ? parseInt(col.actualProd?.lh?.shift3)
                    : null
            );


            // ==================================================
            // ACTUAL PRODUCTION - RH
            // ==================================================

            reqInput.input(
                'ActualProd_RH_Shift1',
                sql.Int,
                col.actualProd?.rh?.shift1 !== ''
                    ? parseInt(col.actualProd?.rh?.shift1)
                    : null
            );

            reqInput.input(
                'ActualProd_RH_Shift2',
                sql.Int,
                col.actualProd?.rh?.shift2 !== ''
                    ? parseInt(col.actualProd?.rh?.shift2)
                    : null
            );

            reqInput.input(
                'ActualProd_RH_Shift3',
                sql.Int,
                col.actualProd?.rh?.shift3 !== ''
                    ? parseInt(col.actualProd?.rh?.shift3)
                    : null
            );


            // ==================================================
            // MANPOWER
            // ==================================================

            reqInput.input(
                'Manpower_Shift1',
                sql.Int,
                col.manpower?.shift1 !== ''
                    ? parseInt(col.manpower?.shift1)
                    : null
            );

            reqInput.input(
                'Manpower_Shift2',
                sql.Int,
                col.manpower?.shift2 !== ''
                    ? parseInt(col.manpower?.shift2)
                    : null
            );

            reqInput.input(
                'Manpower_Shift3',
                sql.Int,
                col.manpower?.shift3 !== ''
                    ? parseInt(col.manpower?.shift3)
                    : null
            );


            // ==================================================
            // LOSSES 1 - 13
            // ==================================================

            for (let i = 1; i <= 13; i++) {

                const loss = col.losses?.[`loss_${i}`];

                reqInput.input(
                    `Loss${i}_Shift1`,
                    sql.Float,
                    loss?.shift1 !== ''
                        ? parseFloat(loss?.shift1)
                        : null
                );

                reqInput.input(
                    `Loss${i}_Shift2`,
                    sql.Float,
                    loss?.shift2 !== ''
                        ? parseFloat(loss?.shift2)
                        : null
                );

                reqInput.input(
                    `Loss${i}_Shift3`,
                    sql.Float,
                    loss?.shift3 !== ''
                        ? parseFloat(loss?.shift3)
                        : null
                );
            }


            // ==================================================
            // SECTION INCHARGE SIGNATURES
            // ==================================================

            reqInput.input(
                'SecInchargeSign_Shift1',
                sql.NVarChar(100),
                signatures?.sectionInchargeSign?.shift1 || ''
            );

            reqInput.input(
                'SecInchargeSign_Shift2',
                sql.NVarChar(100),
                signatures?.sectionInchargeSign?.shift2 || ''
            );

            reqInput.input(
                'SecInchargeSign_Shift3',
                sql.NVarChar(100),
                signatures?.sectionInchargeSign?.shift3 || ''
            );


            // ==================================================
            // SHIFT OFFICER SIGNATURES
            // ==================================================

            reqInput.input(
                'ShiftOfficerSign_Shift1',
                sql.NVarChar(100),
                signatures?.shiftOfficerSign?.shift1 || ''
            );

            reqInput.input(
                'ShiftOfficerSign_Shift2',
                sql.NVarChar(100),
                signatures?.shiftOfficerSign?.shift2 || ''
            );

            reqInput.input(
                'ShiftOfficerSign_Shift3',
                sql.NVarChar(100),
                signatures?.shiftOfficerSign?.shift3 || ''
            );


            // ==================================================
            // TEAM LEADER SIGNATURE
            // ==================================================

            reqInput.input(
                'TeamLeaderSign',
                sql.NVarChar(100),
                signatures?.teamLeaderSign || ''
            );


            // ==================================================
            // INSERT
            // ==================================================

            await reqInput.query(`
                INSERT INTO DailyProductionIdleTimeReport
                (
                    MachineShop,
                    ReportDate,

                    LineCode,
                    PartName,
                    BrakeType,

                    Capacity_Shift1,
                    Capacity_Shift2,
                    Capacity_Shift3,

                    ActualProd_LH_Shift1,
                    ActualProd_LH_Shift2,
                    ActualProd_LH_Shift3,

                    ActualProd_RH_Shift1,
                    ActualProd_RH_Shift2,
                    ActualProd_RH_Shift3,

                    Manpower_Shift1,
                    Manpower_Shift2,
                    Manpower_Shift3,

                    Loss1_Shift1,
                    Loss1_Shift2,
                    Loss1_Shift3,

                    Loss2_Shift1,
                    Loss2_Shift2,
                    Loss2_Shift3,

                    Loss3_Shift1,
                    Loss3_Shift2,
                    Loss3_Shift3,

                    Loss4_Shift1,
                    Loss4_Shift2,
                    Loss4_Shift3,

                    Loss5_Shift1,
                    Loss5_Shift2,
                    Loss5_Shift3,

                    Loss6_Shift1,
                    Loss6_Shift2,
                    Loss6_Shift3,

                    Loss7_Shift1,
                    Loss7_Shift2,
                    Loss7_Shift3,

                    Loss8_Shift1,
                    Loss8_Shift2,
                    Loss8_Shift3,

                    Loss9_Shift1,
                    Loss9_Shift2,
                    Loss9_Shift3,

                    Loss10_Shift1,
                    Loss10_Shift2,
                    Loss10_Shift3,

                    Loss11_Shift1,
                    Loss11_Shift2,
                    Loss11_Shift3,

                    Loss12_Shift1,
                    Loss12_Shift2,
                    Loss12_Shift3,

                    Loss13_Shift1,
                    Loss13_Shift2,
                    Loss13_Shift3,

                    SecInchargeSign_Shift1,
                    SecInchargeSign_Shift2,
                    SecInchargeSign_Shift3,

                    ShiftOfficerSign_Shift1,
                    ShiftOfficerSign_Shift2,
                    ShiftOfficerSign_Shift3,

                    TeamLeaderSign
                )

                VALUES
                (
                    @MachineShop,
                    @ReportDate,

                    @LineCode,
                    @PartName,
                    @BrakeType,

                    @Capacity_Shift1,
                    @Capacity_Shift2,
                    @Capacity_Shift3,

                    @ActualProd_LH_Shift1,
                    @ActualProd_LH_Shift2,
                    @ActualProd_LH_Shift3,

                    @ActualProd_RH_Shift1,
                    @ActualProd_RH_Shift2,
                    @ActualProd_RH_Shift3,

                    @Manpower_Shift1,
                    @Manpower_Shift2,
                    @Manpower_Shift3,

                    @Loss1_Shift1,
                    @Loss1_Shift2,
                    @Loss1_Shift3,

                    @Loss2_Shift1,
                    @Loss2_Shift2,
                    @Loss2_Shift3,

                    @Loss3_Shift1,
                    @Loss3_Shift2,
                    @Loss3_Shift3,

                    @Loss4_Shift1,
                    @Loss4_Shift2,
                    @Loss4_Shift3,

                    @Loss5_Shift1,
                    @Loss5_Shift2,
                    @Loss5_Shift3,

                    @Loss6_Shift1,
                    @Loss6_Shift2,
                    @Loss6_Shift3,

                    @Loss7_Shift1,
                    @Loss7_Shift2,
                    @Loss7_Shift3,

                    @Loss8_Shift1,
                    @Loss8_Shift2,
                    @Loss8_Shift3,

                    @Loss9_Shift1,
                    @Loss9_Shift2,
                    @Loss9_Shift3,

                    @Loss10_Shift1,
                    @Loss10_Shift2,
                    @Loss10_Shift3,

                    @Loss11_Shift1,
                    @Loss11_Shift2,
                    @Loss11_Shift3,

                    @Loss12_Shift1,
                    @Loss12_Shift2,
                    @Loss12_Shift3,

                    @Loss13_Shift1,
                    @Loss13_Shift2,
                    @Loss13_Shift3,

                    @SecInchargeSign_Shift1,
                    @SecInchargeSign_Shift2,
                    @SecInchargeSign_Shift3,

                    @ShiftOfficerSign_Shift1,
                    @ShiftOfficerSign_Shift2,
                    @ShiftOfficerSign_Shift3,

                    @TeamLeaderSign
                )
            `);
        }

        await transaction.commit();

        res.status(201).json({
            message:
                'Daily Production & Idle Time Report saved successfully'
        });

    } catch (err) {

        console.error(
            'Error saving Idle Time Report:',
            err
        );

        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(
                    'Transaction rollback error:',
                    rollbackError
                );
            }
        }

        res.status(500).json({
            error:
                'Failed to save Idle Time Report'
        });
    }
};


// ============================================================
// GET PART QUANTITIES DYNAMICALLY
// ============================================================
const getPartQuantities = async (req, res) => {

    const { shopId } = req.params;

    try {

        const parsedShopId = parseInt(shopId);

        if (
            isNaN(parsedShopId) ||
            parsedShopId < 1 ||
            parsedShopId > 5
        ) {
            return res.status(400).json({
                error: 'Invalid machine shop ID'
            });
        }

        const tableName =
            `MachineShop${parsedShopId}PartQty`;

        const result = await sql.query(`
            SELECT
                partName,
                shift1Quantity,
                shift2Quantity,
                shift3Quantity
            FROM ${tableName}
        `);

        res.status(200).json(
            result.recordset
        );

    } catch (err) {

        console.error(
            `Error fetching part quantities for shop ${shopId}:`,
            err
        );

        res.status(500).json({
            error:
                'Failed to fetch part quantities'
        });
    }
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    getMachineShopDetails,
    saveDailyProductionIdleTime,
    getPartQuantities
};