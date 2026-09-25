const sql = require('../db.js');

const saveErrorProofingChecksheet = async (req, res) => {
    const { header, rows, signatures } = req.body;

    try {
        const transaction = new sql.Transaction();
        await transaction.begin();

        // Get signatures from frontend
        const operatorSignature =
            signatures?.Operator || '';

        const shiftInchargeSignature =
            signatures?.["Shift Incharge"] || '';

        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
            const row = rows[rowIdx];

            await transaction.request()
                .input('machineShop', sql.Int, header.machineShop)
                .input('lineCode', sql.NVarChar, header.lineCode)
                .input('partName', sql.NVarChar, header.partName)
                .input('partNo', sql.NVarChar, header.partNo)
                .input('checkDate', sql.Date, header.date)
                .input('shift', sql.NVarChar, header.shift)
                .input('slNo', sql.Int, rowIdx + 1)
                .input('machineNo', sql.NVarChar, row.machineNo)
                .input('errorProofNo', sql.NVarChar, row.errorProofNo)
                .input('errorProofName', sql.NVarChar, row.errorProofName)
                .input('value', sql.NVarChar, row.value)
                .input('operatorSignature', sql.NVarChar, operatorSignature)
                .input('shiftInchargeSignature', sql.NVarChar, shiftInchargeSignature)
                .query(`
                    INSERT INTO ErrorProofingCheckSheet
                    (
                        machineShop,
                        lineCode,
                        partName,
                        partNo,
                        checkDate,
                        shift,
                        slNo,
                        machineNo,
                        errorProofNo,
                        errorProofName,
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
                        @checkDate,
                        @shift,
                        @slNo,
                        @machineNo,
                        @errorProofNo,
                        @errorProofName,
                        @value,
                        @operatorSignature,
                        @shiftInchargeSignature
                    )
                `);
        }

        await transaction.commit();

        res.status(201).json({
            message: 'CheckSheet saved Successfully!'
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Failed to save checkSheet'
        });
    }
};

module.exports = {
    saveErrorProofingChecksheet
};