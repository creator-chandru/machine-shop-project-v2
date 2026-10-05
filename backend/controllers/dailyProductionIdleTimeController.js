
const sql = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ============================================================
// ENSURE TABLE & COLUMNS EXIST
// ============================================================
const ensureTableExists = async () => {
  try {
    await sql.query(`
      IF NOT EXISTS (
        SELECT * 
        FROM sys.tables 
        WHERE name = 'DailyProductionIdleTimeReport'
      )
      BEGIN
        CREATE TABLE DailyProductionIdleTimeReport (
          id INT IDENTITY(1,1) PRIMARY KEY,
          machineShop INT NOT NULL,
          reportDate DATE NOT NULL,
          lineCode NVARCHAR(50) NOT NULL,
          partName NVARCHAR(100),
          brakeType NVARCHAR(50),
          partTraceabilityMachining NVARCHAR(100),
          shiftInchargeName NVARCHAR(100),

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

          loss1_Shift1 FLOAT,
          loss1_Shift2 FLOAT,
          loss1_Shift3 FLOAT,

          loss2_Shift1 FLOAT,
          loss2_Shift2 FLOAT,
          loss2_Shift3 FLOAT,

          loss3_Shift1 FLOAT,
          loss3_Shift2 FLOAT,
          loss3_Shift3 FLOAT,

          loss4_Shift1 FLOAT,
          loss4_Shift2 FLOAT,
          loss4_Shift3 FLOAT,

          loss5_Shift1 FLOAT,
          loss5_Shift2 FLOAT,
          loss5_Shift3 FLOAT,

          loss6_Shift1 FLOAT,
          loss6_Shift2 FLOAT,
          loss6_Shift3 FLOAT,

          loss7_Shift1 FLOAT,
          loss7_Shift2 FLOAT,
          loss7_Shift3 FLOAT,

          loss8_Shift1 FLOAT,
          loss8_Shift2 FLOAT,
          loss8_Shift3 FLOAT,

          loss9_Shift1 FLOAT,
          loss9_Shift2 FLOAT,
          loss9_Shift3 FLOAT,

          loss10_Shift1 FLOAT,
          loss10_Shift2 FLOAT,
          loss10_Shift3 FLOAT,

          loss11_Shift1 FLOAT,
          loss11_Shift2 FLOAT,
          loss11_Shift3 FLOAT,

          loss12_Shift1 FLOAT,
          loss12_Shift2 FLOAT,
          loss12_Shift3 FLOAT,

          loss13_Shift1 FLOAT,
          loss13_Shift2 FLOAT,
          loss13_Shift3 FLOAT,

          secInchargeSign_Shift1 NVARCHAR(100),
          secInchargeSign_Shift2 NVARCHAR(100),
          secInchargeSign_Shift3 NVARCHAR(100),

          shiftOfficerSign_Shift1 NVARCHAR(100),
          shiftOfficerSign_Shift2 NVARCHAR(100),
          shiftOfficerSign_Shift3 NVARCHAR(100),

          Sign_SupervisorProduction NVARCHAR(100),
          Sign_SupervisorQuality NVARCHAR(100),
          Sign_ProductionEngineer NVARCHAR(100),
          Sign_HOFProduction NVARCHAR(100),

          assignedQc NVARCHAR(100),
          assignedPe NVARCHAR(100),
          assignedHof NVARCHAR(100),

          createdAt DATETIME DEFAULT GETDATE(),

          CONSTRAINT CK_DailyProductionIdleTimeReport_MachineShop
            CHECK (machineShop IN (1, 2, 3, 4, 5))
        );
      END
      ELSE
      BEGIN

        IF NOT EXISTS (
          SELECT *
          FROM sys.columns
          WHERE object_id = OBJECT_ID('DailyProductionIdleTimeReport')
          AND name = 'partTraceabilityMachining'
        )
        ALTER TABLE DailyProductionIdleTimeReport
        ADD partTraceabilityMachining NVARCHAR(100);

        IF NOT EXISTS (
          SELECT *
          FROM sys.columns
          WHERE object_id = OBJECT_ID('DailyProductionIdleTimeReport')
          AND name = 'shiftInchargeName'
        )
        ALTER TABLE DailyProductionIdleTimeReport
        ADD shiftInchargeName NVARCHAR(100);

        IF NOT EXISTS (
          SELECT *
          FROM sys.columns
          WHERE object_id = OBJECT_ID('DailyProductionIdleTimeReport')
          AND name = 'Sign_SupervisorProduction'
        )
        ALTER TABLE DailyProductionIdleTimeReport
        ADD Sign_SupervisorProduction NVARCHAR(100);

        IF NOT EXISTS (
          SELECT *
          FROM sys.columns
          WHERE object_id = OBJECT_ID('DailyProductionIdleTimeReport')
          AND name = 'Sign_SupervisorQuality'
        )
        ALTER TABLE DailyProductionIdleTimeReport
        ADD Sign_SupervisorQuality NVARCHAR(100);

        IF NOT EXISTS (
          SELECT *
          FROM sys.columns
          WHERE object_id = OBJECT_ID('DailyProductionIdleTimeReport')
          AND name = 'Sign_ProductionEngineer'
        )
        ALTER TABLE DailyProductionIdleTimeReport
        ADD Sign_ProductionEngineer NVARCHAR(100);

        IF NOT EXISTS (
          SELECT *
          FROM sys.columns
          WHERE object_id = OBJECT_ID('DailyProductionIdleTimeReport')
          AND name = 'Sign_HOFProduction'
        )
        ALTER TABLE DailyProductionIdleTimeReport
        ADD Sign_HOFProduction NVARCHAR(100);

        IF NOT EXISTS (
          SELECT *
          FROM sys.columns
          WHERE object_id = OBJECT_ID('DailyProductionIdleTimeReport')
          AND name = 'assignedQc'
        )
        ALTER TABLE DailyProductionIdleTimeReport
        ADD assignedQc NVARCHAR(100);

        IF NOT EXISTS (
          SELECT *
          FROM sys.columns
          WHERE object_id = OBJECT_ID('DailyProductionIdleTimeReport')
          AND name = 'assignedPe'
        )
        ALTER TABLE DailyProductionIdleTimeReport
        ADD assignedPe NVARCHAR(100);

        IF NOT EXISTS (
          SELECT *
          FROM sys.columns
          WHERE object_id = OBJECT_ID('DailyProductionIdleTimeReport')
          AND name = 'assignedHof'
        )
        ALTER TABLE DailyProductionIdleTimeReport
        ADD assignedHof NVARCHAR(100);

      END
    `);

    console.log(
      'DailyProductionIdleTimeReport table/columns checked successfully'
    );
  } catch (e) {
    console.error(
      'Error ensuring DailyProductionIdleTimeReport table exists:',
      e
    );

    // Important: do not hide the real database error
    throw e;
  }
};


