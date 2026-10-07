const sql = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/*
============================================================
GET PART NAMES
============================================================

Part Names come directly from:

MachineShop3PartQty
============================================================
*/

const getPartNames = async (req, res) => {
    try {

        const { shopId } = req.params;

        const machineShop = parseInt(shopId, 10);

        if (Number.isNaN(machineShop)) {
            return res.status(400).json({
                message: 'Invalid shopId'
            });
        }

        const pool = await sql.connect();

        const result = await pool
            .request()
            .query(`
                SELECT DISTINCT
                    partName
                FROM M3PartSets
                WHERE partName IS NOT NULL
                  AND LTRIM(RTRIM(partName)) <> ''
                ORDER BY partName ASC
            `);

        console.log(
            `Fetched ${result.recordset.length} part names from MachineShop3PartQty`
        );

        return res.status(200).json(result.recordset);

    } catch (error) {

        console.error(
            'Get Part Names Error:',
            error
        );

        return res.status(500).json({
            message:
                'Failed to fetch part names from MachineShop3PartQty',
            error:
                error.message
        });
    }
};


/*
============================================================
GET EXISTING CORRECTIVE ACTION RECORD
============================================================
*/

const getRecord = async (req, res) => {

    try {

        const {
            machineShop,
            date
        } = req.query;

        if (!machineShop) {
            return res.status(400).json({
                message: 'machineShop is required'
            });
        }

        if (!date) {
            return res.status(400).json({
                message: 'date is required'
            });
        }

        const machineShopNumber =
            parseInt(machineShop, 10);

        if (Number.isNaN(machineShopNumber)) {
            return res.status(400).json({
                message: 'Invalid machineShop'
            });
        }

        const cleanDate =
            String(date).split('T')[0];

        const pool =
            await sql.connect();

        const result =
            await pool
                .request()
                .input(
                    'machineShop',
                    sql.Int,
                    machineShopNumber
                )
                .input(
                    'recordDate',
                    sql.Date,
                    cleanDate
                )
                .query(`
                    SELECT
                        id,
                        machineShop,
                        lineCode,
                        recordDate,
                        partName,
                        problemDescription,
                        problemCategory,
                        quantity,
                        rootCause,
                        correctiveAction,
                        result,
                        operatorSignature,
                        shiftInchargeSignature

                    FROM CorrectiveActionRegister

                    WHERE machineShop = @machineShop
                      AND CAST(recordDate AS DATE) = @recordDate

                    ORDER BY id ASC
                `);

        if (
            !result.recordset ||
            result.recordset.length === 0
        ) {

            return res.status(200).json({
                entries: []
            });
        }

        const entries =
            result.recordset.map(row => ({

                date:
                    row.recordDate
                        ? new Date(row.recordDate)
                            .toISOString()
                            .split('T')[0]
                        : cleanDate,

                partName:
                    row.partName || '',

                problemDescription:
                    row.problemDescription || '',

                problemCategory:
                    row.problemCategory || 'E',

                quantity:
                    row.quantity ?? 1,

                rootCause:
                    row.rootCause || '',

                correctiveAction:
                    row.correctiveAction || '',

                result:
                    row.result || 'OK',

                signature:
                    row.operatorSignature || ''

            }));

        return res.status(200).json({
            entries
        });

    } catch (error) {

        console.error(
            'Get corrective action record error:',
            error
        );

        return res.status(500).json({
            message:
                'Failed to fetch corrective action record',
            error:
                error.message
        });
    }
};


/*
============================================================
GET LINE CODE FOR PART NAME
============================================================

The CorrectiveActionRegister lineCode column is NOT NULL.

Therefore we get lineCode automatically from:

MachineShop3Details

using the selected partName.
============================================================
*/

const getLineCodeForPart = async (
    pool,
    partName
) => {

    if (!partName || !String(partName).trim()) {
        return null;
    }

    const result =
        await pool
            .request()
            .input(
                'partName',
                sql.NVarChar(200),
                String(partName).trim()
            )
            .query(`
                SELECT TOP 1
                    lineCode
                FROM MachineShop3Details
                WHERE partName = @partName
                  AND lineCode IS NOT NULL
                  AND LTRIM(RTRIM(lineCode)) <> ''
                ORDER BY id ASC
            `);

    if (
        !result.recordset ||
        result.recordset.length === 0
    ) {
        return null;
    }

    return result.recordset[0].lineCode;
};


