const sql = require('../db');
const PDFDocument = require('pdfkit');

// Ensure table exists
const ensureTableExists = async () => {
    try {
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DailyProductionIdleTimeReport')
            BEGIN
                CREATE TABLE DailyProductionIdleTimeReport (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    machineShop INT NOT NULL,
                    reportDate DATE NOT NULL,
                    lineCode NVARCHAR(50) NOT NULL,
                    partName NVARCHAR(100),
                    brakeType NVARCHAR(50),
                    capacity_Shift1 INT,
                    capacity_Shift2 INT,
                    capacity_Shift3 INT,
                    actualProd_LH_Shift1 INT,
                    actualProd_LH_Shift2 INT,
                    actualProd_LH_Shift3 INT,
                    actualProd_RH_Shift1 INT,
                    actualProd_RH_Shift2 INT,
                    actualProd_RH_Shift3 INT,
                    manpower_Shift1 INT,
                    manpower_Shift2 INT,
                    manpower_Shift3 INT,
                    loss1_Shift1 FLOAT, loss1_Shift2 FLOAT, loss1_Shift3 FLOAT,
                    loss2_Shift1 FLOAT, loss2_Shift2 FLOAT, loss2_Shift3 FLOAT,
                    loss3_Shift1 FLOAT, loss3_Shift2 FLOAT, loss3_Shift3 FLOAT,
                    loss4_Shift1 FLOAT, loss4_Shift2 FLOAT, loss4_Shift3 FLOAT,
                    loss5_Shift1 FLOAT, loss5_Shift2 FLOAT, loss5_Shift3 FLOAT,
                    loss6_Shift1 FLOAT, loss6_Shift2 FLOAT, loss6_Shift3 FLOAT,
                    loss7_Shift1 FLOAT, loss7_Shift2 FLOAT, loss7_Shift3 FLOAT,
                    loss8_Shift1 FLOAT, loss8_Shift2 FLOAT, loss8_Shift3 FLOAT,
                    loss9_Shift1 FLOAT, loss9_Shift2 FLOAT, loss9_Shift3 FLOAT,
                    loss10_Shift1 FLOAT, loss10_Shift2 FLOAT, loss10_Shift3 FLOAT,
                    loss11_Shift1 FLOAT, loss11_Shift2 FLOAT, loss11_Shift3 FLOAT,
                    loss12_Shift1 FLOAT, loss12_Shift2 FLOAT, loss12_Shift3 FLOAT,
                    loss13_Shift1 FLOAT, loss13_Shift2 FLOAT, loss13_Shift3 FLOAT,
                    secInchargeSign_Shift1 NVARCHAR(100),
                    secInchargeSign_Shift2 NVARCHAR(100),
                    secInchargeSign_Shift3 NVARCHAR(100),
                    shiftOfficerSign_Shift1 NVARCHAR(100),
                    shiftOfficerSign_Shift2 NVARCHAR(100),
                    shiftOfficerSign_Shift3 NVARCHAR(100),
                    createdAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT CK_DailyProductionIdleTimeReport_MachineShop
                        CHECK (machineShop IN (1, 2, 3, 4, 5))
                );
            END
        `);
    } catch (e) {
        console.error("Error ensuring DailyProductionIdleTimeReport table exists:", e);
    }
};
ensureTableExists();

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

        const tableName = `MachineShop${parsedShopId}PartQty`;

        const result = await sql.query(`
            SELECT
                partName,
                shift1Quantity,
                shift2Quantity,
                shift3Quantity
            FROM ${tableName}
        `);

        res.status(200).json(result.recordset);

    } catch (err) {
        console.error(
            `Error fetching part quantities for shop ${shopId}:`,
            err
        );

        res.status(500).json({
            error: 'Failed to fetch part quantities'
        });
    }
};

// ============================================================
// GET USERS FOR SELECTION (Section Incharge, Product Engineers)
// ============================================================
const getPEUsers = async (req, res) => {
    try {
        const usersRes = await sql.query`
            SELECT username AS name, username, employeeId, role 
            FROM dbo.MachineShopUsers 
            ORDER BY username ASC
        `;
        const allUsers = usersRes.recordset || [];
        const peList = allUsers.filter(u => String(u.role || '').toLowerCase().includes('pe') || String(u.role || '').toLowerCase().includes('productengineer'));
        const inchargeList = allUsers.filter(u => ['shiftincharge', 'sectionincharge', 'incharge', 'operator', 'supervisor'].includes(String(u.role || '').toLowerCase()));

        return res.status(200).json({ 
            allUsers,
            peList: peList.length > 0 ? peList : allUsers,
            inchargeList: inchargeList.length > 0 ? inchargeList : allUsers 
        });
    } catch (err) {
        console.error("Error fetching users list:", err);
        return res.status(500).json({ error: 'Failed to fetch user list' });
    }
};

// ============================================================
// GET SAVED REPORT FOR SHOP AND DATE
// ============================================================
const getDailyProductionIdleTime = async (req, res) => {
    try {
        const { shopId, date } = req.query;
        if (!shopId || !date) {
            return res.status(400).json({ error: 'shopId and date are required' });
        }

        const request = new sql.Request();
        request.input('machineShop', sql.Int, parseInt(shopId));
        request.input('reportDate', sql.Date, date);

        const result = await request.query(`
            SELECT * FROM DailyProductionIdleTimeReport
            WHERE machineShop = @machineShop AND reportDate = @reportDate
            ORDER BY id ASC
        `);

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(200).json({ exists: false, lineColumns: [], signatures: null });
        }

        const rows = result.recordset;
        const lineColumns = rows.map(r => {
            const losses = {};
            for (let i = 1; i <= 13; i++) {
                losses[`loss_${i}`] = {
                    shift1: r[`loss${i}_Shift1`] != null ? String(r[`loss${i}_Shift1`]) : "",
                    shift2: r[`loss${i}_Shift2`] != null ? String(r[`loss${i}_Shift2`]) : "",
                    shift3: r[`loss${i}_Shift3`] != null ? String(r[`loss${i}_Shift3`]) : "",
                };
            }

            return {
                lineCode: r.lineCode || "",
                partName: r.partName || "",
                brakeType: r.brakeType || "",
                capacity: {
                    shift1: r.capacity_Shift1 != null ? String(r.capacity_Shift1) : "",
                    shift2: r.capacity_Shift2 != null ? String(r.capacity_Shift2) : "",
                    shift3: r.capacity_Shift3 != null ? String(r.capacity_Shift3) : "",
                },
                actualProd: {
                    lh: {
                        shift1: r.actualProd_LH_Shift1 != null ? String(r.actualProd_LH_Shift1) : "",
                        shift2: r.actualProd_LH_Shift2 != null ? String(r.actualProd_LH_Shift2) : "",
                        shift3: r.actualProd_LH_Shift3 != null ? String(r.actualProd_LH_Shift3) : "",
                    },
                    rh: {
                        shift1: r.actualProd_RH_Shift1 != null ? String(r.actualProd_RH_Shift1) : "",
                        shift2: r.actualProd_RH_Shift2 != null ? String(r.actualProd_RH_Shift2) : "",
                        shift3: r.actualProd_RH_Shift3 != null ? String(r.actualProd_RH_Shift3) : "",
                    }
                },
                manpower: {
                    shift1: r.manpower_Shift1 != null ? String(r.manpower_Shift1) : "",
                    shift2: r.manpower_Shift2 != null ? String(r.manpower_Shift2) : "",
                    shift3: r.manpower_Shift3 != null ? String(r.manpower_Shift3) : "",
                },
                losses
            };
        });

        const firstRow = rows[0];
        const signatures = {
            sectionInchargeSign: {
                shift1: firstRow.secInchargeSign_Shift1 || "",
                shift2: firstRow.secInchargeSign_Shift2 || "",
                shift3: firstRow.secInchargeSign_Shift3 || "",
            },
            shiftOfficerSign: {
                shift1: firstRow.shiftOfficerSign_Shift1 || "",
                shift2: firstRow.shiftOfficerSign_Shift2 || "",
                shift3: firstRow.shiftOfficerSign_Shift3 || "",
            }
        };

        return res.status(200).json({ exists: true, lineColumns, signatures });
    } catch (err) {
        console.error("Error fetching daily production idle time report:", err);
        return res.status(500).json({ error: 'Failed to fetch report data' });
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

        // Format Section Incharge / PE assignment to "Pending [NAME]" if signed and not already Approved
        const formatPESign = (sign) => {
            if (!sign) return '';
            const s = String(sign).trim();
            if (s.startsWith('Pending [') || s.startsWith('Approved (')) {
                return s;
            }
            return `Pending [${s}]`;
        };

        const secIncharge1 = formatPESign(signatures?.sectionInchargeSign?.shift1);
        const secIncharge2 = formatPESign(signatures?.sectionInchargeSign?.shift2);
        const secIncharge3 = formatPESign(signatures?.sectionInchargeSign?.shift3);

        const shiftOfficer1 = signatures?.shiftOfficerSign?.shift1 || '';
        const shiftOfficer2 = signatures?.shiftOfficerSign?.shift2 || '';
        const shiftOfficer3 = signatures?.shiftOfficerSign?.shift3 || '';

        transaction = new sql.Transaction();
        await transaction.begin();

        // Delete old rows for this shop and date to allow clean upsert
        const delReq = new sql.Request(transaction);
        delReq.input('machineShop', sql.Int, parseInt(machineShop));
        delReq.input('reportDate', sql.Date, date);
        await delReq.query(`
            DELETE FROM DailyProductionIdleTimeReport
            WHERE machineShop = @machineShop AND reportDate = @reportDate
        `);

        // Insert one row for every line column
        for (const col of lineColumns) {
            const reqInput = new sql.Request(transaction);

            reqInput.input('MachineShop', sql.Int, parseInt(machineShop));
            reqInput.input('ReportDate', sql.Date, date);

            reqInput.input('LineCode', sql.NVarChar(50), col.lineCode || '');
            reqInput.input('PartName', sql.NVarChar(100), col.partName || '');
            reqInput.input('BrakeType', sql.NVarChar(50), col.brakeType || '');

            reqInput.input('Capacity_Shift1', sql.Int, col.capacity?.shift1 !== '' && col.capacity?.shift1 != null ? parseInt(col.capacity?.shift1) : null);
            reqInput.input('Capacity_Shift2', sql.Int, col.capacity?.shift2 !== '' && col.capacity?.shift2 != null ? parseInt(col.capacity?.shift2) : null);
            reqInput.input('Capacity_Shift3', sql.Int, col.capacity?.shift3 !== '' && col.capacity?.shift3 != null ? parseInt(col.capacity?.shift3) : null);

            reqInput.input('ActualProd_LH_Shift1', sql.Int, col.actualProd?.lh?.shift1 !== '' && col.actualProd?.lh?.shift1 != null ? parseInt(col.actualProd?.lh?.shift1) : null);
            reqInput.input('ActualProd_LH_Shift2', sql.Int, col.actualProd?.lh?.shift2 !== '' && col.actualProd?.lh?.shift2 != null ? parseInt(col.actualProd?.lh?.shift2) : null);
            reqInput.input('ActualProd_LH_Shift3', sql.Int, col.actualProd?.lh?.shift3 !== '' && col.actualProd?.lh?.shift3 != null ? parseInt(col.actualProd?.lh?.shift3) : null);

            reqInput.input('ActualProd_RH_Shift1', sql.Int, col.actualProd?.rh?.shift1 !== '' && col.actualProd?.rh?.shift1 != null ? parseInt(col.actualProd?.rh?.shift1) : null);
            reqInput.input('ActualProd_RH_Shift2', sql.Int, col.actualProd?.rh?.shift2 !== '' && col.actualProd?.rh?.shift2 != null ? parseInt(col.actualProd?.rh?.shift2) : null);
            reqInput.input('ActualProd_RH_Shift3', sql.Int, col.actualProd?.rh?.shift3 !== '' && col.actualProd?.rh?.shift3 != null ? parseInt(col.actualProd?.rh?.shift3) : null);

            reqInput.input('Manpower_Shift1', sql.Int, col.manpower?.shift1 !== '' && col.manpower?.shift1 != null ? parseInt(col.manpower?.shift1) : null);
            reqInput.input('Manpower_Shift2', sql.Int, col.manpower?.shift2 !== '' && col.manpower?.shift2 != null ? parseInt(col.manpower?.shift2) : null);
            reqInput.input('Manpower_Shift3', sql.Int, col.manpower?.shift3 !== '' && col.manpower?.shift3 != null ? parseInt(col.manpower?.shift3) : null);

            for (let i = 1; i <= 13; i++) {
                const loss = col.losses?.[`loss_${i}`];
                reqInput.input(`Loss${i}_Shift1`, sql.Float, loss?.shift1 !== '' && loss?.shift1 != null ? parseFloat(loss?.shift1) : null);
                reqInput.input(`Loss${i}_Shift2`, sql.Float, loss?.shift2 !== '' && loss?.shift2 != null ? parseFloat(loss?.shift2) : null);
                reqInput.input(`Loss${i}_Shift3`, sql.Float, loss?.shift3 !== '' && loss?.shift3 != null ? parseFloat(loss?.shift3) : null);
            }

            reqInput.input('SecInchargeSign_Shift1', sql.NVarChar(100), secIncharge1);
            reqInput.input('SecInchargeSign_Shift2', sql.NVarChar(100), secIncharge2);
            reqInput.input('SecInchargeSign_Shift3', sql.NVarChar(100), secIncharge3);

            reqInput.input('ShiftOfficerSign_Shift1', sql.NVarChar(100), shiftOfficer1);
            reqInput.input('ShiftOfficerSign_Shift2', sql.NVarChar(100), shiftOfficer2);
            reqInput.input('ShiftOfficerSign_Shift3', sql.NVarChar(100), shiftOfficer3);

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
                    Loss1_Shift1, Loss1_Shift2, Loss1_Shift3,
                    Loss2_Shift1, Loss2_Shift2, Loss2_Shift3,
                    Loss3_Shift1, Loss3_Shift2, Loss3_Shift3,
                    Loss4_Shift1, Loss4_Shift2, Loss4_Shift3,
                    Loss5_Shift1, Loss5_Shift2, Loss5_Shift3,
                    Loss6_Shift1, Loss6_Shift2, Loss6_Shift3,
                    Loss7_Shift1, Loss7_Shift2, Loss7_Shift3,
                    Loss8_Shift1, Loss8_Shift2, Loss8_Shift3,
                    Loss9_Shift1, Loss9_Shift2, Loss9_Shift3,
                    Loss10_Shift1, Loss10_Shift2, Loss10_Shift3,
                    Loss11_Shift1, Loss11_Shift2, Loss11_Shift3,
                    Loss12_Shift1, Loss12_Shift2, Loss12_Shift3,
                    Loss13_Shift1, Loss13_Shift2, Loss13_Shift3,
                    SecInchargeSign_Shift1,
                    SecInchargeSign_Shift2,
                    SecInchargeSign_Shift3,
                    ShiftOfficerSign_Shift1,
                    ShiftOfficerSign_Shift2,
                    ShiftOfficerSign_Shift3
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
                    @Loss1_Shift1, @Loss1_Shift2, @Loss1_Shift3,
                    @Loss2_Shift1, @Loss2_Shift2, @Loss2_Shift3,
                    @Loss3_Shift1, @Loss3_Shift2, @Loss3_Shift3,
                    @Loss4_Shift1, @Loss4_Shift2, @Loss4_Shift3,
                    @Loss5_Shift1, @Loss5_Shift2, @Loss5_Shift3,
                    @Loss6_Shift1, @Loss6_Shift2, @Loss6_Shift3,
                    @Loss7_Shift1, @Loss7_Shift2, @Loss7_Shift3,
                    @Loss8_Shift1, @Loss8_Shift2, @Loss8_Shift3,
                    @Loss9_Shift1, @Loss9_Shift2, @Loss9_Shift3,
                    @Loss10_Shift1, @Loss10_Shift2, @Loss10_Shift3,
                    @Loss11_Shift1, @Loss11_Shift2, @Loss11_Shift3,
                    @Loss12_Shift1, @Loss12_Shift2, @Loss12_Shift3,
                    @Loss13_Shift1, @Loss13_Shift2, @Loss13_Shift3,
                    @SecInchargeSign_Shift1,
                    @SecInchargeSign_Shift2,
                    @SecInchargeSign_Shift3,
                    @ShiftOfficerSign_Shift1,
                    @ShiftOfficerSign_Shift2,
                    @ShiftOfficerSign_Shift3
                )
            `);
        }

        await transaction.commit();

        res.status(201).json({
            message: 'Daily Production & Idle Time Report saved successfully'
        });

    } catch (err) {
        console.error('Error saving Idle Time Report:', err);
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Transaction rollback error:', rollbackError);
            }
        }
        res.status(500).json({
            error: 'Failed to save Idle Time Report'
        });
    }
};