// ============================================================
// HELPER: GENERATE PART TRACEABILITY CODE
// ============================================================
const generatePartTraceability = async (
  transaction,
  lineCode,
  checkDate,
  shift
) => {
  if (!lineCode || !checkDate) return '';

  const lineMatch = String(lineCode).match(/(\d+)([A-Za-z]*)$/);

  if (!lineMatch) return '';

  const digits = parseInt(lineMatch[1], 10);
  const suffix = lineMatch[2]
    ? lineMatch[2].toUpperCase()
    : '';

  const lineIdentifier = `${digits}${suffix}`;

  const shiftMap = {
    I: 1,
    II: 2,
    III: 3,
    '1': 1,
    '2': 2,
    '3': 3
  };

  const shiftNumber =
    shiftMap[
    String(shift || 'I')
      .trim()
      .toUpperCase()
    ] || 1;

  let year;
  let month;
  let day;

  if (
    typeof checkDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}/.test(checkDate)
  ) {
    const parts = checkDate
      .split('T')[0]
      .split('-');

    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    const dateObj = new Date(checkDate);

    if (isNaN(dateObj.getTime())) return '';

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
      (
        SELECT CodeValue
        FROM TraceabilityCodeMapping
        WHERE MappingType = 'YEAR'
        AND SourceValue = @yearValue
      ) AS yearCode,

      (
        SELECT CodeValue
        FROM TraceabilityCodeMapping
        WHERE MappingType = 'MONTH'
        AND SourceValue = @monthValue
      ) AS monthCode,

      (
        SELECT CodeValue
        FROM TraceabilityCodeMapping
        WHERE MappingType = 'DAY'
        AND SourceValue = @dayValue
      ) AS dayCode,

      (
        SELECT CodeValue
        FROM TraceabilityCodeMapping
        WHERE MappingType = 'SHIFT'
        AND SourceValue = @shiftValue
      ) AS shiftCode
  `);

  const mapping = result.recordset[0];

  if (
    !mapping ||
    !mapping.yearCode ||
    !mapping.monthCode ||
    !mapping.dayCode ||
    !mapping.shiftCode
  ) {
    return '';
  }

  return `${mapping.yearCode}${mapping.monthCode}${mapping.dayCode}${mapping.shiftCode}-${lineIdentifier}`;
};


// ============================================================
// 1. GET PART TRACEABILITY
// ============================================================
const getPartTraceability = async (req, res) => {
  const { lineCode, date, shift } = req.query;

  if (!lineCode || !date) {
    return res.status(400).json({
      error: 'lineCode and date are required'
    });
  }

  const transaction = new sql.Transaction();

  try {
    await transaction.begin();

    const partTraceability =
      await generatePartTraceability(
        transaction,
        lineCode,
        date,
        shift || 'I'
      );

    await transaction.commit();

    return res.status(200).json({
      partTraceability: partTraceability || ''
    });
  } catch (err) {
    console.error(
      'Error generating Part Traceability:',
      err
    );

    try {
      await transaction.rollback();
    } catch (e) { }

    return res.status(500).json({
      error: 'Failed to generate Part Traceability'
    });
  }
};


// ============================================================
// 2. GET QC INCHARGES LIST
// ============================================================
const getIncharges = async (req, res) => {
  try {
    const qcRes = await sql.query`
      SELECT
        username AS name,
        username,
        employeeId
      FROM dbo.MachineShopUsers
      WHERE LOWER(role) IN ('qc', 'qualitycontroller')
      ORDER BY username ASC
    `;

    const list =
      qcRes.recordset.length > 0
        ? qcRes.recordset
        : [
          {
            name: 'qc',
            username: 'qc',
            employeeId: 'qc'
          }
        ];

    return res.status(200).json({
      qcList: list
    });
  } catch (err) {
    console.error(
      'Error fetching QC incharges:',
      err
    );

    return res.status(500).json({
      error: 'Failed to fetch QC list'
    });
  }
};


// ============================================================
// 3. GET PE INCHARGES LIST
// ============================================================
const getPeIncharges = async (req, res) => {
  try {
    const peRes = await sql.query`
      SELECT
        username AS name,
        username,
        employeeId
      FROM dbo.MachineShopUsers
      WHERE LOWER(role) IN (
        'pe',
        'productengineer',
        'productionengineer'
      )
      ORDER BY username ASC
    `;

    const list =
      peRes.recordset.length > 0
        ? peRes.recordset
        : [
          {
            name: 'pe',
            username: 'pe',
            employeeId: 'pe'
          }
        ];

    return res.status(200).json({
      peList: list
    });
  } catch (err) {
    console.error(
      'Error fetching PE incharges:',
      err
    );

    return res.status(500).json({
      error: 'Failed to fetch PE list'
    });
  }
};


// ============================================================
// 4. GET HOF INCHARGES LIST
// ============================================================
const getHofIncharges = async (req, res) => {
  try {
    const hofRes = await sql.query`
      SELECT
        username AS name,
        username,
        employeeId
      FROM dbo.MachineShopUsers
      WHERE LOWER(role) IN (
        'hof',
        'headfacility',
        'headofproduction'
      )
      ORDER BY username ASC
    `;

    const list =
      hofRes.recordset.length > 0
        ? hofRes.recordset
        : [
          {
            name: 'hof',
            username: 'hof',
            employeeId: 'hof'
          }
        ];

    return res.status(200).json({
      hofList: list
    });
  } catch (err) {
    console.error(
      'Error fetching HOF incharges:',
      err
    );

    return res.status(500).json({
      error: 'Failed to fetch HOF list'
    });
  }
};


// ============================================================
// 5. GET PE USERS
// ============================================================
const getPEUsers = async (req, res) => {
  try {
    const usersRes = await sql.query`
      SELECT
        username AS name,
        username,
        employeeId,
        role
      FROM dbo.MachineShopUsers
      ORDER BY username ASC
    `;

    const allUsers = usersRes.recordset || [];

    const peList = allUsers.filter(
      u =>
        String(u.role || '')
          .toLowerCase()
          .includes('pe') ||
        String(u.role || '')
          .toLowerCase()
          .includes('productengineer')
    );

    const inchargeList = allUsers.filter(
      u =>
        [
          'shiftincharge',
          'sectionincharge',
          'incharge',
          'operator',
          'supervisor'
        ].includes(
          String(u.role || '').toLowerCase()
        )
    );

    return res.status(200).json({
      allUsers,

      peList:
        peList.length > 0
          ? peList
          : allUsers,

      inchargeList:
        inchargeList.length > 0
          ? inchargeList
          : allUsers
    });
  } catch (err) {
    console.error(
      'Error fetching users list:',
      err
    );

    return res.status(500).json({
      error: 'Failed to fetch user list'
    });
  }
};


// ============================================================
// 6. GET MACHINE SHOP DETAILS
// ============================================================
const getMachineShopDetails = async (req, res) => {
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
      `MachineShop${parsedShopId}Details`;

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
      error:
        `Failed to fetch Machine Shop ${shopId} details`
    });
  }
};


// ============================================================
// 7. GET PART QUANTITIES
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
// 8. GET SAVED REPORT
// ============================================================
const getDailyProductionIdleTime = async (req, res) => {
  try {
    const {
      shopId,
      date,
      lineCode
    } = req.query;

    if (!shopId || !date) {
      return res.status(400).json({
        error: 'shopId and date are required'
      });
    }

    let cleanDate = date;

    if (date && date.includes('/')) {
      const parts = date.split('/');

      if (parts.length === 3) {
        cleanDate =
          `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    } else if (date && date.includes('T')) {
      cleanDate = date.split('T')[0];
    }

    const request = new sql.Request();

    request.input(
      'machineShop',
      sql.Int,
      parseInt(shopId, 10)
    );

    request.input(
      'reportDate',
      sql.NVarChar(50),
      cleanDate
    );

    let query = `
      SELECT *
      FROM DailyProductionIdleTimeReport
      WHERE machineShop = @machineShop
      AND CONVERT(date, reportDate) =
          CONVERT(date, @reportDate)
    `;

    if (lineCode) {
      request.input(
        'lineCode',
        sql.NVarChar(50),
        lineCode
      );

      query += `
        AND lineCode = @lineCode
      `;
    }

    query += `
      ORDER BY id ASC
    `;

    const result =
      await request.query(query);

    if (
      !result.recordset ||
      result.recordset.length === 0
    ) {
      return res.status(200).json({
        exists: false,
        header: null,
        lineColumns: [],
        signatures: null
      });
    }

    const rows = result.recordset;

    const lineColumns = rows.map(r => {
      const losses = {};

      for (let i = 1; i <= 13; i++) {
        losses[`loss_${i}`] = {
          shift1:
            r[`loss${i}_Shift1`] != null
              ? String(r[`loss${i}_Shift1`])
              : '',

          shift2:
            r[`loss${i}_Shift2`] != null
              ? String(r[`loss${i}_Shift2`])
              : '',

          shift3:
            r[`loss${i}_Shift3`] != null
              ? String(r[`loss${i}_Shift3`])
              : ''
        };
      }

      return {
        lineCode: r.lineCode || '',
        partName: r.partName || '',
        brakeType: r.brakeType || '',

        capacity: {
          shift1:
            r.capacity_Shift1 != null
              ? String(r.capacity_Shift1)
              : '',

          shift2:
            r.capacity_Shift2 != null
              ? String(r.capacity_Shift2)
              : '',

          shift3:
            r.capacity_Shift3 != null
              ? String(r.capacity_Shift3)
              : ''
        },

        actualProd: {
          lh: {
            shift1:
              r.actualProd_LH_Shift1 != null
                ? String(r.actualProd_LH_Shift1)
                : '',

            shift2:
              r.actualProd_LH_Shift2 != null
                ? String(r.actualProd_LH_Shift2)
                : '',

            shift3:
              r.actualProd_LH_Shift3 != null
                ? String(r.actualProd_LH_Shift3)
                : ''
          },

          rh: {
            shift1:
              r.actualProd_RH_Shift1 != null
                ? String(r.actualProd_RH_Shift1)
                : '',

            shift2:
              r.actualProd_RH_Shift2 != null
                ? String(r.actualProd_RH_Shift2)
                : '',

            shift3:
              r.actualProd_RH_Shift3 != null
                ? String(r.actualProd_RH_Shift3)
                : ''
          }
        },

        manpower: {
          shift1:
            r.manpower_Shift1 != null
              ? String(r.manpower_Shift1)
              : '',

          shift2:
            r.manpower_Shift2 != null
              ? String(r.manpower_Shift2)
              : '',

          shift3:
            r.manpower_Shift3 != null
              ? String(r.manpower_Shift3)
              : ''
        },

        losses
      };
    });

    const firstRow = rows[0];

    const header = {
      machineShop: String(firstRow.machineShop),
      date: cleanDate,
      lineCode: firstRow.lineCode || '',
      partName: firstRow.partName || '',
      partTraceabilityMachining:
        firstRow.partTraceabilityMachining || '',
      shiftInchargeName:
        firstRow.shiftInchargeName || '',
      assignedQc:
        firstRow.assignedQc || '',
      assignedPe:
        firstRow.assignedPe || '',
      assignedHof:
        firstRow.assignedHof || ''
    };

    const signatures = {
      shiftSupervisorProduction:
        firstRow.Sign_SupervisorProduction ||
        firstRow.shiftOfficerSign_Shift1 ||
        '',

      shiftSupervisorQuality:
        firstRow.Sign_SupervisorQuality || '',

      productionEngineer:
        firstRow.Sign_ProductionEngineer ||
        firstRow.secInchargeSign_Shift1 ||
        '',

      hofProduction:
        firstRow.Sign_HOFProduction || '',

      sectionInchargeSign: {
        shift1:
          firstRow.secInchargeSign_Shift1 || '',
        shift2:
          firstRow.secInchargeSign_Shift2 || '',
        shift3:
          firstRow.secInchargeSign_Shift3 || ''
      },

      shiftOfficerSign: {
        shift1:
          firstRow.shiftOfficerSign_Shift1 || '',
        shift2:
          firstRow.shiftOfficerSign_Shift2 || '',
        shift3:
          firstRow.shiftOfficerSign_Shift3 || ''
      }
    };

    const status =
      signatures.shiftSupervisorQuality &&
        signatures.productionEngineer &&
        signatures.hofProduction &&
        signatures.shiftSupervisorQuality !== 'Pending' &&
        signatures.productionEngineer !== 'Pending' &&
        signatures.hofProduction !== 'Pending'
        ? 'Completed'
        : 'Pending';

    return res.status(200).json({
      exists: true,
      header,
      lineColumns,
      signatures,
      status
    });

  } catch (err) {
    console.error(
      'Error fetching daily production idle time report:',
      err
    );

    return res.status(500).json({
      error: 'Failed to fetch report data'
    });
  }
};


