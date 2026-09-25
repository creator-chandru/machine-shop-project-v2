const sql = require('../db');

// Fetches dynamic line/part details for the dropdowns
const getMachineShopDetails = async (req, res) => {
  const { shopId } = req.params;
  
  try {
    const tableName = `MachineShop${parseInt(shopId)}Details`;
    
    const result = await sql.query(`
      SELECT id, lineCode, partName, partNo, machineNo, machineType
      FROM ${tableName}
      ORDER BY lineCode, partName
    `);

    res.status(200).json(result.recordset);
  } catch (err) {
    console.error(`Error fetching Machine Shop ${shopId} details:`, err);
    res.status(500).json({ error: `Failed to fetch Machine Shop ${shopId} details` });
  }
};

const saveDailyProductionIdleTime = async (req, res) => {
  const { machineShop, date, pageInfo, lineColumns, signatures } = req.body;
  let transaction;

  try {
    transaction = new sql.Transaction();
    await transaction.begin();

    // Insert 1 row per Line Column submitted
    for (const col of lineColumns) {
      const reqInput = transaction.request();

      // Report Header
      reqInput.input('MachineShop', sql.NVarChar(50), machineShop || '');
      reqInput.input('ReportDate', sql.Date, date || null);
      reqInput.input('PageCurrent', sql.NVarChar(10), pageInfo.current || '');
      reqInput.input('PageTotal', sql.NVarChar(10), pageInfo.total || '');

      // Line Details
      reqInput.input('LineCode', sql.NVarChar(50), col.lineCode || '');
      reqInput.input('LineName', sql.NVarChar(100), col.lineName || '');
      reqInput.input('PartName', sql.NVarChar(100), col.partName || '');

      // Capacity
      reqInput.input('Capacity_Shift1', sql.Int, col.capacity.shift1 ? parseInt(col.capacity.shift1) : null);
      reqInput.input('Capacity_Shift2', sql.Int, col.capacity.shift2 ? parseInt(col.capacity.shift2) : null);
      reqInput.input('Capacity_Shift3', sql.Int, col.capacity.shift3 ? parseInt(col.capacity.shift3) : null);

      // Actual Production LH
      reqInput.input('ActualProd_LH_Shift1', sql.Int, col.actualProd.lh.shift1 ? parseInt(col.actualProd.lh.shift1) : null);
      reqInput.input('ActualProd_LH_Shift2', sql.Int, col.actualProd.lh.shift2 ? parseInt(col.actualProd.lh.shift2) : null);
      reqInput.input('ActualProd_LH_Shift3', sql.Int, col.actualProd.lh.shift3 ? parseInt(col.actualProd.lh.shift3) : null);

      // Actual Production RH
      reqInput.input('ActualProd_RH_Shift1', sql.Int, col.actualProd.rh.shift1 ? parseInt(col.actualProd.rh.shift1) : null);
      reqInput.input('ActualProd_RH_Shift2', sql.Int, col.actualProd.rh.shift2 ? parseInt(col.actualProd.rh.shift2) : null);
      reqInput.input('ActualProd_RH_Shift3', sql.Int, col.actualProd.rh.shift3 ? parseInt(col.actualProd.rh.shift3) : null);

      // Manpower
      reqInput.input('Manpower_Shift1', sql.Int, col.manpower.shift1 ? parseInt(col.manpower.shift1) : null);
      reqInput.input('Manpower_Shift2', sql.Int, col.manpower.shift2 ? parseInt(col.manpower.shift2) : null);
      reqInput.input('Manpower_Shift3', sql.Int, col.manpower.shift3 ? parseInt(col.manpower.shift3) : null);

      // Losses (1 to 13)
      for (let i = 1; i <= 13; i++) {
        reqInput.input(`Loss${i}_Shift1`, sql.Float, col.losses[`loss_${i}`]?.shift1 ? parseFloat(col.losses[`loss_${i}`].shift1) : null);
        reqInput.input(`Loss${i}_Shift2`, sql.Float, col.losses[`loss_${i}`]?.shift2 ? parseFloat(col.losses[`loss_${i}`].shift2) : null);
        reqInput.input(`Loss${i}_Shift3`, sql.Float, col.losses[`loss_${i}`]?.shift3 ? parseFloat(col.losses[`loss_${i}`].shift3) : null);
      }

      // Signatures
      reqInput.input('SecInchargeSign_Shift1', sql.NVarChar(100), signatures.sectionInchargeSign.shift1 || '');
      reqInput.input('SecInchargeSign_Shift2', sql.NVarChar(100), signatures.sectionInchargeSign.shift2 || '');
      reqInput.input('SecInchargeSign_Shift3', sql.NVarChar(100), signatures.sectionInchargeSign.shift3 || '');
      
      reqInput.input('SecInchargeName_Shift1', sql.NVarChar(100), signatures.sectionInchargeName.shift1 || '');
      reqInput.input('SecInchargeName_Shift2', sql.NVarChar(100), signatures.sectionInchargeName.shift2 || '');
      reqInput.input('SecInchargeName_Shift3', sql.NVarChar(100), signatures.sectionInchargeName.shift3 || '');
      
      reqInput.input('ShiftOfficerSign_Shift1', sql.NVarChar(100), signatures.shiftOfficerSign.shift1 || '');
      reqInput.input('ShiftOfficerSign_Shift2', sql.NVarChar(100), signatures.shiftOfficerSign.shift2 || '');
      reqInput.input('ShiftOfficerSign_Shift3', sql.NVarChar(100), signatures.shiftOfficerSign.shift3 || '');
      
      reqInput.input('TeamLeaderSign', sql.NVarChar(100), signatures.teamLeaderSign || '');
      reqInput.input('TeamLeaderName', sql.NVarChar(100), signatures.teamLeaderName || '');

      await reqInput.query(`
        INSERT INTO DailyProductionIdleTimeReport (
          MachineShop, ReportDate, PageCurrent, PageTotal, LineCode, LineName, PartName,
          Capacity_Shift1, Capacity_Shift2, Capacity_Shift3,
          ActualProd_LH_Shift1, ActualProd_LH_Shift2, ActualProd_LH_Shift3,
          ActualProd_RH_Shift1, ActualProd_RH_Shift2, ActualProd_RH_Shift3,
          Manpower_Shift1, Manpower_Shift2, Manpower_Shift3,
          Loss1_Shift1, Loss1_Shift2, Loss1_Shift3, Loss2_Shift1, Loss2_Shift2, Loss2_Shift3,
          Loss3_Shift1, Loss3_Shift2, Loss3_Shift3, Loss4_Shift1, Loss4_Shift2, Loss4_Shift3,
          Loss5_Shift1, Loss5_Shift2, Loss5_Shift3, Loss6_Shift1, Loss6_Shift2, Loss6_Shift3,
          Loss7_Shift1, Loss7_Shift2, Loss7_Shift3, Loss8_Shift1, Loss8_Shift2, Loss8_Shift3,
          Loss9_Shift1, Loss9_Shift2, Loss9_Shift3, Loss10_Shift1, Loss10_Shift2, Loss10_Shift3,
          Loss11_Shift1, Loss11_Shift2, Loss11_Shift3, Loss12_Shift1, Loss12_Shift2, Loss12_Shift3,
          Loss13_Shift1, Loss13_Shift2, Loss13_Shift3,
          SecInchargeSign_Shift1, SecInchargeSign_Shift2, SecInchargeSign_Shift3,
          SecInchargeName_Shift1, SecInchargeName_Shift2, SecInchargeName_Shift3,
          ShiftOfficerSign_Shift1, ShiftOfficerSign_Shift2, ShiftOfficerSign_Shift3,
          TeamLeaderSign, TeamLeaderName
        ) VALUES (
          @MachineShop, @ReportDate, @PageCurrent, @PageTotal, @LineCode, @LineName, @PartName,
          @Capacity_Shift1, @Capacity_Shift2, @Capacity_Shift3,
          @ActualProd_LH_Shift1, @ActualProd_LH_Shift2, @ActualProd_LH_Shift3,
          @ActualProd_RH_Shift1, @ActualProd_RH_Shift2, @ActualProd_RH_Shift3,
          @Manpower_Shift1, @Manpower_Shift2, @Manpower_Shift3,
          @Loss1_Shift1, @Loss1_Shift2, @Loss1_Shift3, @Loss2_Shift1, @Loss2_Shift2, @Loss2_Shift3,
          @Loss3_Shift1, @Loss3_Shift2, @Loss3_Shift3, @Loss4_Shift1, @Loss4_Shift2, @Loss4_Shift3,
          @Loss5_Shift1, @Loss5_Shift2, @Loss5_Shift3, @Loss6_Shift1, @Loss6_Shift2, @Loss6_Shift3,
          @Loss7_Shift1, @Loss7_Shift2, @Loss7_Shift3, @Loss8_Shift1, @Loss8_Shift2, @Loss8_Shift3,
          @Loss9_Shift1, @Loss9_Shift2, @Loss9_Shift3, @Loss10_Shift1, @Loss10_Shift2, @Loss10_Shift3,
          @Loss11_Shift1, @Loss11_Shift2, @Loss11_Shift3, @Loss12_Shift1, @Loss12_Shift2, @Loss12_Shift3,
          @Loss13_Shift1, @Loss13_Shift2, @Loss13_Shift3,
          @SecInchargeSign_Shift1, @SecInchargeSign_Shift2, @SecInchargeSign_Shift3,
          @SecInchargeName_Shift1, @SecInchargeName_Shift2, @SecInchargeName_Shift3,
          @ShiftOfficerSign_Shift1, @ShiftOfficerSign_Shift2, @ShiftOfficerSign_Shift3,
          @TeamLeaderSign, @TeamLeaderName
        )
      `);
    }

    await transaction.commit();
    res.status(201).json({ message: 'Daily Production & Idle Time Report saved successfully' });

  } catch (err) {
    console.error('Error saving Idle Time Report:', err);
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Transaction rollback error:', rollbackError);
      }
    }
    res.status(500).json({ error: 'Failed to save Idle Time Report' });
  }
};

// ============================================================
// GET PART QUANTITIES DYNAMICALLY
// ============================================================
const getPartQuantities = async (req, res) => {
  const { shopId } = req.params;
  
  try {
    const tableName = `MachineShop${parseInt(shopId)}PartQty`;
    
    const result = await sql.query(`
      SELECT partName, shift1Quantity, shift2Quantity, shift3Quantity
      FROM ${tableName}
    `);

    res.status(200).json(result.recordset);
  } catch (err) {
    console.error(`Error fetching part quantities for shop ${shopId}:`, err);
    res.status(500).json({ error: `Failed to fetch part quantities` });
  }
};

module.exports = {
  getMachineShopDetails,
  saveDailyProductionIdleTime,
  getPartQuantities
};