/*
============================================================
SAVE CORRECTIVE ACTION RECORD
============================================================
*/

const saveRecord = async (req, res) => {

    let transaction;

    try {

        console.log(
            'Corrective Action Save Body:',
            JSON.stringify(
                req.body,
                null,
                2
            )
        );

        const machineShop =
            req.body.machineShop ??
            req.body.shopId;

        const recordDate =
            req.body.recordDate ??
            req.body.date;

        const entries =
            req.body.entries ??
            req.body.rows;

        /*
        --------------------------------------------------------
        VALIDATION
        --------------------------------------------------------
        */

        if (
            machineShop === undefined ||
            machineShop === null ||
            machineShop === ''
        ) {

            return res.status(400).json({
                message:
                    'machineShop is required'
            });
        }

        if (!recordDate) {

            return res.status(400).json({
                message:
                    'recordDate is required'
            });
        }

        if (
            !Array.isArray(entries) ||
            entries.length === 0
        ) {

            return res.status(400).json({
                message:
                    'At least one entry is required'
            });
        }

        const machineShopNumber =
            parseInt(
                machineShop,
                10
            );

        if (Number.isNaN(machineShopNumber)) {

            return res.status(400).json({
                message:
                    'Invalid machineShop'
            });
        }

        const cleanDate =
            String(recordDate)
                .split('T')[0];

        const pool =
            await sql.connect();

        /*
        --------------------------------------------------------
        FIRST GET LINE CODES
        --------------------------------------------------------

        We do this BEFORE deleting existing records.

        This prevents losing existing data if a part does not
        have a valid lineCode.
        --------------------------------------------------------
        */

        const preparedEntries = [];

        for (
            let index = 0;
            index < entries.length;
            index++
        ) {

            const entry =
                entries[index];

            const partName =
                typeof entry.partName === 'object'
                    ? entry.partName?.partName || ''
                    : entry.partName || '';

            if (!partName.trim()) {

                return res.status(400).json({
                    message:
                        `Part Name is required for row ${index + 1}`
                });
            }

            /*
            Get lineCode from MachineShop3Details
            */

            const lineCode =
                await getLineCodeForPart(
                    pool,
                    partName
                );

            if (!lineCode) {

                return res.status(400).json({

                    message:
                        `No Line Code found in MachineShop3Details for Part Name: ${partName}`

                });
            }

            preparedEntries.push({

                lineCode,

                partName,

                problemDescription:
                    entry.problemDescription || '',

                problemCategory:
                    entry.problemCategory || 'E',

                quantity:
                    Number(entry.quantity) || 1,

                rootCause:
                    entry.rootCause || '',

                correctiveAction:
                    entry.correctiveAction || '',

                result:
                    entry.result || 'OK',

                operatorSignature:
                    entry.signature ||
                    entry.operatorSignature ||
                    '',

                shiftInchargeSignature:
                    entry.shiftInchargeSignature ||
                    ''

            });
        }

        /*
        --------------------------------------------------------
        START TRANSACTION
        --------------------------------------------------------
        */

        transaction =
            new sql.Transaction(pool);

        await transaction.begin();

        /*
        --------------------------------------------------------
        DELETE OLD RECORDS
        --------------------------------------------------------
        */

        await transaction
            .request()
            .input(
                'machineShop',
                sql.Int,
                machineShopNumber
            )
            .input(
                'recordDate',
                sql.Date,
                cleanDate
            )
            .query(`
                DELETE FROM CorrectiveActionRegister
                WHERE machineShop = @machineShop
                  AND CAST(recordDate AS DATE) = @recordDate
            `);

        /*
        --------------------------------------------------------
        INSERT NEW RECORDS
        --------------------------------------------------------
        */

        for (
            const entry of preparedEntries
        ) {

            await transaction
                .request()

                .input(
                    'machineShop',
                    sql.Int,
                    machineShopNumber
                )

                .input(
                    'lineCode',
                    sql.NVarChar(100),
                    entry.lineCode
                )

                .input(
                    'recordDate',
                    sql.Date,
                    cleanDate
                )

                .input(
                    'partName',
                    sql.NVarChar(200),
                    entry.partName
                )

                .input(
                    'problemDescription',
                    sql.NVarChar(sql.MAX),
                    entry.problemDescription
                )

                .input(
                    'problemCategory',
                    sql.NVarChar(50),
                    entry.problemCategory
                )

                .input(
                    'quantity',
                    sql.Int,
                    entry.quantity
                )

                .input(
                    'rootCause',
                    sql.NVarChar(sql.MAX),
                    entry.rootCause
                )

                .input(
                    'correctiveAction',
                    sql.NVarChar(sql.MAX),
                    entry.correctiveAction
                )

                .input(
                    'result',
                    sql.NVarChar(100),
                    entry.result
                )

                .input(
                    'operatorSignature',
                    sql.NVarChar(255),
                    entry.operatorSignature
                )

                .input(
                    'shiftInchargeSignature',
                    sql.NVarChar(255),
                    entry.shiftInchargeSignature
                )

                .query(`
                    INSERT INTO CorrectiveActionRegister
                    (
                        machineShop,
                        lineCode,
                        recordDate,
                        partName,
                        problemDescription,
                        problemCategory,
                        quantity,
                        rootCause,
                        correctiveAction,
                        result,
                        operatorSignature,
                        shiftInchargeSignature
                    )

                    VALUES
                    (
                        @machineShop,
                        @lineCode,
                        @recordDate,
                        @partName,
                        @problemDescription,
                        @problemCategory,
                        @quantity,
                        @rootCause,
                        @correctiveAction,
                        @result,
                        @operatorSignature,
                        @shiftInchargeSignature
                    )
                `);
        }

        await transaction.commit();

        console.log(
            `Corrective Action Register saved successfully. Shop=${machineShopNumber}, Date=${cleanDate}, Rows=${preparedEntries.length}`
        );

        return res.status(200).json({

            message:
                'Corrective Action Register saved successfully',

            machineShop:
                machineShopNumber,

            recordDate:
                cleanDate,

            rowsSaved:
                preparedEntries.length

        });

    } catch (error) {

        console.error(
            'Save corrective action error:',
            error
        );

        if (transaction) {

            try {
                await transaction.rollback();
            } catch (rollbackError) {

                console.error(
                    'Rollback error:',
                    rollbackError
                );
            }
        }

        return res.status(500).json({

            message:
                'Failed to save corrective action record',

            error:
                error.message

        });
    }
};