// ============================================================
// GET PENDING FOR PRODUCT ENGINEER (PE)
// ============================================================
const getPendingPEIdleTimeData = async (req, res) => {
    try {
        const { name } = req.params;
        const shopId = parseInt(req.query.shopId, 10);

        const request = new sql.Request();

        let shopFilter = '';
        if (!isNaN(shopId)) {
            request.input('machineShop', sql.Int, shopId);
            shopFilter = ' AND machineShop = @machineShop';
        }

        const result = await request.query(`
            SELECT 
                machineShop,
                lineCode,
                MAX(partName) AS partName,
                FORMAT(reportDate, 'yyyy-MM-dd') AS reportDate,
                MAX(secInchargeSign_Shift1) AS secInchargeSign_Shift1,
                MAX(secInchargeSign_Shift2) AS secInchargeSign_Shift2,
                MAX(secInchargeSign_Shift3) AS secInchargeSign_Shift3,
                MAX(shiftOfficerSign_Shift1) AS shiftOfficerSign_Shift1,
                MAX(shiftOfficerSign_Shift2) AS shiftOfficerSign_Shift2,
                MAX(shiftOfficerSign_Shift3) AS shiftOfficerSign_Shift3,
                'Pending Review' AS status
            FROM DailyProductionIdleTimeReport
            WHERE (
                secInchargeSign_Shift1 LIKE 'Pending [%' OR
                secInchargeSign_Shift2 LIKE 'Pending [%' OR
                secInchargeSign_Shift3 LIKE 'Pending [%' OR
                shiftOfficerSign_Shift1 LIKE 'Pending [%' OR
                shiftOfficerSign_Shift2 LIKE 'Pending [%' OR
                shiftOfficerSign_Shift3 LIKE 'Pending [%'
            )
            AND NOT (
                (secInchargeSign_Shift1 LIKE 'Approved (%' OR secInchargeSign_Shift1 IS NULL OR secInchargeSign_Shift1 = '') AND
                (secInchargeSign_Shift2 LIKE 'Approved (%' OR secInchargeSign_Shift2 IS NULL OR secInchargeSign_Shift2 = '') AND
                (secInchargeSign_Shift3 LIKE 'Approved (%' OR secInchargeSign_Shift3 IS NULL OR secInchargeSign_Shift3 = '') AND
                (shiftOfficerSign_Shift1 LIKE 'Approved (%' OR shiftOfficerSign_Shift1 IS NULL OR shiftOfficerSign_Shift1 = '') AND
                (shiftOfficerSign_Shift2 LIKE 'Approved (%' OR shiftOfficerSign_Shift2 IS NULL OR shiftOfficerSign_Shift2 = '') AND
                (shiftOfficerSign_Shift3 LIKE 'Approved (%' OR shiftOfficerSign_Shift3 IS NULL OR shiftOfficerSign_Shift3 = '')
            )
              ${shopFilter}
            GROUP BY machineShop, lineCode, reportDate
            ORDER BY reportDate DESC
        `);

        return res.status(200).json(result.recordset);
    } catch (err) {
        console.error("Error fetching pending PE idle time data:", err);
        return res.status(500).json({ error: 'Failed to fetch pending PE idle time data' });
    }
};

