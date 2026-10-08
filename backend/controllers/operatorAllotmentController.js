const sql = require('../db'); 
const PDFDocument = require('pdfkit'); 
const fs = require('fs');
const path = require('path');

// ============================================================ 
// HELPER FUNCTIONS 
// ============================================================ 
const cleanDateStr = (date) => {
  if (!date) return null;
  let d = String(date);
  if (d.includes('/')) {
    const p = d.split('/');
    if (p.length === 3) d = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  } else if (d.includes('T')) {
    d = d.split('T')[0];
  }
  return d;
};

const formatDate = (value) => { 
    if (!value) return ''; 
    const date = new Date(value); 
    if (Number.isNaN(date.getTime())) return String(value); 
    const day = String(date.getDate()).padStart(2, '0'); 
    const month = String(date.getMonth() + 1).padStart(2, '0'); 
    return `${day}/${month}/${date.getFullYear()}`; 
}; 

const isPendingSign = (s) => !s || String(s).trim() === '' || String(s).startsWith('Pending');

// ============================================================ 
// GET LINE CODES 
// ============================================================ 
const getOperatorAllotmentLines = async (req, res) => { 
    try { 
        const result = await sql.query` 
            SELECT DISTINCT 
                LTRIM(RTRIM(lineCode)) AS lineCode 
            FROM dbo.MachineShop3Details 
            WHERE lineCode IS NOT NULL 
              AND LTRIM(RTRIM(lineCode)) <> '' 
            ORDER BY LTRIM(RTRIM(lineCode)) ASC 
        `; 
 
        const lineCodes = result.recordset.map(row => row.lineCode); 

        return res.status(200).json({ 
            lines: lineCodes, 
            lineCodes: lineCodes 
        }); 
 
    } catch (error) { 
        console.error('getOperatorAllotmentLines:', error); 
        return res.status(500).json({ 
            error: 'Failed to fetch Line Codes' 
        }); 
    } 
}; 

// ============================================================ 
// GET PRODUCT ENGINEERS 
// ============================================================ 
const getProductManagers = async (req, res) => { 
    try { 
        const peRes = await sql.query` 
            SELECT 
                username AS name, 
                username, 
                employeeId 
            FROM dbo.MachineShopUsers 
            WHERE LOWER(LTRIM(RTRIM(role))) IN ('productengineer', 'productionengineer', 'pe') 
            ORDER BY username ASC 
        `; 
 
        const list = peRes.recordset || []; 

        return res.status(200).json({ 
            peList: list, 
            productManagers: list, 
            productEngineers: list 
        }); 
 
    } catch (error) { 
        console.error('getProductManagers:', error); 
        return res.status(500).json({ 
            error: 'Failed to fetch PE list' 
        }); 
    } 
}; 

// ============================================================ 
// GET OPERATOR ALLOTMENT BY DATE & LINE CODE
// ============================================================ 
const getOperatorAllotment = async (req, res) => {
    try {
        const { date, lineCode } = req.query;

        if (!date || !lineCode) {
            return res.status(400).json({
                error: 'Date and Line Code are required'
            });
        }

        const cleanDate = cleanDateStr(date);

        const result = await sql.query`
            SELECT TOP 1 *
            FROM dbo.OperatorAllotmentSheet
            WHERE recordDate = CONVERT(date, ${cleanDate})
              AND lineCode = ${lineCode}
            ORDER BY id DESC
        `;

        if (result.recordset.length === 0) {
            return res.status(200).json({
                exists: false,
                data: null
            });
        }

        const row = result.recordset[0];
        return res.status(200).json({
            exists: true,
            data: {
                ...row,
                status: isPendingSign(row.peStatus) ? 'Pending' : 'Approved'
            }
        });

    } catch (error) {
        console.error('getOperatorAllotment:', error);
        return res.status(500).json({
            error: 'Failed to fetch record'
        });
    }
};