/*
============================================================
GENERATE CORRECTIVE ACTION PDF
============================================================

Landscape A4

Same structure/style as the 4M reference PDF.

HOD BLOCK REMOVED.
============================================================
*/

const generatePdfReport = async (
    req,
    res
) => {

    try {

        const {
            shopId,
            date
        } = req.query;

        console.log(
            'PDF Request:',
            {
                shopId,
                date
            }
        );

        if (!shopId) {

            return res.status(400).json({
                message:
                    'shopId is required'
            });
        }

        if (!date) {

            return res.status(400).json({
                message:
                    'date is required'
            });
        }

        const machineShop =
            parseInt(
                shopId,
                10
            );

        if (Number.isNaN(machineShop)) {

            return res.status(400).json({
                message:
                    'Invalid shopId'
            });
        }

        const cleanDate =
            String(date).split('T')[0];

        const pool =
            await sql.connect();

        const result =
            await pool
                .request()

                .input(
                    'machineShop',
                    sql.Int,
                    machineShop
                )

                .input(
                    'recordDate',
                    sql.Date,
                    cleanDate
                )

                .query(`
                    SELECT
                        id,
                        machineShop,
                        lineCode,
                        recordDate,
                        partName,
                        problemDescription,
                        problemCategory,
                        quantity,
                        rootCause,
                        correctiveAction,
                        result,
                        operatorSignature,
                        shiftInchargeSignature

                    FROM CorrectiveActionRegister

                    WHERE machineShop = @machineShop
                      AND CAST(recordDate AS DATE) = @recordDate

                    ORDER BY id ASC
                `);

        const records =
            result.recordset;

        console.log(
            'PDF Records:',
            records.length
        );

        if (
            !records ||
            records.length === 0
        ) {

            return res.status(404).json({
                message:
                    'No corrective action records found'
            });
        }

        /*
        --------------------------------------------------------
        PDF DOCUMENT
        --------------------------------------------------------
        */

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
            `attachment; filename="Corrective_Action_Register_${machineShop}_${cleanDate}.pdf"`
        );

        doc.pipe(res);

        /*
        --------------------------------------------------------
        PAGE DIMENSIONS
        --------------------------------------------------------
        */

        const startX = 20;

        let startY = 20;

        const totalWidth = 800;

        doc
            .lineWidth(0.5)
            .strokeColor('black');

        /*
        --------------------------------------------------------
        HEADER
        --------------------------------------------------------
        */

        const logoBoxWidth = 150;

        const metaBoxWidth = 230;

        const titleBoxWidth =
            totalWidth -
            logoBoxWidth -
            metaBoxWidth;

        const headerHeight = 60;

        /*
        LOGO / COMPANY
        */

        doc
            .rect(
                startX,
                startY,
                logoBoxWidth,
                headerHeight
            )
            .stroke();

        const possibleLogoPaths = [

            path.join(
                __dirname,
                'logo.jpg'
            ),

            path.join(
                __dirname,
                '../logo.jpg'
            ),

            path.join(
                process.cwd(),
                'logo.jpg'
            )

        ];

        const logoPath =
            possibleLogoPaths.find(
                file =>
                    fs.existsSync(file)
            );

        if (logoPath) {

            try {

                doc.image(
                    logoPath,
                    startX + 15,
                    startY + 10,
                    {
                        width: 120,
                        height: 40,
                        fit: [120, 40],
                        align: 'center',
                        valign: 'center'
                    }
                );

            } catch (logoError) {

                console.warn(
                    'Logo could not be loaded:',
                    logoError.message
                );

                doc
                    .font('Helvetica-Bold')
                    .fontSize(12)
                    .fillColor('black')
                    .text(
                        'SAKTHI AUTO',
                        startX,
                        startY + 25,
                        {
                            width: logoBoxWidth,
                            align: 'center'
                        }
                    );
            }

        } else {

            doc
                .font('Helvetica-Bold')
                .fontSize(12)
                .fillColor('black')
                .text(
                    'SAKTHI AUTO',
                    startX,
                    startY + 25,
                    {
                        width: logoBoxWidth,
                        align: 'center'
                    }
                );
        }

        /*
        TITLE
        */

        doc
            .rect(
                startX + logoBoxWidth,
                startY,
                titleBoxWidth,
                headerHeight
            )
            .stroke();

        doc
            .font('Helvetica-Bold')
            .fontSize(15)
            .fillColor('black')
            .text(
                'CORRECTIVE ACTION REGISTER',
                startX + logoBoxWidth,
                startY + 20,
                {
                    width: titleBoxWidth,
                    align: 'center'
                }
            );

        /*
        META
        */

        const metaX =
            startX +
            logoBoxWidth +
            titleBoxWidth;

        doc
            .rect(
                metaX,
                startY,
                metaBoxWidth,
                headerHeight
            )
            .stroke();

        doc
            .moveTo(
                metaX,
                startY + 30
            )
            .lineTo(
                metaX + metaBoxWidth,
                startY + 30
            )
            .stroke();

        doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor('black');

        doc.text(
            'MACHINE SHOP',
            metaX + 8,
            startY + 10
        );

        doc.text(
            `:   ${machineShop}`,
            metaX + 95,
            startY + 10
        );

        doc.text(
            'DATE',
            metaX + 8,
            startY + 40
        );

        doc
            .font('Helvetica')
            .fontSize(8.5)
            .text(
                `:   ${cleanDate}`,
                metaX + 95,
                startY + 40
            );

        startY +=
            headerHeight +
            10;

        /*
        --------------------------------------------------------
        TABLE HEADERS
        --------------------------------------------------------
        */

        const headers = [

            {
                label: 'Date',
                w: 58
            },

            {
                label: 'Line Code',
                w: 62
            },

            {
                label: 'Part Name',
                w: 125
            },

            {
                label: 'Problem Description',
                w: 120
            },

            {
                label: 'Category\n(A/B/C/D/E)',
                w: 55
            },

            {
                label: 'Qty',
                w: 38
            },

            {
                label: 'Root Cause',
                w: 105
            },

            {
                label: 'Corrective Action',
                w: 105
            },

            {
                label: 'Result',
                w: 55
            },

            {
                label: 'Signature',
                w: 77
            }

        ];

        const headerWidth =
            headers.reduce(
                (sum, h) =>
                    sum + h.w,
                0
            );

        /*
        --------------------------------------------------------
        DRAW TABLE HEADER
        --------------------------------------------------------
        */

        const drawHeaders = (
            yPos
        ) => {

            doc
                .rect(
                    startX,
                    yPos,
                    headerWidth,
                    38
                )
                .fillAndStroke(
                    '#e5e7eb',
                    'black'
                );

            let currentX =
                startX;

            doc
                .font('Helvetica-Bold')
                .fontSize(7)
                .fillColor('black');

            headers.forEach(
                header => {

                    doc
                        .rect(
                            currentX,
                            yPos,
                            header.w,
                            38
                        )
                        .stroke();

                    doc.text(
                        header.label,
                        currentX + 2,
                        yPos + 5,
                        {
                            width:
                                header.w - 4,
                            height: 30,
                            align: 'center'
                        }
                    );

                    currentX +=
                        header.w;
                }
            );

            return yPos + 38;
        };

        let currentY =
            drawHeaders(startY);

        /*
        --------------------------------------------------------
        TABLE ROWS
        --------------------------------------------------------
        */

        records.forEach(
            (record) => {

                const rowData = [

                    record.recordDate
                        ? new Date(
                            record.recordDate
                        )
                            .toISOString()
                            .split('T')[0]
                        : '-',

                    record.lineCode || '-',

                    record.partName || '-',

                    record.problemDescription || '-',

                    record.problemCategory || '-',

                    String(
                        record.quantity ??
                        '-'
                    ),

                    record.rootCause || '-',

                    record.correctiveAction || '-',

                    record.result || '-',

                    record.operatorSignature || '-'

                ];

                doc
                    .font('Helvetica')
                    .fontSize(7);

                const textHeights = [

                    doc.heightOfString(
                        String(rowData[2]),
                        {
                            width:
                                headers[2].w - 6
                        }
                    ),

                    doc.heightOfString(
                        String(rowData[3]),
                        {
                            width:
                                headers[3].w - 6
                        }
                    ),

                    doc.heightOfString(
                        String(rowData[6]),
                        {
                            width:
                                headers[6].w - 6
                        }
                    ),

                    doc.heightOfString(
                        String(rowData[7]),
                        {
                            width:
                                headers[7].w - 6
                        }
                    )

                ];

                let rowHeight = 30;

                const maximumTextHeight =
                    Math.max(
                        ...textHeights
                    );

                if (
                    maximumTextHeight + 12 >
                    rowHeight
                ) {

                    rowHeight =
                        maximumTextHeight +
                        12;
                }

                /*
                New page if required.
                */

                if (
                    currentY +
                    rowHeight >
                    doc.page.height - 55
                ) {

                    doc.addPage();

                    currentY = 20;

                    currentY =
                        drawHeaders(
                            currentY
                        );
                }

                let currentX =
                    startX;

                rowData.forEach(
                    (value, index) => {

                        doc
                            .rect(
                                currentX,
                                currentY,
                                headers[index].w,
                                rowHeight
                            )
                            .stroke();

                        /*
                        ------------------------------------------------
                        SIGNATURE COLUMN
                        ------------------------------------------------
                        */

                        if (index === 9) {

                            if (
                                value &&
                                value !== '-'
                            ) {

                                const centerY =
                                    currentY +
                                    rowHeight / 2;

                                doc
                                    .save()
                                    .lineWidth(1.4)
                                    .strokeColor('#16a34a')
                                    .lineCap('round')
                                    .lineJoin('round');

                                doc
                                    .moveTo(
                                        currentX + 8,
                                        centerY
                                    )
                                    .lineTo(
                                        currentX + 12,
                                        centerY + 4
                                    )
                                    .lineTo(
                                        currentX + 19,
                                        centerY - 5
                                    )
                                    .stroke();

                                doc.restore();

                                doc
                                    .font(
                                        'Helvetica-Bold'
                                    )
                                    .fontSize(6.5)
                                    .fillColor(
                                        '#16a34a'
                                    )
                                    .text(
                                        'Approved',
                                        currentX + 21,
                                        centerY - 9,
                                        {
                                            width:
                                                headers[index].w - 24,
                                            align: 'center'
                                        }
                                    );

                                doc
                                    .font(
                                        'Helvetica-Bold'
                                    )
                                    .fontSize(6.5)
                                    .fillColor(
                                        'black'
                                    )
                                    .text(
                                        String(value)
                                            .toUpperCase()
                                            .substring(
                                                0,
                                                14
                                            ),
                                        currentX + 2,
                                        centerY + 2,
                                        {
                                            width:
                                                headers[index].w - 4,
                                            align: 'center'
                                        }
                                    );

                            } else {

                                doc
                                    .font(
                                        'Helvetica'
                                    )
                                    .fontSize(7)
                                    .fillColor(
                                        'black'
                                    )
                                    .text(
                                        '-',
                                        currentX,
                                        currentY +
                                        rowHeight / 2 -
                                        4,
                                        {
                                            width:
                                                headers[index].w,
                                            align: 'center'
                                        }
                                    );
                            }

                        }

                        /*
                        ------------------------------------------------
                        CATEGORY / RESULT
                        ------------------------------------------------
                        */

                        else if (
                            index === 4 ||
                            index === 8
                        ) {

                            doc
                                .font('Helvetica-Bold')
                                .fontSize(7.5)
                                .fillColor('black')
                                .text(
                                    String(value),
                                    currentX,
                                    currentY +
                                    rowHeight / 2 -
                                    4,
                                    {
                                        width:
                                            headers[index].w,
                                        align: 'center'
                                    }
                                );

                        }

                        /*
                        ------------------------------------------------
                        NORMAL CELLS
                        ------------------------------------------------
                        */

                        else {

                            doc
                                .font('Helvetica')
                                .fontSize(7)
                                .fillColor('black');

                            const textHeight =
                                doc.heightOfString(
                                    String(value),
                                    {
                                        width:
                                            headers[index].w - 6
                                    }
                                );

                            doc.text(
                                String(value),
                                currentX + 3,
                                currentY +
                                (
                                    rowHeight -
                                    textHeight
                                ) / 2,
                                {
                                    width:
                                        headers[index].w - 6,

                                    align:
                                        (
                                            index === 2 ||
                                            index === 3 ||
                                            index === 6 ||
                                            index === 7
                                        )
                                            ? 'left'
                                            : 'center'
                                }
                            );
                        }

                        doc.fillColor('black');

                        currentX +=
                            headers[index].w;
                    });

                currentY +=
                    rowHeight;
            }
        );

        /*
        --------------------------------------------------------
        FOOTER
        --------------------------------------------------------
        */

        currentY += 10;

        if (
            currentY + 45 >
            doc.page.height - 20
        ) {

            doc.addPage();

            currentY = 20;
        }

        doc
            .lineWidth(0.5)
            .strokeColor('black');

        /*
        --------------------------------------------------------
        FORM INFORMATION ONLY
        --------------------------------------------------------
        */

        doc
            .rect(
                startX,
                currentY,
                totalWidth,
                40
            )
            .stroke();

        doc
            .font('Helvetica-Bold')
            .fontSize(8)
            .fillColor('black')
            .text(
                'QF/08/MRO-04, Rev.No: 03, 20.08.2024',
                startX + 10,
                currentY + 16
            );

        /*
        --------------------------------------------------------
        END PDF
        --------------------------------------------------------
        */

        doc.end();

    } catch (error) {

        console.error(
            'Corrective Action PDF generation error:',
            error
        );

        if (!res.headersSent) {

            return res.status(500).json({

                message:
                    'PDF generation failed',

                error:
                    error.message

            });
        }
    }
};


/*
============================================================
EXPORTS
============================================================
*/

module.exports = {

    getPartNames,

    getRecord,

    saveRecord,

    generatePdfReport

};