// ============================================================
// POST: PE SIGN AND APPROVE
// ============================================================
const signPEApproval = async (req, res) => {
    try {
        const { lineCode, date, machineShop, signature } = req.body;
        if (!date || !signature) {
            return res.status(400).json({ error: 'Missing required parameters (date, signature)' });
        }

        let cleanDate = String(date).split('T')[0];

        const request = new sql.Request();
        request.input('checkDate', sql.NVarChar(50), cleanDate)
            .input('approvedStr', sql.NVarChar(255), `Approved (${signature})`);

        let lineFilter = '';
        if (lineCode) {
            request.input('lineCode', sql.NVarChar(100), lineCode);
            lineFilter = ' AND lineCode = @lineCode';
        }

        let shopFilter = '';
        if (machineShop) {
            request.input('machineShop', sql.Int, parseInt(machineShop));
            shopFilter = ' AND machineShop = @machineShop';
        }

        const result = await request.query(`
            UPDATE DailyProductionIdleTimeReport 
            SET 
                secInchargeSign_Shift1 = CASE WHEN secInchargeSign_Shift1 LIKE 'Pending [%' THEN @approvedStr ELSE secInchargeSign_Shift1 END,
                secInchargeSign_Shift2 = CASE WHEN secInchargeSign_Shift2 LIKE 'Pending [%' THEN @approvedStr ELSE secInchargeSign_Shift2 END,
                secInchargeSign_Shift3 = CASE WHEN secInchargeSign_Shift3 LIKE 'Pending [%' THEN @approvedStr ELSE secInchargeSign_Shift3 END,
                shiftOfficerSign_Shift1 = CASE WHEN shiftOfficerSign_Shift1 LIKE 'Pending [%' THEN @approvedStr ELSE shiftOfficerSign_Shift1 END,
                shiftOfficerSign_Shift2 = CASE WHEN shiftOfficerSign_Shift2 LIKE 'Pending [%' THEN @approvedStr ELSE shiftOfficerSign_Shift2 END,
                shiftOfficerSign_Shift3 = CASE WHEN shiftOfficerSign_Shift3 LIKE 'Pending [%' THEN @approvedStr ELSE shiftOfficerSign_Shift3 END
            WHERE CONVERT(date, reportDate) = CONVERT(date, @checkDate)
              AND (
                secInchargeSign_Shift1 LIKE 'Pending [%' OR 
                secInchargeSign_Shift2 LIKE 'Pending [%' OR 
                secInchargeSign_Shift3 LIKE 'Pending [%' OR
                shiftOfficerSign_Shift1 LIKE 'Pending [%' OR 
                shiftOfficerSign_Shift2 LIKE 'Pending [%' OR 
                shiftOfficerSign_Shift3 LIKE 'Pending [%'
              )
              ${lineFilter}
              ${shopFilter}
        `);

        return res.status(200).json({ success: true, message: 'Idle Time Report verified and approved successfully' });
    } catch (err) {
        console.error("Error approving Idle Time Report:", err);
        return res.status(500).json({ error: 'Failed to sign and approve report' });
    }
};