// ============================================================
// 9. SAVE DAILY PRODUCTION & IDLE TIME REPORT
// ============================================================
const saveDailyProductionIdleTime = async (req, res) => {
  const {
    machineShop,
    date,
    header,
    lineColumns,
    signatures,
    assignedQc,
    assignedPe,
    assignedHof
  } = req.body;

  let transaction;

  try {

    // ========================================================
    // IMPORTANT FIX
    // Make sure the existing SQL table has all new columns
    // before attempting DELETE / INSERT.
    // ========================================================
    await ensureTableExists();

    const shopId = parseInt(
      machineShop ||
      header?.machineShop ||
      '3',
      10
    );

    let reportDate =
      date
        ? String(date).split('T')[0]
        : (
          header?.date
            ? String(header.date).split('T')[0]
            : null
        );

    if (reportDate && reportDate.includes('/')) {
      const parts = reportDate.split('/');

      if (parts.length === 3) {
        reportDate =
          `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    if (!shopId) {
      return res.status(400).json({
        error: 'Machine shop is required'
      });
    }

    if (!reportDate) {
      return res.status(400).json({
        error: 'Report date is required'
      });
    }

    if (
      !Array.isArray(lineColumns) ||
      lineColumns.length === 0
    ) {
      return res.status(400).json({
        error: 'At least one line column is required'
      });
    }

    const shiftInchargeName =
      header?.shiftInchargeName || '';

    let partTraceabilityMachining =
      header?.partTraceabilityMachining || '';

    const signProduction =
      signatures?.shiftSupervisorProduction ||
      signatures?.shiftOfficerSign?.shift1 ||
      '';

    const signQc =
      signatures?.shiftSupervisorQuality ||
      'Pending';

    const selectedPeFromShift =
      signatures?.sectionInchargeSign?.shift1 ||
      signatures?.sectionInchargeSign?.shift2 ||
      signatures?.sectionInchargeSign?.shift3 ||
      '';

    const effectiveAssignedPe =
      assignedPe ||
      header?.assignedPe ||
      (
        selectedPeFromShift &&
          !selectedPeFromShift.startsWith('Approved') &&
          selectedPeFromShift !== 'Pending'
          ? selectedPeFromShift
          : ''
      );

    let signPe =
      signatures?.productionEngineer || '';

    if (
      !signPe ||
      signPe === '' ||
      signPe === 'Pending'
    ) {
      if (
        selectedPeFromShift &&
        selectedPeFromShift.startsWith('Approved')
      ) {
        signPe = selectedPeFromShift;
      } else {
        signPe = 'Pending';
      }
    }

    const signHof =
      signatures?.hofProduction ||
      'Pending';

    const effectiveAssignedQc =
      assignedQc ||
      header?.assignedQc ||
      '';

    const effectiveAssignedHof =
      assignedHof ||
      header?.assignedHof ||
      '';

    transaction =
      new sql.Transaction();

    await transaction.begin();

    if (
      !partTraceabilityMachining.trim() &&
      lineColumns[0]?.lineCode
    ) {
      partTraceabilityMachining =
        await generatePartTraceability(
          transaction,
          lineColumns[0].lineCode,
          reportDate,
          'I'
        );
    }

    // ========================================================
    // DELETE PREVIOUS UNVERIFIED DRAFT ROWS
    // ========================================================
    const delReq =
      new sql.Request(transaction);

    delReq.input(
      'machineShop',
      sql.Int,
      shopId
    );

    delReq.input(
      'reportDate',
      sql.NVarChar(50),
      reportDate
    );

    await delReq.query(`
      DELETE FROM DailyProductionIdleTimeReport
      WHERE machineShop = @machineShop
        AND CONVERT(date, reportDate) =
            CONVERT(date, @reportDate)
        AND (
          Sign_SupervisorQuality IS NULL
          OR Sign_SupervisorQuality = ''
          OR Sign_SupervisorQuality = 'Pending'

          OR Sign_ProductionEngineer IS NULL
          OR Sign_ProductionEngineer = ''
          OR Sign_ProductionEngineer = 'Pending'

          OR Sign_HOFProduction IS NULL
          OR Sign_HOFProduction = ''
          OR Sign_HOFProduction = 'Pending'
        )
    `);

    // ========================================================
    // INSERT ONE ROW FOR EVERY LINE COLUMN
    // ========================================================
    for (const col of lineColumns) {

      const reqInput =
        new sql.Request(transaction);

      reqInput.input(
        'MachineShop',
        sql.Int,
        shopId
      );

      reqInput.input(
        'ReportDate',
        sql.NVarChar(50),
        reportDate
      );

      reqInput.input(
        'LineCode',
        sql.NVarChar(50),
        col.lineCode ||
        header?.lineCode ||
        ''
      );

      reqInput.input(
        'PartName',
        sql.NVarChar(100),
        col.partName ||
        header?.partName ||
        ''
      );

      reqInput.input(
        'BrakeType',
        sql.NVarChar(50),
        col.brakeType || ''
      );

      reqInput.input(
        'PartTraceabilityMachining',
        sql.NVarChar(100),
        partTraceabilityMachining
      );

      reqInput.input(
        'ShiftInchargeName',
        sql.NVarChar(100),
        shiftInchargeName
      );

      // ======================================================
      // CAPACITY
      // ======================================================
      reqInput.input(
        'Capacity_Shift1',
        sql.Int,
        col.capacity?.shift1 !== '' &&
          col.capacity?.shift1 != null
          ? parseInt(col.capacity.shift1, 10)
          : null
      );

      reqInput.input(
        'Capacity_Shift2',
        sql.Int,
        col.capacity?.shift2 !== '' &&
          col.capacity?.shift2 != null
          ? parseInt(col.capacity.shift2, 10)
          : null
      );

      reqInput.input(
        'Capacity_Shift3',
        sql.Int,
        col.capacity?.shift3 !== '' &&
          col.capacity?.shift3 != null
          ? parseInt(col.capacity.shift3, 10)
          : null
      );

      // ======================================================
      // ACTUAL PRODUCTION LH
      // ======================================================
      reqInput.input(
        'ActualProd_LH_Shift1',
        sql.Int,
        col.actualProd?.lh?.shift1 !== '' &&
          col.actualProd?.lh?.shift1 != null
          ? parseInt(
            col.actualProd.lh.shift1,
            10
          )
          : null
      );

      reqInput.input(
        'ActualProd_LH_Shift2',
        sql.Int,
        col.actualProd?.lh?.shift2 !== '' &&
          col.actualProd?.lh?.shift2 != null
          ? parseInt(
            col.actualProd.lh.shift2,
            10
          )
          : null
      );

      reqInput.input(
        'ActualProd_LH_Shift3',
        sql.Int,
        col.actualProd?.lh?.shift3 !== '' &&
          col.actualProd?.lh?.shift3 != null
          ? parseInt(
            col.actualProd.lh.shift3,
            10
          )
          : null
      );

      // ======================================================
      // ACTUAL PRODUCTION RH
      // ======================================================
      reqInput.input(
        'ActualProd_RH_Shift1',
        sql.Int,
        col.actualProd?.rh?.shift1 !== '' &&
          col.actualProd?.rh?.shift1 != null
          ? parseInt(
            col.actualProd.rh.shift1,
            10
          )
          : null
      );

      reqInput.input(
        'ActualProd_RH_Shift2',
        sql.Int,
        col.actualProd?.rh?.shift2 !== '' &&
          col.actualProd?.rh?.shift2 != null
          ? parseInt(
            col.actualProd.rh.shift2,
            10
          )
          : null
      );

      reqInput.input(
        'ActualProd_RH_Shift3',
        sql.Int,
        col.actualProd?.rh?.shift3 !== '' &&
          col.actualProd?.rh?.shift3 != null
          ? parseInt(
            col.actualProd.rh.shift3,
            10
          )
          : null
      );

      // ======================================================
      // MANPOWER
      // ======================================================
      reqInput.input(
        'Manpower_Shift1',
        sql.Int,
        col.manpower?.shift1 !== '' &&
          col.manpower?.shift1 != null
          ? parseInt(
            col.manpower.shift1,
            10
          )
          : null
      );

      reqInput.input(
        'Manpower_Shift2',
        sql.Int,
        col.manpower?.shift2 !== '' &&
          col.manpower?.shift2 != null
          ? parseInt(
            col.manpower.shift2,
            10
          )
          : null
      );

      reqInput.input(
        'Manpower_Shift3',
        sql.Int,
        col.manpower?.shift3 !== '' &&
          col.manpower?.shift3 != null
          ? parseInt(
            col.manpower.shift3,
            10
          )
          : null
      );

      // ======================================================
      // LOSSES 1-13
      // ======================================================
      for (let i = 1; i <= 13; i++) {

        const loss =
          col.losses?.[`loss_${i}`];

        reqInput.input(
          `Loss${i}_Shift1`,
          sql.Float,
          loss?.shift1 !== '' &&
            loss?.shift1 != null
            ? parseFloat(loss.shift1)
            : null
        );

        reqInput.input(
          `Loss${i}_Shift2`,
          sql.Float,
          loss?.shift2 !== '' &&
            loss?.shift2 != null
            ? parseFloat(loss.shift2)
            : null
        );

        reqInput.input(
          `Loss${i}_Shift3`,
          sql.Float,
          loss?.shift3 !== '' &&
            loss?.shift3 != null
            ? parseFloat(loss.shift3)
            : null
        );
      }

      // ======================================================
      // SECTION INCHARGE / PE
      // ======================================================
      const secInchargeVal =
        (
          signPe &&
          !signPe.includes('Pending') &&
          signPe !== ''
        )
          ? `Approved (${signPe
            .replace('Approved (', '')
            .replace(')', '')})`
          : (
            effectiveAssignedPe
              ? `Pending [${effectiveAssignedPe}]`
              : 'Pending'
          );

      reqInput.input(
        'SecInchargeSign_Shift1',
        sql.NVarChar(100),
        secInchargeVal
      );

      reqInput.input(
        'SecInchargeSign_Shift2',
        sql.NVarChar(100),
        secInchargeVal
      );

      reqInput.input(
        'SecInchargeSign_Shift3',
        sql.NVarChar(100),
        secInchargeVal
      );

      // ======================================================
      // SHIFT OFFICER
      // ======================================================
      reqInput.input(
        'ShiftOfficerSign_Shift1',
        sql.NVarChar(100),
        signatures?.shiftOfficerSign?.shift1 ||
        signProduction
      );

      reqInput.input(
        'ShiftOfficerSign_Shift2',
        sql.NVarChar(100),
        signatures?.shiftOfficerSign?.shift2 ||
        signProduction
      );

      reqInput.input(
        'ShiftOfficerSign_Shift3',
        sql.NVarChar(100),
        signatures?.shiftOfficerSign?.shift3 ||
        signProduction
      );

      // ======================================================
      // APPROVAL SIGNATURES
      // ======================================================
      reqInput.input(
        'Sign_SupervisorProduction',
        sql.NVarChar(100),
        signProduction
      );

      reqInput.input(
        'Sign_SupervisorQuality',
        sql.NVarChar(100),
        signQc
      );

      reqInput.input(
        'Sign_ProductionEngineer',
        sql.NVarChar(100),
        signPe
      );

      reqInput.input(
        'Sign_HOFProduction',
        sql.NVarChar(100),
        signHof
      );

      // ======================================================
      // ASSIGNED USERS
      // ======================================================
      reqInput.input(
        'AssignedQc',
        sql.NVarChar(100),
        effectiveAssignedQc
      );

      reqInput.input(
        'AssignedPe',
        sql.NVarChar(100),
        effectiveAssignedPe
      );

      reqInput.input(
        'AssignedHof',
        sql.NVarChar(100),
        effectiveAssignedHof
      );

      // ======================================================
      // INSERT
      // ======================================================
      await reqInput.query(`
        INSERT INTO DailyProductionIdleTimeReport (
          MachineShop,
          ReportDate,
          LineCode,
          PartName,
          BrakeType,
          PartTraceabilityMachining,
          ShiftInchargeName,

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

          Sign_SupervisorProduction,
          Sign_SupervisorQuality,
          Sign_ProductionEngineer,
          Sign_HOFProduction,

          assignedQc,
          assignedPe,
          assignedHof
        )
        VALUES (
          @MachineShop,
          CONVERT(date, @ReportDate),
          @LineCode,
          @PartName,
          @BrakeType,
          @PartTraceabilityMachining,
          @ShiftInchargeName,

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

          @Sign_SupervisorProduction,
          @Sign_SupervisorQuality,
          @Sign_ProductionEngineer,
          @Sign_HOFProduction,

          @AssignedQc,
          @AssignedPe,
          @AssignedHof
        )
      `);
    }

    await transaction.commit();

    return res.status(201).json({
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
      } catch (e) { }
    }

    return res.status(500).json({
      error:
        err?.message ||
        'Failed to save Idle Time Report'
    });
  }
};


// ============================================================
// 10. GET QC PENDING IDLE TIME REPORTS
// ============================================================
const getQcIdleTimeReports = async (req, res) => {
  try {
    const { name } = req.params;
    const shopId = req.query.shopId;

    const request = new sql.Request();

    request.input(
      'qcName',
      sql.NVarChar(100),
      String(name || '').trim()
    );

    let shopFilter = '';

    if (shopId) {
      request.input(
        'machineShop',
        sql.Int,
        parseInt(shopId, 10)
      );

      shopFilter =
        ' AND machineShop = @machineShop';
    }

    const result =
      await request.query(`
        SELECT
          MIN(id) AS id,
          machineShop,
          lineCode,
          MAX(partName) AS partName,
          FORMAT(reportDate, 'yyyy-MM-dd') AS reportDate,
          MAX(shiftInchargeName) AS shiftInchargeName,
          MAX(Sign_SupervisorQuality) AS verifiedByQcSignature,
          MAX(Sign_ProductionEngineer) AS peSignature,
          MAX(Sign_HOFProduction) AS hofSignature,
          'Pending' AS status
        FROM DailyProductionIdleTimeReport
        WHERE (
          Sign_SupervisorQuality IS NULL
          OR Sign_SupervisorQuality = ''
          OR Sign_SupervisorQuality = 'Pending'
        )
        ${shopFilter}
        GROUP BY
          machineShop,
          lineCode,
          reportDate
        ORDER BY
          reportDate DESC,
          MIN(id) DESC
      `);

    return res.status(200).json(
      result.recordset
    );

  } catch (err) {

    console.error(
      'QC Idle Time Dashboard Fetch Error:',
      err
    );

    return res.status(500).json({
      message: 'DB error'
    });
  }
};


// ============================================================
// 11. POST QC APPROVAL SIGNATURE
// ============================================================
const signQcIdleTimeApproval = async (req, res) => {
  try {

    const {
      lineCode,
      date,
      machineShop,
      signature,
      qcUsername
    } = req.body;

    if (!date) {
      return res.status(400).json({
        message: 'Missing date'
      });
    }

    const signVal =
      signature ||
      qcUsername ||
      'Approved';

    let cleanDate = date;

    if (date && date.includes('/')) {

      const parts = date.split('/');

      if (parts.length === 3) {
        cleanDate =
          `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }

    } else if (date && date.includes('T')) {

      cleanDate = date.split('T')[0];

    }

    const request =
      new sql.Request();

    request.input(
      'reportDate',
      sql.NVarChar(50),
      cleanDate
    );

    request.input(
      'signature',
      sql.NVarChar(100),
      signVal
    );

    let lineFilter = '';

    if (lineCode) {

      request.input(
        'lineCode',
        sql.NVarChar(50),
        lineCode
      );

      lineFilter =
        ' AND lineCode = @lineCode';
    }

    let shopFilter = '';

    if (machineShop) {

      request.input(
        'machineShop',
        sql.Int,
        parseInt(machineShop, 10)
      );

      shopFilter =
        ' AND machineShop = @machineShop';
    }

    const result =
      await request.query(`
        UPDATE DailyProductionIdleTimeReport
        SET Sign_SupervisorQuality = @signature
        WHERE CONVERT(date, reportDate) =
              CONVERT(date, @reportDate)
        AND (
          Sign_SupervisorQuality IS NULL
          OR Sign_SupervisorQuality = ''
          OR Sign_SupervisorQuality = 'Pending'
        )
        ${lineFilter}
        ${shopFilter}
      `);

    if (!result.rowsAffected[0]) {

      return res.status(404).json({
        message:
          'No pending records found to approve'
      });

    }

    return res.status(200).json({
      success: true,
      message:
        'Daily Production & Idle Time Report approved by QC successfully!'
    });

  } catch (err) {

    console.error(
      'Sign QC Error:',
      err
    );

    return res.status(500).json({
      message:
        'Failed to approve report'
    });
  }
};


