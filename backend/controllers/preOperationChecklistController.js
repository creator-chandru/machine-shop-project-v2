const sql = require('../db');


// ============================================================
// GET ALL MACHINE SHOP 3 DETAILS
// ============================================================

const getMachineShop3Details = async (req, res) => {
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
      'Error fetching Machine Shop 3 details:',
      err
    );

    res.status(500).json({
      error: 'Failed to fetch Machine Shop 3 details'
    });
  }
};


// ============================================================
// GET MACHINE SHOP 3 DETAILS FOR ONE LINE CODE
// ============================================================

const getMachineShop3LineDetails = async (req, res) => {

  const { lineCode } = req.params;

  try {

    const result = await sql
      .request()
      .input(
        'lineCode',
        sql.NVarChar(50),
        lineCode
      )
      .query(`
        SELECT
          id,
          lineCode,
          partName,
          partNo,
          machineNo,
          machineType
        FROM MachineShop3Details
        WHERE lineCode = @lineCode
        ORDER BY
          partName,
          partNo,
          machineNo
      `);

    res.status(200).json(result.recordset);

  } catch (err) {

    console.error(
      'Error fetching line details:',
      err
    );

    res.status(500).json({
      error: 'Failed to fetch line details'
    });
  }
};


// ============================================================
// SAVE PRE-OPERATION CHECKLIST
// ============================================================