// ============================================================ 
// SAVE OPERATOR ALLOTMENT 
// ============================================================ 
const saveOperatorAllotment = async (req, res) => { 
    try { 
        const { 
            lineCode, 
            recordDate, 
            shift, 
            oprNo1, 
            oprNo2, 
            oprNo3, 
            oprNo4, 
            oprNo5, 
            proQty, 
            incNo, 
            productEngineer 
        } = req.body; 

        if (!lineCode) return res.status(400).json({ error: 'Line Code is required' }); 
        if (!recordDate) return res.status(400).json({ error: 'Date is required' }); 
        if (!shift) return res.status(400).json({ error: 'Shift is required' }); 
        if (!['1', '2', '3'].includes(String(shift))) return res.status(400).json({ error: 'Invalid Shift' }); 
        if (!productEngineer) return res.status(400).json({ error: 'Product Engineer is required' }); 

        const cleanDate = cleanDateStr(recordDate);

        const existing = await sql.query` 
            SELECT TOP 1 
                id, 
                peStatus 
            FROM dbo.OperatorAllotmentSheet 
            WHERE lineCode = ${lineCode} 
              AND recordDate = CONVERT(date, ${cleanDate}) 
            ORDER BY id DESC 
        `; 

        if ( 
            existing.recordset.length > 0 && 
            existing.recordset[0].peStatus === 'Approved' 
        ) { 
            return res.status(400).json({ 
                error: 'This record has already been approved by Product Engineer and cannot be edited.' 
            }); 
        } 

        if (existing.recordset.length > 0) { 
            const id = existing.recordset[0].id; 
 
            await sql.query` 
                UPDATE dbo.OperatorAllotmentSheet 
                SET 
                    shift = ${shift}, 
                    oprNo1 = ${oprNo1 || null}, 
                    oprNo2 = ${oprNo2 || null}, 
                    oprNo3 = ${oprNo3 || null}, 
                    oprNo4 = ${oprNo4 || null}, 
                    oprNo5 = ${oprNo5 || null}, 
                    proQty = ${proQty || null}, 
                    incNo = ${incNo || null}, 
                    productEngineer = ${productEngineer}, 
                    peStatus = 'Pending', 
                    peSignature = NULL, 
                    peApprovedAt = NULL, 
                    updatedAt = GETDATE() 
                WHERE id = ${id} 
            `; 
 
            return res.status(200).json({ 
                message: 'Operator Allotment updated successfully and submitted for Product Engineer verification', 
                id, 
                peStatus: 'Pending' 
            }); 
        } 

        const result = await sql.query` 
            INSERT INTO dbo.OperatorAllotmentSheet 
            ( 
                lineCode, recordDate, shift, 
                oprNo1, oprNo2, oprNo3, oprNo4, oprNo5, 
                proQty, incNo, productEngineer, 
                peStatus, createdAt, updatedAt 
            ) 
            OUTPUT INSERTED.id 
            VALUES 
            ( 
                ${lineCode}, CONVERT(date, ${cleanDate}), ${shift}, 
                ${oprNo1 || null}, ${oprNo2 || null}, ${oprNo3 || null}, ${oprNo4 || null}, ${oprNo5 || null}, 
                ${proQty || null}, ${incNo || null}, ${productEngineer}, 
                'Pending', GETDATE(), GETDATE() 
            ) 
        `; 
 
        return res.status(201).json({ 
            message: 'Operator Allotment saved successfully and submitted to Product Engineer', 
            id: result.recordset[0].id, 
            peStatus: 'Pending' 
        }); 

    } catch (error) { 
        console.error('saveOperatorAllotment:', error); 
        return res.status(500).json({ 
            error: 'Failed to save Operator Allotment' 
        }); 
    } 
}; 

// ============================================================ 
// GET PENDING RECORDS FOR PRODUCT ENGINEER
// ============================================================ 
const getPendingPEOperatorAllotment = async (req, res) => { 
    try { 
        const { name } = req.params;
        const targetPE = name || req.query.peUsername;

        let result;
        if (targetPE && targetPE !== 'all') {
            result = await sql.query`
                SELECT 
                    id,
                    lineCode,
                    shift,
                    productEngineer,
                    FORMAT(recordDate, 'yyyy-MM-dd') AS recordDate,
                    'Pending' AS status
                FROM dbo.OperatorAllotmentSheet 
                WHERE (peStatus IS NULL OR peStatus = '' OR peStatus = 'Pending') 
                  AND LOWER(LTRIM(RTRIM(productEngineer))) = LOWER(LTRIM(RTRIM(${targetPE})))
                ORDER BY recordDate DESC, id DESC 
            `;
        } else {
            result = await sql.query`
                SELECT 
                    id,
                    lineCode,
                    shift,
                    productEngineer,
                    FORMAT(recordDate, 'yyyy-MM-dd') AS recordDate,
                    'Pending' AS status
                FROM dbo.OperatorAllotmentSheet 
                WHERE (peStatus IS NULL OR peStatus = '' OR peStatus = 'Pending')
                ORDER BY recordDate DESC, id DESC 
            `;
        }

        return res.status(200).json({ 
            records: result.recordset || [] 
        }); 

    } catch (error) { 
        console.error('getPendingPEOperatorAllotment:', error); 
        return res.status(500).json({ 
            error: 'Failed to fetch pending Operator Allotments' 
        }); 
    } 
}; 