// ============================================================
// 12. GET PENDING FOR PRODUCT ENGINEER
// ============================================================
const getPendingPEIdleTimeData = async (req, res) => {
  try {

    const { name } = req.params;
    const shopId = req.query.shopId;

    const request =
      new sql.Request();

    request.input(
      'peName',
      sql.NVarChar(255),
      String(name || '').trim()
    );

    let shopFilter = '';

    if (shopId) {

      request.input(
        'machineShop',
        sql.Int,
        parseInt(shopId, 10)
      );

      shopFilter =
        ' AND machineShop = @machineShop';
    }

    const result =
      await request.query(`
        SELECT
          MIN(id) AS id,
          machineShop,
          lineCode,
          MAX(partName) AS partName,
          FORMAT(reportDate, 'yyyy-MM-dd') AS reportDate,
          MAX(shiftInchargeName) AS shiftInchargeName,
          MAX(Sign_SupervisorQuality) AS verifiedByQcSignature,
          MAX(Sign_ProductionEngineer) AS peSignature,
          MAX(Sign_HOFProduction) AS hofSignature,
          'Pending' AS status
        FROM DailyProductionIdleTimeReport
        WHERE (
          Sign_ProductionEngineer IS NULL
          OR Sign_ProductionEngineer = ''
          OR Sign_ProductionEngineer = 'Pending'
          OR Sign_ProductionEngineer LIKE 'Pending%'
        )
        ${shopFilter}
        GROUP BY
          machineShop,
          lineCode,
          reportDate
        ORDER BY
          reportDate DESC,
          MIN(id) DESC
      `);

    return res.status(200).json(
      result.recordset
    );

  } catch (err) {

    console.error(
      'Error fetching pending PE idle time data:',
      err
    );

    return res.status(500).json({
      error:
        'Failed to fetch pending PE idle time data'
    });
  }
};