const savePreOperationChecklist = async (req, res) => {

  const {
    header,
    values,
    signatures,
    parameters,
    specifications
  } = req.body;


  let transaction;


  try {

    // ========================================================
    // START TRANSACTION
    // ========================================================

    transaction = new sql.Transaction();

    await transaction.begin();


    // ========================================================
    // HEADER DATA
    // ========================================================

    const machineShop = header.machineShop;
    const lineCode = header.lineCode;
    const partName = header.partName;
    const partNo = header.partNo;
    const month = header.month;
    const machineNo = header.machineNo;
    const opNo = header.opNo;
    const checklistDate = header.date;

    const operatorSignature =
      signatures?.Operator || '';

    const shiftInchargeSignature =
      signatures?.["Shift Incharge"] || '';


    // ========================================================
    // SAVE CHECKLIST PARAMETERS
    // ========================================================

    for (const param of parameters) {

      const specVal =
        specifications?.[param.slNo] || '';


      // ------------------------------------------------------
      // PARAMETERS WITH SUB ROWS
      // ------------------------------------------------------

      if (param.hasSubRows) {

        for (const subRow of param.subRows) {

          const val =
            values?.[param.slNo]?.[subRow] || '';


          await transaction
            .request()

            .input(
              'machineShop',
              sql.Int,
              machineShop
            )

            .input(
              'lineCode',
              sql.NVarChar(50),
              lineCode
            )

            .input(
              'partName',
              sql.NVarChar(200),
              partName
            )

            .input(
              'partNo',
              sql.NVarChar(100),
              partNo
            )

            .input(
              'month',
              sql.NVarChar(20),
              month
            )

            .input(
              'machineNo',
              sql.NVarChar(50),
              machineNo
            )

            .input(
              'opNo',
              sql.NVarChar(50),
              opNo
            )

            .input(
              'checklistDate',
              sql.Date,
              checklistDate
            )

            .input(
              'slNo',
              sql.Int,
              param.slNo
            )

            .input(
              'specification',
              sql.NVarChar(200),
              specVal
            )

            .input(
              'subRow',
              sql.NVarChar(10),
              subRow
            )

            .input(
              'value',
              sql.NVarChar(100),
              val
            )

            .input(
              'operatorSignature',
              sql.NVarChar(100),
              operatorSignature
            )

            .input(
              'shiftInchargeSignature',
              sql.NVarChar(100),
              shiftInchargeSignature
            )

            .query(`
              INSERT INTO PreOperationChecklist
              (
                machineShop,
                lineCode,
                partName,
                partNo,
                month,
                machineNo,
                opNo,
                checklistDate,
                slNo,
                specification,
                subRow,
                value,
                operatorSignature,
                shiftInchargeSignature
              )

              VALUES
              (
                @machineShop,
                @lineCode,
                @partName,
                @partNo,
                @month,
                @machineNo,
                @opNo,
                @checklistDate,
                @slNo,
                @specification,
                @subRow,
                @value,
                @operatorSignature,
                @shiftInchargeSignature
              )
            `);
        }


      // ------------------------------------------------------
      // NORMAL PARAMETERS
      // ------------------------------------------------------

      } else {

        const val =
          values?.[param.slNo] || '';


        await transaction
          .request()

          .input(
            'machineShop',
            sql.Int,
            machineShop
          )

          .input(
            'lineCode',
            sql.NVarChar(50),
            lineCode
          )

          .input(
            'partName',
            sql.NVarChar(200),
            partName
          )

          .input(
            'partNo',
            sql.NVarChar(100),
            partNo
          )

          .input(
            'month',
            sql.NVarChar(20),
            month
          )

          .input(
            'machineNo',
            sql.NVarChar(50),
            machineNo
          )

          .input(
            'opNo',
            sql.NVarChar(50),
            opNo
          )

          .input(
            'checklistDate',
            sql.Date,
            checklistDate
          )

          .input(
            'slNo',
            sql.Int,
            param.slNo
          )

          .input(
            'specification',
            sql.NVarChar(200),
            specVal
          )

          .input(
            'value',
            sql.NVarChar(100),
            val
          )

          .input(
            'operatorSignature',
            sql.NVarChar(100),
            operatorSignature
          )

          .input(
            'shiftInchargeSignature',
            sql.NVarChar(100),
            shiftInchargeSignature
          )

          .query(`
            INSERT INTO PreOperationChecklist
            (
              machineShop,
              lineCode,
              partName,
              partNo,
              month,
              machineNo,
              opNo,
              checklistDate,
              slNo,
              specification,
              value,
              operatorSignature,
              shiftInchargeSignature
            )

            VALUES
            (
              @machineShop,
              @lineCode,
              @partName,
              @partNo,
              @month,
              @machineNo,
              @opNo,
              @checklistDate,
              @slNo,
              @specification,
              @value,
              @operatorSignature,
              @shiftInchargeSignature
            )
          `);
      }
    }


    // ========================================================
    // COMMIT TRANSACTION
    // ========================================================

    await transaction.commit();


    res.status(201).json({
      message: 'Checklist saved successfully'
    });


  } catch (err) {

    console.error(
      'Error saving checklist:',
      err
    );


    // ========================================================
    // ROLLBACK
    // ========================================================

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
      error: 'Failed to save checklist'
    });
  }
};

// ============================================================
// GET LATEST PRE-OPERATION PARAMETERS (SPECIFICATIONS ONLY)
// ============================================================
const getLatestMachineParams = async (req, res) => {
  const { shopId } = req.params;
  const { lineCode, machineNo } = req.query;

  try {
    const request = new sql.Request();
    
    const result = await request
      .input('shopId', sql.Int, shopId)
      .input('lineCode', sql.NVarChar(50), lineCode)
      .input('machineNo', sql.NVarChar(50), machineNo)
      .query(`
        SELECT slNo, specification
        FROM PreOperationChecklist
        WHERE machineShop = @shopId 
          AND lineCode = @lineCode 
          AND machineNo = @machineNo
          AND slNo IN (1, 2, 3, 4)
          AND id IN (
              SELECT MAX(id)
              FROM PreOperationChecklist
              WHERE machineShop = @shopId 
                AND lineCode = @lineCode 
                AND machineNo = @machineNo
              GROUP BY slNo
          )
      `);

    res.status(200).json(result.recordset);
  } catch (err) {
    console.error('Error fetching latest params:', err);
    res.status(500).json({ error: 'Failed to fetch latest parameters' });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getMachineShop3Details,
  getMachineShop3LineDetails,
  savePreOperationChecklist,
  getLatestMachineParams
};
