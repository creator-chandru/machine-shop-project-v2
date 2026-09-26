const sql = require('../db');

// ============================================================
// HELPER: GENERATE PART TRACEABILITY CODE
// Format: YEAR + MONTH + DAY + SHIFT - LINE (e.g. S9S2-1A, S9S2-36A)
// ============================================================
const generatePartTraceability = async (transaction, lineCode, checkDate, shift) => {
  if (!lineCode || !checkDate || !shift) {
    return '';
  }

  // Extract digits and optional letter suffix (e.g. M3L001 -> 1, M3L01A -> 1A, M3L36A -> 36A)
  const lineMatch = String(lineCode).match(/(\d+)([A-Za-z]*)$/);

  if (!lineMatch) {
    return '';
  }

  const digits = parseInt(lineMatch[1], 10);
  const suffix = lineMatch[2] ? lineMatch[2].toUpperCase() : '';
  const lineIdentifier = `${digits}${suffix}`;

  const shiftMap = {
    I: 1,
    II: 2,
    III: 3,
    '1': 1,
    '2': 2,
    '3': 3,
  };

  const shiftNumber = shiftMap[String(shift).trim().toUpperCase()];

  if (!shiftNumber) {
    return '';
  }

  let year, month, day;
  if (typeof checkDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(checkDate)) {
    const parts = checkDate.split('T')[0].split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    const dateObj = new Date(checkDate);
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    year = dateObj.getFullYear();
    month = dateObj.getMonth() + 1;
    day = dateObj.getDate();
  }

  const request = transaction.request();

  request.input('yearValue', sql.Int, year);
  request.input('monthValue', sql.Int, month);
  request.input('dayValue', sql.Int, day);
  request.input('shiftValue', sql.Int, shiftNumber);

  const result = await request.query(`
    SELECT
      (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'YEAR' AND SourceValue = @yearValue) AS yearCode,
      (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'MONTH' AND SourceValue = @monthValue) AS monthCode,
      (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'DAY' AND SourceValue = @dayValue) AS dayCode,
      (SELECT CodeValue FROM TraceabilityCodeMapping WHERE MappingType = 'SHIFT' AND SourceValue = @shiftValue) AS shiftCode
  `);

  const mapping = result.recordset[0];

  if (!mapping || !mapping.yearCode || !mapping.monthCode || !mapping.dayCode || !mapping.shiftCode) {
    return '';
  }

  return `${mapping.yearCode}${mapping.monthCode}${mapping.dayCode}${mapping.shiftCode}-${lineIdentifier}`;
};

// ============================================================
// GET PART TRACEABILITY
// ============================================================
const getPartTraceability = async (req, res) => {
  const { lineCode, date, shift } = req.query;

  if (!lineCode || !date || !shift) {
    return res.status(400).json({
      error: 'lineCode, date and shift are required',
    });
  }

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    const partTraceability = await generatePartTraceability(
      transaction,
      lineCode,
      date,
      shift
    );

    await transaction.commit();

    return res.status(200).json({
      partTraceability: partTraceability || '',
    });
  } catch (err) {
    console.error('Error generating Part Traceability:', err);

    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }

    return res.status(500).json({
      error: 'Failed to generate Part Traceability',
    });
  }
};

// ============================================================
// GET MACHINE SHOP DETAILS DYNAMICALLY
// ============================================================
const getMachineShopDetails = async (req, res) => {
  const { shopId } = req.params;
  
  try {
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

    const lineCode = header?.lineCode || '';
    const reportDate = header?.date || null;
    const shift = header?.shift || 'I';

    let partTraceabilityMachining = header?.partTraceabilityMachining || '';
    if (!partTraceabilityMachining.trim()) {
      partTraceabilityMachining = await generatePartTraceability(
        transaction,
        lineCode,
        reportDate,
        shift
      );
    }

    for (const row of rows) {
      await transaction
        .request()
        .input('MachineShop', sql.NVarChar(50), header?.machineShop || '')
        .input('lineCode', sql.NVarChar(50), lineCode)
        .input('PartTraceabilityMachining', sql.NVarChar(100), partTraceabilityMachining)
        .input('ReportDate', sql.Date, reportDate ? reportDate : null)
        .input('Shift', sql.NVarChar(10), shift)
        .input('ShiftInchargeName', sql.NVarChar(100), header?.shiftInchargeName || '')
        
        // Row Inputs
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
        
        .input('TimeFrom', sql.VarChar(10), row.time?.from || null)
        .input('TimeTo', sql.VarChar(10), row.time?.to || null)

        // Signature Inputs
        .input('Sign_SupervisorProduction', sql.NVarChar(100), signatures?.shiftSupervisorProduction || '')
        .input('Sign_SupervisorQuality', sql.NVarChar(100), signatures?.shiftSupervisorQuality || '')
        .input('Sign_ProductionEngineer', sql.NVarChar(100), signatures?.productionEngineer || '')
        .input('Sign_HOFProduction', sql.NVarChar(100), signatures?.hofProduction || '')
        
        .query(`
          INSERT INTO DailyProductionReport (
            MachineShop, lineCode, PartTraceabilityMachining, ReportDate, Shift, ShiftInchargeName, 
            MachineNo, MachineName, PartNameNo, OperationDescription, OperatorName, 
            Produced, Accepted, HoldNonConformance, ReasonForHold_Casting, ReasonForHold_CastingQty, 
            ReasonForHold_Machining, ReasonForHold_MachiningQty, McStopTimeReason, TimeFrom, TimeTo,
            Sign_SupervisorProduction, Sign_SupervisorQuality, Sign_ProductionEngineer, Sign_HOFProduction
          ) VALUES (
            @MachineShop, @lineCode, @PartTraceabilityMachining, @ReportDate, @Shift, @ShiftInchargeName, 
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
  saveDailyProductionReport,
  getPartTraceability
};