// ============================================================
// 13. POST PE SIGN AND APPROVE
// ============================================================
const signPEApproval = async (req, res) => {
  try {

    const {
      lineCode,
      date,
      machineShop,
      signature,
      peUsername
    } = req.body;

    if (!date) {

      return res.status(400).json({
        error:
          'Missing required parameter: date'
      });

    }

    const signVal =
      signature ||
      peUsername ||
      'Approved';

    let cleanDate = date;

    if (date && date.includes('/')) {

      const parts = date.split('/');

      if (parts.length === 3) {
        cleanDate =
          `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }

    } else if (date && date.includes('T')) {

      cleanDate =
        date.split('T')[0];

    }

    const request =
      new sql.Request();

    request
      .input(
        'checkDate',
        sql.NVarChar(50),
        cleanDate
      )
      .input(
        'signature',
        sql.NVarChar(100),
        signVal
      )
      .input(
        'approvedStr',
        sql.NVarChar(255),
        `Approved (${signVal})`
      );

    let lineFilter = '';

    if (lineCode) {

      request.input(
        'lineCode',
        sql.NVarChar(100),
        lineCode
      );

      lineFilter =
        ' AND lineCode = @lineCode';
    }

    let shopFilter = '';

    if (machineShop) {

      request.input(
        'machineShop',
        sql.Int,
        parseInt(machineShop, 10)
      );

      shopFilter =
        ' AND machineShop = @machineShop';
    }

    const result =
      await request.query(`
        UPDATE DailyProductionIdleTimeReport
        SET
          Sign_ProductionEngineer = @signature,
          secInchargeSign_Shift1 = @approvedStr,
          secInchargeSign_Shift2 = @approvedStr,
          secInchargeSign_Shift3 = @approvedStr
        WHERE CONVERT(date, reportDate) =
              CONVERT(date, @checkDate)
        AND (
          Sign_ProductionEngineer IS NULL
          OR Sign_ProductionEngineer = ''
          OR Sign_ProductionEngineer = 'Pending'
          OR Sign_ProductionEngineer LIKE 'Pending%'
        )
        ${lineFilter}
        ${shopFilter}
      `);

    if (!result.rowsAffected[0]) {

      return res.status(404).json({
        message:
          'No pending records found for PE approval'
      });

    }

    return res.status(200).json({
      success: true,
      message:
        'Daily Production & Idle Time Report approved by PE successfully!'
    });

  } catch (err) {

    console.error(
      'Error approving Idle Time Report:',
      err
    );

    return res.status(500).json({
      error:
        'Failed to sign and approve report'
    });
  }
};


// ============================================================
// 14. GET HOF PENDING IDLE TIME REPORTS
// ============================================================
const getHofIdleTimeReports = async (req, res) => {
  try {

    const { name } = req.params;
    const shopId = req.query.shopId;

    const request =
      new sql.Request();

    request.input(
      'hofName',
      sql.NVarChar(100),
      String(name || '').trim()
    );

    let shopFilter = '';

    if (shopId) {

      request.input(
        'machineShop',
        sql.Int,
        parseInt(shopId, 10)
      );

      shopFilter =
        ' AND machineShop = @machineShop';
    }

    const result =
      await request.query(`
        SELECT
          MIN(id) AS id,
          machineShop,
          lineCode,
          MAX(partName) AS partName,
          FORMAT(reportDate, 'yyyy-MM-dd') AS reportDate,
          MAX(shiftInchargeName) AS shiftInchargeName,
          MAX(Sign_SupervisorQuality) AS verifiedByQcSignature,
          MAX(Sign_ProductionEngineer) AS peSignature,
          MAX(Sign_HOFProduction) AS hofSignature,
          'Pending' AS status
        FROM DailyProductionIdleTimeReport
        WHERE (
          Sign_HOFProduction IS NULL
          OR Sign_HOFProduction = ''
          OR Sign_HOFProduction = 'Pending'
        )
        ${shopFilter}
        GROUP BY
          machineShop,
          lineCode,
          reportDate
        ORDER BY
          reportDate DESC,
          MIN(id) DESC
      `);

    return res.status(200).json(
      result.recordset
    );

  } catch (err) {

    console.error(
      'HOF Idle Time Dashboard Fetch Error:',
      err
    );

    return res.status(500).json({
      message: 'DB error'
    });
  }
};


// ============================================================
// 15. POST HOF APPROVAL SIGNATURE
// ============================================================
const signHofIdleTimeApproval = async (req, res) => {
  try {

    const {
      lineCode,
      date,
      machineShop,
      signature,
      hofUsername
    } = req.body;

    if (!date) {

      return res.status(400).json({
        message: 'Missing date'
      });

    }

    const signVal =
      signature ||
      hofUsername ||
      'Approved';

    let cleanDate = date;

    if (date && date.includes('/')) {

      const parts = date.split('/');

      if (parts.length === 3) {
        cleanDate =
          `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }

    } else if (date && date.includes('T')) {

      cleanDate =
        date.split('T')[0];

    }

    const request =
      new sql.Request();

    request.input(
      'reportDate',
      sql.NVarChar(50),
      cleanDate
    );

    request.input(
      'signature',
      sql.NVarChar(100),
      signVal
    );

    let lineFilter = '';

    if (lineCode) {

      request.input(
        'lineCode',
        sql.NVarChar(50),
        lineCode
      );

      lineFilter =
        ' AND lineCode = @lineCode';
    }

    let shopFilter = '';

    if (machineShop) {

      request.input(
        'machineShop',
        sql.Int,
        parseInt(machineShop, 10)
      );

      shopFilter =
        ' AND machineShop = @machineShop';
    }

    const result =
      await request.query(`
        UPDATE DailyProductionIdleTimeReport
        SET Sign_HOFProduction = @signature
        WHERE CONVERT(date, reportDate) =
              CONVERT(date, @reportDate)
        AND (
          Sign_HOFProduction IS NULL
          OR Sign_HOFProduction = ''
          OR Sign_HOFProduction = 'Pending'
        )
        ${lineFilter}
        ${shopFilter}
      `);

    if (!result.rowsAffected[0]) {

      return res.status(404).json({
        message:
          'No pending records found to approve'
      });

    }

    return res.status(200).json({
      success: true,
      message:
        'Daily Production & Idle Time Report approved by HOF successfully!'
    });

  } catch (err) {

    console.error(
      'Sign HOF Error:',
      err
    );

    return res.status(500).json({
      message:
        'Failed to approve report'
    });
  }
};