// ============================================================
// GENERATE PDF REPORT FOR PREVIEW & VERIFICATION
// ============================================================
const generateIdleTimeReport = async (req, res) => {
    try {
        const { shopId, date, lineCode } = req.query;

        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        const cleanDate = String(date).split('T')[0];
        const request = new sql.Request();
        request.input('reportDate', sql.Date, cleanDate);

        let query = `
            SELECT * FROM DailyProductionIdleTimeReport
            WHERE reportDate = @reportDate
        `;

        if (shopId) {
            request.input('machineShop', sql.Int, parseInt(shopId));
            query += ` AND machineShop = @machineShop`;
        }

        if (lineCode) {
            request.input('lineCode', sql.NVarChar(50), lineCode);
            query += ` AND lineCode = @lineCode`;
        }

        query += ` ORDER BY lineCode ASC`;

        const result = await request.query(query);
        const records = result.recordset || [];

        if (records.length === 0) {
            return res.status(404).json({ message: 'No records found for this date/line' });
        }

        // Generate Landscape PDF
        const doc = new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margins: { top: 15, bottom: 15, left: 15, right: 15 }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="idle_time_report_${cleanDate}.pdf"`);
        doc.pipe(res);

        const LOSS_REASONS = [
            { id: 1, category: "MAN", name: "Want of Man power" },
            { id: 2, category: "MAN", name: "Efficiency" },
            { id: 3, category: "MACHINE", name: "M/c Breakdown" },
            { id: 4, category: "MACHINE", name: "Preventive maintenance" },
            { id: 5, category: "MATERIAL", name: "Want of load" },
            { id: 6, category: "MATERIAL", name: "Want of cutting tool" },
            { id: 7, category: "MATERIAL", name: "Want of jig & fig" },
            { id: 8, category: "METHOD", name: "Process correction" },
            { id: 9, category: "METHOD", name: "Casting Adjustment" },
            { id: 10, category: "MEASUREMENT", name: "Want of inspection Delay" },
            { id: 11, category: "OTHERS", name: "Tool change" },
            { id: 12, category: "OTHERS", name: "Want of Power" },
            { id: 13, category: "OTHERS", name: "Want of schedule" },
        ];

        const startX = 15;
        let startY = 15;
        const totalWidth = 812;

        // Header Border
        doc.rect(startX, startY, totalWidth, 40).stroke();
        doc.font("Helvetica-Bold").fontSize(14).text("SAKTHI AUTO COMPONENT LIMITED", startX, startY + 6, { width: totalWidth, align: "center" });
        doc.fontSize(11).text(`DAILY PRODUCTION & IDLE TIME REPORT - MACHINE SHOP ${shopId || records[0]?.machineShop || 3}`, startX, startY + 22, { width: totalWidth, align: "center" });

        startY += 45;

        // Meta row
        const metaBoxH = 22;
        doc.rect(startX, startY, totalWidth, metaBoxH).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(9);

        const dObj = new Date(cleanDate);
        const formattedDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;

        doc.text(`DATE: ${formattedDate}`, startX + 10, startY + 6);
        doc.text(`LINES INCLUDED: ${records.map(r => r.lineCode).join(', ')}`, startX + 200, startY + 6);
        doc.text(`TOTAL LINES: ${records.length}`, startX + 680, startY + 6);

        startY += metaBoxH + 5;

        // Draw Table
        const colW = Math.min(140, (totalWidth - 240) / Math.max(1, records.length));
        const descW = totalWidth - (colW * records.length);

        const rowH = 14;
        let curY = startY;

        // Header Row 1: Line Code
        doc.rect(startX, curY, descW, rowH).fillAndStroke('#e5e7eb', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("LINE CODE", startX + 5, curY + 3);

        records.forEach((rec, idx) => {
            const x = startX + descW + (idx * colW);
            doc.rect(x, curY, colW, rowH).fillAndStroke('#e5e7eb', 'black');
            doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text(rec.lineCode || '', x, curY + 3, { width: colW, align: "center" });
        });
        curY += rowH;

        // Header Row 2: Part Name
        doc.rect(startX, curY, descW, rowH).fillAndStroke('#ffffff', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("PART NAME", startX + 5, curY + 3);

        records.forEach((rec, idx) => {
            const x = startX + descW + (idx * colW);
            doc.rect(x, curY, colW, rowH).stroke();
            doc.fillColor('black').font("Helvetica").fontSize(7).text(rec.partName || '-', x, curY + 3, { width: colW, align: "center" });
        });
        curY += rowH;

        // Header Row 3: Brake Type
        doc.rect(startX, curY, descW, rowH).fillAndStroke('#ffffff', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("ABS / NABS", startX + 5, curY + 3);

        records.forEach((rec, idx) => {
            const x = startX + descW + (idx * colW);
            doc.rect(x, curY, colW, rowH).stroke();
            doc.fillColor('black').font("Helvetica").fontSize(7).text(rec.brakeType || '-', x, curY + 3, { width: colW, align: "center" });
        });
        curY += rowH;

        // Subheader for Shifts
        doc.rect(startX, curY, descW, rowH).fillAndStroke('#f3f4f6', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("SHIFT DETAILS", startX + 5, curY + 3);

        const shiftW = colW / 4;
        records.forEach((rec, idx) => {
            const x = startX + descW + (idx * colW);
            ['I', 'II', 'III', 'T'].forEach((sh, shIdx) => {
                doc.rect(x + (shIdx * shiftW), curY, shiftW, rowH).fillAndStroke(sh === 'T' ? '#e5e7eb' : '#f9fafb', 'black');
                doc.fillColor('black').font("Helvetica-Bold").fontSize(7).text(sh, x + (shIdx * shiftW), curY + 3, { width: shiftW, align: "center" });
            });
        });
        curY += rowH;

        // Data Rows
        const drawShiftDataRow = (title, getVals, isBold = false, bgColor = '#ffffff') => {
            doc.rect(startX, curY, descW, rowH).fillAndStroke(bgColor, 'black');
            doc.fillColor('black').font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(7.5).text(title, startX + 5, curY + 3);

            records.forEach((rec, idx) => {
                const x = startX + descW + (idx * colW);
                const vals = getVals(rec);
                const s1 = vals[0] != null ? vals[0] : 0;
                const s2 = vals[1] != null ? vals[1] : 0;
                const s3 = vals[2] != null ? vals[2] : 0;
                const total = s1 + s2 + s3;

                [s1, s2, s3, total].forEach((val, shIdx) => {
                    doc.rect(x + (shIdx * shiftW), curY, shiftW, rowH).fillAndStroke(shIdx === 3 ? '#f3f4f6' : bgColor, 'black');
                    doc.fillColor('black').font(shIdx === 3 || isBold ? "Helvetica-Bold" : "Helvetica").fontSize(7).text(val ? String(val) : '-', x + (shIdx * shiftW), curY + 3, { width: shiftW, align: "center" });
                });
            });
            curY += rowH;
        };

        drawShiftDataRow("CAPACITY QTY IN SETS", r => [r.capacity_Shift1, r.capacity_Shift2, r.capacity_Shift3], true, '#f3f4f6');
        drawShiftDataRow("ACTUAL PROD QTY (LH)", r => [r.actualProd_LH_Shift1, r.actualProd_LH_Shift2, r.actualProd_LH_Shift3]);
        drawShiftDataRow("ACTUAL PROD QTY (RH)", r => [r.actualProd_RH_Shift1, r.actualProd_RH_Shift2, r.actualProd_RH_Shift3]);
        drawShiftDataRow("NO OF MANPOWER (UTILIZED)", r => [r.manpower_Shift1, r.manpower_Shift2, r.manpower_Shift3], false, '#f9fafb');

        // Losses 1 to 13
        LOSS_REASONS.forEach(loss => {
            drawShiftDataRow(`${loss.id}. [${loss.category}] ${loss.name}`, r => [
                r[`loss${loss.id}_Shift1`],
                r[`loss${loss.id}_Shift2`],
                r[`loss${loss.id}_Shift3`]
            ]);
        });

        // Total Loss Row
        const calcTotalLossRec = (r, shift) => {
            let sum = 0;
            for (let i = 1; i <= 13; i++) {
                sum += (r[`loss${i}_Shift${shift}`] || 0);
            }
            return sum;
        };

        drawShiftDataRow("TOTAL LOSS (MINS)", r => [
            calcTotalLossRec(r, 1),
            calcTotalLossRec(r, 2),
            calcTotalLossRec(r, 3)
        ], true, '#e5e7eb');

        curY += 8;

        // Signatures Block (Section Incharge & Shift Officer / PE)
        const sigBlockH = 46;
        doc.rect(startX, curY, totalWidth, sigBlockH).stroke();
        const sigColW = totalWidth / 2;

        const firstRec = records[0];

        const drawSignText = (label, sign, baseX, yPos) => {
            doc.font("Helvetica-Bold").fontSize(7).fillColor('black').text(`${label}: `, baseX + 10, yPos, { continued: true });
            if (sign && sign.startsWith('Approved (')) {
                const pName = sign.replace('Approved (', '').replace(')', '');
                doc.fillColor('#16a34a').text(`Approved (${pName})`);
            } else if (sign && sign.startsWith('Pending [')) {
                const pName = sign.replace('Pending [', '').replace(']', '');
                doc.fillColor('#dc2626').text(`Pending PE Review [${pName}]`);
            } else if (sign) {
                doc.fillColor('#16a34a').text(sign);
            } else {
                doc.fillColor('#9ca3af').text('Not Signed');
            }
        };

        // 1. Section Incharge (Send to PE)
        doc.rect(startX, curY, sigColW, sigBlockH).fillAndStroke('#f9fafb', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("SECTION INCHARGE (VERIFIED BY PE)", startX + 5, curY + 4);

        drawSignText("Shift I", firstRec.secInchargeSign_Shift1, startX, curY + 16);
        drawSignText("Shift II", firstRec.secInchargeSign_Shift2, startX, curY + 25);
        drawSignText("Shift III", firstRec.secInchargeSign_Shift3, startX, curY + 34);

        // 2. Shift Officer Signature
        const peX = startX + sigColW;
        doc.rect(peX, curY, sigColW, sigBlockH).fillAndStroke('#f9fafb', 'black');
        doc.fillColor('black').font("Helvetica-Bold").fontSize(8).text("SHIFT OFFICER SIGNATURE", peX + 5, curY + 4);

        drawSignText("Shift I", firstRec.shiftOfficerSign_Shift1, peX, curY + 16);
        drawSignText("Shift II", firstRec.shiftOfficerSign_Shift2, peX, curY + 25);
        drawSignText("Shift III", firstRec.shiftOfficerSign_Shift3, peX, curY + 34);

        doc.end();
    } catch (err) {
        console.error("Error generating Idle Time Report PDF:", err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate PDF' });
        }
    }
};

module.exports = {
    getMachineShopDetails,
    getPartQuantities,
    getPEUsers,
    getDailyProductionIdleTime,
    saveDailyProductionIdleTime,
    getPendingPEIdleTimeData,
    signPEApproval,
    generateIdleTimeReport
};