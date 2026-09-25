const sql = require('../db.js');

const saveFourMChangeMonitoring = async (req, res) => {

    const { headerInfo, rows, hodSign } = req.body;

    try {

        const transaction = new sql.Transaction();
        await transaction.begin();

        // Insert each row
        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {

            const row = rows[rowIdx];

            await transaction.request()
                .input('line', sql.NVarChar, headerInfo.line)
                .input('partName', sql.NVarChar, headerInfo.partName)
                .input('dateShift', sql.NVarChar, row.dateShift)
                .input('mcNo', sql.NVarChar, row.mcNo)
                .input('typeOf4M', sql.NVarChar, row.typeOf4M)
                .input('description', sql.NVarChar, row.description)
                .input('firstPart', sql.NVarChar, row.firstPart)
                .input('lastPart', sql.NVarChar, row.lastPart)
                .input('inspectionFrequency', sql.NVarChar, row.inspectionFrequency)
                .input('retroChecking', sql.NVarChar, row.retroChecking)
                .input('quarantine', sql.NVarChar, row.quarantine)
                .input('partIdentification', sql.NVarChar, row.partIdentification)
                .input('internalCommunication', sql.NVarChar, row.internalCommunication)
                .input('inchargeSign', sql.NVarChar, row.inchargeSign)
                .input('slNo', sql.Int, rowIdx + 1)

                .query(`
                    INSERT INTO FourMChangeMonitoring
                    (
                        line,
                        partName,
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
                        slNo
                    )
                    VALUES
                    (
                        @line,
                        @partName,
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
                        @slNo
                    )
                `);
        }

        // Insert HOD signature
        await transaction.request()
            .input('line', sql.NVarChar, headerInfo.line)
            .input('partName', sql.NVarChar, headerInfo.partName)
            .input('signatureValue', sql.NVarChar, hodSign)
            .query(`
                INSERT INTO FourMChangeMonitoringSignatures
                (
                    line,
                    partName,
                    signatureValue
                )
                VALUES
                (
                    @line,
                    @partName,
                    @signatureValue
                )
            `);

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
    saveFourMChangeMonitoring
};