// ============================================================
// 16. PDF REPORT GENERATOR
// ============================================================
const generateIdleTimeReport = async (req, res) => {
  try {

    const {
      shopId,
      date,
      lineCode
    } = req.query;

    if (!date) {
      return res.status(400).send(
        'Date is required.'
      );
    }

    let cleanDate = date;

    if (date && date.includes('/')) {

      const parts = date.split('/');

      if (parts.length === 3) {
        cleanDate =
          `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }

    } else if (date && date.includes('T')) {

      cleanDate =
        date.split('T')[0];

    }

    const request =
      new sql.Request();

    request.input(
      'reportDate',
      sql.NVarChar(50),
      cleanDate
    );

    let query = `
      SELECT *
      FROM DailyProductionIdleTimeReport
      WHERE CONVERT(date, reportDate) =
            CONVERT(date, @reportDate)
    `;

    if (shopId) {

      request.input(
        'machineShop',
        sql.Int,
        parseInt(shopId, 10)
      );

      query += `
        AND machineShop = @machineShop
      `;
    }

    if (lineCode) {

      request.input(
        'lineCode',
        sql.NVarChar(50),
        lineCode
      );

      query += `
        AND lineCode = @lineCode
      `;
    }

    query += `
      ORDER BY lineCode ASC, id ASC
    `;

    const result =
      await request.query(query);

    const records =
      result.recordset || [];

    if (records.length === 0) {

      return res.status(404).send(
        'No records found for the selected parameters.'
      );

    }

    const first =
      records[0];

    const [
      yy,
      mm,
      dd
    ] = String(cleanDate).split('-');

    const displayDate =
      `${dd}/${mm}/${yy}`;

    const doc =
      new PDFDocument({
        margin: 20,
        size: 'A4',
        layout: 'landscape',
        bufferPages: true,
        autoPageBreak: false
      });

    res.setHeader(
      'Content-Type',
      'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      `inline; filename=Daily_Production_Idle_Time_${cleanDate}.pdf`
    );

    doc.pipe(res);

    const startX = 20;
    const headerY = 20;
    const totalWidth =
      doc.page.width - 40;

    const pageBottom =
      doc.page.height - 20;

    // ========================================================
    // HEADER
    // ========================================================
    doc.lineWidth(1)
      .strokeColor('black');

    doc.rect(
      startX,
      headerY,
      100,
      35
    ).stroke();

    const logoPath =
      path.join(__dirname, 'logo.jpg');

    if (fs.existsSync(logoPath)) {

      doc.image(
        logoPath,
        startX + 10,
        headerY + 5,
        {
          width: 80,
          height: 25
        }
      );

    } else {

      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('black')
        .text(
          'SAKTHI\nAUTO',
          startX,
          headerY + 8,
          {
            width: 100,
            align: 'center'
          }
        );
    }

    doc.rect(
      startX + 100,
      headerY,
      totalWidth - 260,
      35
    ).stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('black')
      .text(
        'DAILY PRODUCTION & IDLE TIME REPORT (MACHINE SHOP)',
        startX + 100,
        headerY + 12,
        {
          width: totalWidth - 260,
          align: 'center'
        }
      );

    const distinctLines =
      [
        ...new Set(
          records
            .map(r => r.lineCode)
            .filter(Boolean)
        )
      ].join(', ');

    doc.rect(
      startX + totalWidth - 160,
      headerY,
      160,
      35
    ).stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('black')
      .text(
        `LINE: ${distinctLines || 'ALL'}`,
        startX + totalWidth - 160,
        headerY + 6,
        {
          width: 160,
          align: 'center'
        }
      );

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('black')
      .text(
        `DATE: ${displayDate} | MS: ${shopId || first.machineShop || 3}`,
        startX + totalWidth - 160,
        headerY + 20,
        {
          width: 160,
          align: 'center'
        }
      );

    const LOSS_REASONS = [
      {
        id: 1,
        category: 'MAN',
        name: 'Want of Man power'
      },
      {
        id: 2,
        category: 'MAN',
        name: 'Efficiency'
      },
      {
        id: 3,
        category: 'MACHINE',
        name: 'M/c Breakdown'
      },
      {
        id: 4,
        category: 'MACHINE',
        name: 'Preventive maintenance'
      },
      {
        id: 5,
        category: 'MATERIAL',
        name: 'Want of load'
      },
      {
        id: 6,
        category: 'MATERIAL',
        name: 'Want of cutting tool'
      },
      {
        id: 7,
        category: 'MATERIAL',
        name: 'Want of jig & fig'
      },
      {
        id: 8,
        category: 'METHOD',
        name: 'Process correction'
      },
      {
        id: 9,
        category: 'METHOD',
        name: 'Casting Adjustment'
      },
      {
        id: 10,
        category: 'MEASUREMENT',
        name: 'Want of inspection Delay'
      },
      {
        id: 11,
        category: 'OTHERS',
        name: 'Tool change'
      },
      {
        id: 12,
        category: 'OTHERS',
        name: 'Want of Power'
      },
      {
        id: 13,
        category: 'OTHERS',
        name: 'Want of schedule'
      }
    ];

    let curY =
      headerY + 42;

    const numCols =
      records.length;

    const colW =
      Math.min(
        130,
        Math.max(
          90,
          (totalWidth - 230) /
          Math.max(1, numCols)
        )
      );

    const descW =
      totalWidth -
      colW * numCols;

    const shiftW =
      colW / 4;

    const rowH = 11.5;
    const fontSize = 6.8;

    const drawCell = (
      x,
      y,
      w,
      h,
      text,
      isBold = false,
      bg = null,
      align = 'center'
    ) => {

      if (bg) {

        doc
          .rect(x, y, w, h)
          .fillAndStroke(
            bg,
            'black'
          );

      } else {

        doc
          .rect(x, y, w, h)
          .stroke();
      }

      doc
        .fillColor('black')
        .font(
          isBold
            ? 'Helvetica-Bold'
            : 'Helvetica'
        )
        .fontSize(fontSize)
        .text(
          String(
            text != null
              ? text
              : '-'
          ),
          x + 2,
          y + 2.5,
          {
            width: w - 4,
            align
          }
        );
    };

    doc
      .lineWidth(0.5)
      .strokeColor('black');

    // ========================================================
    // TABLE HEADERS
    // ========================================================
    drawCell(
      startX,
      curY,
      descW,
      rowH,
      'LINE CODE',
      true,
      '#f0f0f0',
      'left'
    );

    records.forEach(
      (rec, idx) => {

        const x =
          startX +
          descW +
          idx * colW;

        drawCell(
          x,
          curY,
          colW,
          rowH,
          rec.lineCode || '-',
          true,
          '#f0f0f0'
        );
      }
    );

    curY += rowH;

    drawCell(
      startX,
      curY,
      descW,
      rowH,
      'PART NAME',
      true,
      '#ffffff',
      'left'
    );

    records.forEach(
      (rec, idx) => {

        const x =
          startX +
          descW +
          idx * colW;

        drawCell(
          x,
          curY,
          colW,
          rowH,
          rec.partName || '-',
          false,
          '#ffffff'
        );
      }
    );

    curY += rowH;

    drawCell(
      startX,
      curY,
      descW,
      rowH,
      'ABS / NABS',
      true,
      '#ffffff',
      'left'
    );

    records.forEach(
      (rec, idx) => {

        const x =
          startX +
          descW +
          idx * colW;

        drawCell(
          x,
          curY,
          colW,
          rowH,
          rec.brakeType || '-',
          false,
          '#ffffff'
        );
      }
    );

    curY += rowH;

    drawCell(
      startX,
      curY,
      descW,
      rowH,
      'SHIFT DETAILS / PARAMETERS',
      true,
      '#f0f0f0',
      'left'
    );

    records.forEach(
      (rec, idx) => {

        const x =
          startX +
          descW +
          idx * colW;

        ['I', 'II', 'III', 'T']
          .forEach(
            (sh, shIdx) => {

              drawCell(
                x + shIdx * shiftW,
                curY,
                shiftW,
                rowH,
                sh,
                true,
                sh === 'T'
                  ? '#e5e7eb'
                  : '#f9fafb'
              );
            }
          );
      }
    );

    curY += rowH;

    // ========================================================
    // DATA ROW HELPER
    // ========================================================
    const drawShiftDataRow = (
      title,
      getVals,
      isBold = false,
      bgColor = '#ffffff'
    ) => {

      drawCell(
        startX,
        curY,
        descW,
        rowH,
        title,
        isBold,
        bgColor,
        'left'
      );

      records.forEach(
        (rec, idx) => {

          const x =
            startX +
            descW +
            idx * colW;

          const vals =
            getVals(rec);

          const s1 =
            vals[0] != null &&
              vals[0] !== ''
              ? parseFloat(vals[0])
              : 0;

          const s2 =
            vals[1] != null &&
              vals[1] !== ''
              ? parseFloat(vals[1])
              : 0;

          const s3 =
            vals[2] != null &&
              vals[2] !== ''
              ? parseFloat(vals[2])
              : 0;

          const total =
            s1 + s2 + s3;

          [s1, s2, s3, total]
            .forEach(
              (val, shIdx) => {

                const valStr =
                  val !== 0
                    ? String(val)
                    : '-';

                drawCell(
                  x + shIdx * shiftW,
                  curY,
                  shiftW,
                  rowH,
                  valStr,
                  isBold || shIdx === 3,
                  shIdx === 3
                    ? '#e5e7eb'
                    : bgColor
                );
              }
            );
        }
      );

      curY += rowH;
    };

    // ========================================================
    // CAPACITY / PRODUCTION / MANPOWER
    // ========================================================
    drawShiftDataRow(
      'CAPACITY QTY IN SETS',
      r => [
        r.capacity_Shift1,
        r.capacity_Shift2,
        r.capacity_Shift3
      ],
      true,
      '#f3f4f6'
    );

    drawShiftDataRow(
      'ACTUAL PROD QTY (LH)',
      r => [
        r.actualProd_LH_Shift1,
        r.actualProd_LH_Shift2,
        r.actualProd_LH_Shift3
      ]
    );

    drawShiftDataRow(
      'ACTUAL PROD QTY (RH)',
      r => [
        r.actualProd_RH_Shift1,
        r.actualProd_RH_Shift2,
        r.actualProd_RH_Shift3
      ]
    );

    drawShiftDataRow(
      'NO OF MANPOWER (UTILIZED)',
      r => [
        r.manpower_Shift1,
        r.manpower_Shift2,
        r.manpower_Shift3
      ],
      false,
      '#f9fafb'
    );

    // ========================================================
    // LOSSES
    // ========================================================
    LOSS_REASONS.forEach(
      loss => {

        drawShiftDataRow(
          `${loss.id}. [${loss.category}] ${loss.name}`,
          r => [
            r[`loss${loss.id}_Shift1`],
            r[`loss${loss.id}_Shift2`],
            r[`loss${loss.id}_Shift3`]
          ]
        );
      }
    );

    // ========================================================
    // TOTAL LOSS
    // ========================================================
    const calcTotalLossRec =
      (r, shift) => {

        let sum = 0;

        for (let i = 1; i <= 13; i++) {

          sum +=
            r[`loss${i}_Shift${shift}`] ||
            0;
        }

        return sum;
      };

    drawShiftDataRow(
      'TOTAL LOSS (MINS)',
      r => [
        calcTotalLossRec(r, 1),
        calcTotalLossRec(r, 2),
        calcTotalLossRec(r, 3)
      ],
      true,
      '#e5e7eb'
    );

    curY += 8;

    // ========================================================
    // NOTES
    // ========================================================
    if (curY + 70 > pageBottom) {

      doc.addPage();

      curY = 30;
    }

    doc
      .lineWidth(0.5)
      .strokeColor('black');

    doc
      .rect(
        startX,
        curY,
        totalWidth,
        24
      )
      .stroke();

    doc
      .fillColor('black')
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(
        'Notes / Instructions:',
        startX + 5,
        curY + 3
      );

    doc
      .font('Helvetica')
      .fontSize(6.5)
      .text(
        '1. TOOL CHANGE LOSSES TIME ABOVE 20 MINS ONLY MENTION THE LOSS.',
        startX + 5,
        curY + 10
      );

    doc
      .font('Helvetica')
      .fontSize(6.5)
      .text(
        '2. During set-up change, the production and idle time parameters should be verified and recorded.',
        startX + 5,
        curY + 16
      );

    curY += 32;

    // ========================================================
    // SIGNATURES
    // ========================================================
    if (curY + 50 > pageBottom) {

      doc.addPage();

      curY = 30;
    }

    const sigColWidth =
      (totalWidth - 40) / 2;

    const shiftInchargeX =
      startX + 10;

    const peX =
      startX +
      totalWidth / 2 +
      10;

    // Shift Incharge
    doc
      .lineWidth(0.5)
      .strokeColor('black');

    doc
      .fillColor('black')
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text(
        'Shift Incharge / Shift Officer',
        shiftInchargeX,
        curY,
        {
          width: sigColWidth,
          align: 'center'
        }
      );

    doc
      .rect(
        shiftInchargeX,
        curY + 12,
        sigColWidth,
        30
      )
      .stroke();

    const inchargeSig =
      first.Sign_SupervisorProduction ||
      first.shiftOfficerSign_Shift1 ||
      first.shiftInchargeName ||
      'Shift Incharge';

    const cleanIncharge =
      String(inchargeSig)
        .replace('Approved (', '')
        .replace(')', '')
        .trim();

    if (
      cleanIncharge &&
      !cleanIncharge
        .toLowerCase()
        .includes('pending')
    ) {

      doc
        .lineWidth(1.5)
        .strokeColor('#16a34a')
        .moveTo(
          shiftInchargeX + 20,
          curY + 27
        )
        .lineTo(
          shiftInchargeX + 24,
          curY + 32
        )
        .lineTo(
          shiftInchargeX + 30,
          curY + 21
        )
        .stroke();

      doc
        .fillColor('#16a34a')
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(
          `APPROVED (${cleanIncharge.toUpperCase()})`,
          shiftInchargeX + 34,
          curY + 22,
          {
            lineBreak: false
          }
        );

    } else {

      doc
        .fillColor('black')
        .font('Helvetica')
        .fontSize(8.5)
        .text(
          cleanIncharge || '-',
          shiftInchargeX,
          curY + 22,
          {
            width: sigColWidth,
            align: 'center'
          }
        );
    }

    // Product Engineer
    doc
      .strokeColor('black')
      .lineWidth(0.5);

    doc
      .fillColor('black')
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text(
        'Product Engineer',
        peX,
        curY,
        {
          width: sigColWidth,
          align: 'center'
        }
      );

    doc
      .rect(
        peX,
        curY + 12,
        sigColWidth,
        30
      )
      .stroke();

    const peSig =
      first.Sign_ProductionEngineer ||
      first.secInchargeSign_Shift1;

    if (
      peSig &&
      !String(peSig).includes('Pending') &&
      String(peSig).trim() !== ''
    ) {

      const cleanPe =
        String(peSig)
          .replace('Approved (', '')
          .replace(')', '')
          .trim();

      doc
        .lineWidth(1.5)
        .strokeColor('#16a34a')
        .moveTo(
          peX + 20,
          curY + 27
        )
        .lineTo(
          peX + 24,
          curY + 32
        )
        .lineTo(
          peX + 30,
          curY + 21
        )
        .stroke();

      doc
        .fillColor('#16a34a')
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(
          `APPROVED (${cleanPe.toUpperCase()})`,
          peX + 34,
          curY + 22,
          {
            lineBreak: false
          }
        );

    } else {

      doc
        .fillColor('red')
        .font('Helvetica')
        .fontSize(8.5)
        .text(
          'Pending',
          peX,
          curY + 22,
          {
            width: sigColWidth,
            align: 'center'
          }
        );
    }

    doc.end();

  } catch (err) {

    console.error(
      'PDF generation error:',
      err
    );

    if (!res.headersSent) {

      res.status(500).json({
        message:
          'PDF generation failed'
      });

    } else {

      res.end();
    }
  }
};


// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  ensureTableExists,

  getMachineShopDetails,
  getPartQuantities,

  getIncharges,
  getPeIncharges,
  getHofIncharges,

  getPEUsers,

  getPartTraceability,

  getDailyProductionIdleTime,
  saveDailyProductionIdleTime,

  getQcIdleTimeReports,
  signQcIdleTimeApproval,

  getPendingPEIdleTimeData,
  signPEApproval,

  getHofIdleTimeReports,
  signHofIdleTimeApproval,

  generateIdleTimeReport
};