// ============================================================ 
// PRODUCT ENGINEER APPROVAL
// ============================================================ 
const signPEOperatorAllotment = async (req, res) => { 
    try { 
        const { id, peSignature } = req.body; 

        if (!id) return res.status(400).json({ error: 'Record ID is required' }); 
        if (!peSignature) return res.status(400).json({ error: 'PE signature is required' }); 

        const approvedStr = `Approved (${peSignature})`;

        const result = await sql.query` 
            UPDATE dbo.OperatorAllotmentSheet 
            SET 
                peSignature = ${approvedStr}, 
                peStatus = 'Approved', 
                peApprovedAt = GETDATE(), 
                updatedAt = GETDATE() 
            WHERE id = ${id} AND (peStatus IS NULL OR peStatus = '' OR peStatus = 'Pending')
        `; 

        if (result.rowsAffected[0] === 0) { 
            return res.status(404).json({ 
                error: 'Record not found or already approved' 
            }); 
        } 

        return res.status(200).json({ 
            success: true,
            message: 'Operator Allotment Sheet verified and approved successfully!', 
            peStatus: 'Approved' 
        }); 

    } catch (error) { 
        console.error('signPEOperatorAllotment:', error); 
        return res.status(500).json({ 
            error: 'Failed to approve Operator Allotment' 
        }); 
    } 
}; 

