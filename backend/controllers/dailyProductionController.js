const sql = require('../db');

// ============================================================
// GET MACHINE SHOP DETAILS DYNAMICALLY
// ============================================================

const getMachineShopDetails = async (req, res) => {
  const { shopId } = req.params;
  
  try {
    // Dynamic table querying based on shopId (e.g., MachineShop3Details)
    // Note: Template literals used for table names as they can't be parameterized
    const tableName = `MachineShop${parseInt(shopId)}Details`;
    
    const result = await sql.query(`
      SELECT
        id,
        lineCode,
        partName,
        partNo,
        machineNo,
        machineType
      FROM ${tableName}
      ORDER BY
        lineCode,
        partName,
        partNo,
        machineNo
    `);

    res.status(200).json(result.recordset);
  } catch (err) {
    console.error(`Error fetching Machine Shop ${shopId} details:`, err);
    res.status(500).json({
      error: `Failed to fetch Machine Shop ${shopId} details`
    });
  }
};


// ============================================================
// SAVE DAILY PRODUCTION REPORT (FLAT TABLE INSERT)
// ============================================================

const saveDailyProductionReport = async (req, res) => {
  const { header, rows, signatures } = req.body;
  let transaction;

  try {
    transaction = new sql.Transaction();
    await transaction.begin();

    for (const row of rows) {
      await transaction
        .request()
        // Header Inputs (Fallback to null or empty string to prevent undefined crashes)
        .input('MachineShop', sql.NVarChar(50), header.machineShop || '')
        .input('ReportDate', sql.Date, header.date ? header.date : null)
        .input('Shift', sql.NVarChar(10), header.shift || '')
        .input('SheetNo', sql.NVarChar(10), header.sheetNo || '')
        .input('SheetTotal', sql.NVarChar(10), header.sheetTotal || '')
        .input('ShiftInchargeName', sql.NVarChar(100), header.shiftInchargeName || '')
        .input('lineCode', sql.NVarChar(50), header.lineCode || '')
        
        // Row Inputs (Robust integer and empty string handling)
        .input('MachineNo', sql.NVarChar(50), row.machineNo || '')
        .input('MachineName', sql.NVarChar(100), row.machineName || '')
        .input('PartNameNo', sql.NVarChar(100), row.partNameNo || '')
        .input('OperationDescription', sql.NVarChar(255), row.operationDescription || '')
        .input('OperatorName', sql.NVarChar(100), row.operatorName || '')
        .input('Produced', sql.Int, (row.produced !== "" && row.produced != null) ? parseInt(row.produced) : null)
        .input('Accepted', sql.Int, (row.accepted !== "" && row.accepted != null) ? parseInt(row.accepted) : null)
        .input('HoldNonConformance', sql.NVarChar(100), row.holdNonConformance || '')
        .input('ReasonForHold_Casting', sql.NVarChar(255), row.reasonForHold?.casting || '')
        .input('ReasonForHold_CastingQty', sql.Int, (row.reasonForHold?.castingQty !== "" && row.reasonForHold?.castingQty != null) ? parseInt(row.reasonForHold.castingQty) : null)
        .input('ReasonForHold_Machining', sql.NVarChar(255), row.reasonForHold?.machining || '')
        .input('ReasonForHold_MachiningQty', sql.Int, (row.reasonForHold?.machiningQty !== "" && row.reasonForHold?.machiningQty != null) ? parseInt(row.reasonForHold.machiningQty) : null)
        .input('McStopTimeReason', sql.NVarChar(255), row.mcStopTimeReason || '')
        
        // Changed to VarChar to prevent mssql driver crash on "HH:mm" strings
        .input('TimeFrom', sql.VarChar(10), row.time?.from || null)
        .input('TimeTo', sql.VarChar(10), row.time?.to || null)

        // Signature Inputs
        .input('Sign_SupervisorProduction', sql.NVarChar(100), signatures?.shiftSupervisorProduction || '')
        .input('Sign_SupervisorQuality', sql.NVarChar(100), signatures?.shiftSupervisorQuality || '')
        .input('Sign_ProductionEngineer', sql.NVarChar(100), signatures?.productionEngineer || '')
        .input('Sign_HOFProduction', sql.NVarChar(100), signatures?.hofProduction || '')
        
        .query(`
          INSERT INTO DailyProductionReport (
            MachineShop, ReportDate, Shift, SheetNo, SheetTotal, ShiftInchargeName, lineCode,
            MachineNo, MachineName, PartNameNo, OperationDescription, OperatorName, 
            Produced, Accepted, HoldNonConformance, ReasonForHold_Casting, ReasonForHold_CastingQty, 
            ReasonForHold_Machining, ReasonForHold_MachiningQty, McStopTimeReason, TimeFrom, TimeTo,
            Sign_SupervisorProduction, Sign_SupervisorQuality, Sign_ProductionEngineer, Sign_HOFProduction
          ) VALUES (
            @MachineShop, @ReportDate, @Shift, @SheetNo, @SheetTotal, @ShiftInchargeName, @lineCode,
            @MachineNo, @MachineName, @PartNameNo, @OperationDescription, @OperatorName,
            @Produced, @Accepted, @HoldNonConformance, @ReasonForHold_Casting, @ReasonForHold_CastingQty,
            @ReasonForHold_Machining, @ReasonForHold_MachiningQty, @McStopTimeReason, @TimeFrom, @TimeTo,
            @Sign_SupervisorProduction, @Sign_SupervisorQuality, @Sign_ProductionEngineer, @Sign_HOFProduction
          )
        `);
    }

    await transaction.commit();

    res.status(201).json({
      message: 'Daily Production Report saved successfully'
    });

  } catch (err) {
    console.error('Error saving Daily Production Report:', err);

    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Transaction rollback error:', rollbackError);
      }
    }

    res.status(500).json({
      error: 'Failed to save Daily Production Report'
    });
  }
};

module.exports = {
  getMachineShopDetails,
  saveDailyProductionReport
};