// ============================================================ 
// GENERATE PDF REPORT (MODIFIED TO MATCH THE REFERENCE STYLE)
// ============================================================ 
const generateOperatorAllotmentReport = async (req, res) => { 
    try { 
        const { date, lineCode } = req.query; 

        if (!date || !lineCode) { 
            return res.status(400).send('Date and Line Code are required.'); 
        } 

        const cleanDate = cleanDateStr(date);

        const result = await sql.query` 
            SELECT TOP 1 * 
            FROM dbo.OperatorAllotmentSheet 
            WHERE recordDate = CONVERT(date, ${cleanDate}) 
              AND lineCode = ${lineCode} 
            ORDER BY id DESC
        `; 

        if (result.recordset.length === 0) { 
            return res.status(404).send('No Operator Allotment found for this date.'); 
        } 

        const row = result.recordset[0]; 
        const displayDate = formatDate(row.recordDate);

        const doc = new PDFDocument({ 
            margin: 20, 
            size: 'A4', 
            layout: 'landscape', 
            bufferPages: true, 
            autoPageBreak: false 
        }); 

        res.setHeader('Content-Type', 'application/pdf'); 
        res.setHeader('Content-Disposition', `inline; filename="Operator_Allotment_${lineCode}_${cleanDate}.pdf"`); 

        doc.pipe(res); 

        const startX = 20; 
        const headerY = 20; 
        const totalWidth = doc.page.width - 40; 

        // ---------------- HEADER ---------------- 
        doc.lineWidth(1).strokeColor('black'); 
        doc.rect(startX, headerY, 100, 35).stroke(); 

        const logoPath = path.join(__dirname, 'logo.jpg'); 
        if (fs.existsSync(logoPath)) { 
            doc.image(logoPath, startX + 10, headerY + 5, { width: 80, height: 25 }); 
        } else { 
            doc.font('Helvetica-Bold').fontSize(12).fillColor('black') 
               .text('SAKTHI\nAUTO', startX, headerY + 8, { width: 100, align: 'center' }); 
        } 

        doc.rect(startX + 100, headerY, totalWidth - 260, 35).stroke(); 
        doc.font('Helvetica-Bold').fontSize(13).fillColor('black') 
           .text('OPERATOR ALLOTMENT SHEET', startX + 100, headerY + 12, { 
               width: totalWidth - 260, 
               align: 'center' 
           }); 

        doc.rect(startX + totalWidth - 160, headerY, 160, 35).stroke(); 
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('black') 
           .text(`LINE: ${row.lineCode || 'ALL'}`, startX + totalWidth - 160, headerY + 6, { 
               width: 160, 
               align: 'center' 
           }); 
        doc.font('Helvetica').fontSize(8).fillColor('black') 
           .text(`DATE: ${displayDate}`, startX + totalWidth - 160, headerY + 20, { 
               width: 160, 
               align: 'center' 
           }); 

        // ---------------- TABLE LAYOUT ---------------- 
        let curY = headerY + 45; 
        const rowH = 22; 
        const fontSize = 8; 

        const drawCell = (x, y, w, h, text, isBold = false, bg = null, align = 'center') => { 
            if (bg) doc.rect(x, y, w, h).fillAndStroke(bg, 'black'); 
            else doc.rect(x, y, w, h).stroke(); 

            doc.fillColor('black') 
               .font(isBold ? 'Helvetica-Bold' : 'Helvetica') 
               .fontSize(fontSize) 
               .text(String(text != null ? text : '-'), x + 2, y + (h / 2 - 4), { width: w - 4, align }); 
        }; 

        doc.lineWidth(0.5).strokeColor('black'); 

        const widths = [70, 80, 80, 80, 80, 80, 80, 80, 162]; 
        const headers = ['SHIFT', 'OPR NO 1', 'OPR NO 2', 'OPR NO 3', 'OPR NO 4', 'OPR NO 5', 'PRO QTY', 'INC NO', 'PRODUCT ENGINEER']; 
        const values = [ 
            `SHIFT ${row.shift}`, 
            row.oprNo1 || '-', 
            row.oprNo2 || '-', 
            row.oprNo3 || '-', 
            row.oprNo4 || '-', 
            row.oprNo5 || '-', 
            row.proQty || '-', 
            row.incNo || '-', 
            row.productEngineer || '-' 
        ]; 

        let currentX = startX; 
        headers.forEach((header, idx) => { 
            drawCell(currentX, curY, widths[idx], rowH, header, true, '#f0f0f0'); 
            currentX += widths[idx]; 
        }); 

        curY += rowH; 
        currentX = startX; 
        values.forEach((val, idx) => { 
            drawCell(currentX, curY, widths[idx], rowH * 1.5, val, false, '#ffffff'); 
            currentX += widths[idx]; 
        }); 

        curY += rowH * 1.5 + 15; 

        // ---------------- SECTION INCHARGE (PE) SIGN ---------------- 
        const peH = rowH * 2.5; 
        const descW = 200; 
        const colW = totalWidth - descW; 

        drawCell(startX, curY, descW, peH, 'SECTION INCHARGE (PE) SIGN', true, '#f3f4f6', 'left'); 

        doc.rect(startX + descW, curY, colW, peH).stroke(); 
        const sig = row.peSignature || ''; 

        if (sig && !isPendingSign(sig)) { 
            const name = String(sig).replace('Approved (', '').replace(')', '').trim(); 
            doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(9) 
               .text('APPROVED', startX + descW + 10, curY + 10, { width: colW - 20, align: 'left' }); 
            doc.fillColor('black').font('Helvetica-Bold').fontSize(8.5) 
               .text(`ENGINEER: ${name.toUpperCase()}`, startX + descW + 10, curY + 24, { width: colW - 20, align: 'left' }); 
        } else { 
            doc.fillColor('#dc2626').font('Helvetica-Bold').fontSize(9) 
               .text('PENDING', startX + descW + 10, curY + 10, { width: colW - 20, align: 'left' }); 
            doc.fillColor('black').font('Helvetica').fontSize(8.5) 
               .text(`ASSIGNED PE: ${row.productEngineer ? String(row.productEngineer).toUpperCase() : 'N/A'}`, startX + descW + 10, curY + 24, { width: colW - 20, align: 'left' }); 
        } 

        doc.end(); 

    } catch (error) { 
        console.error('generateOperatorAllotmentReport:', error); 
        if (!res.headersSent) { 
            return res.status(500).json({ error: 'Failed to generate PDF' }); 
        } 
    } 
}; 

module.exports = { 
    getOperatorAllotmentLines, 
    getProductManagers, 
    getOperatorAllotment, 
    saveOperatorAllotment, 
    getPendingPEOperatorAllotment, 
    signPEOperatorAllotment, 
    generateOperatorAllotmentReport 
};