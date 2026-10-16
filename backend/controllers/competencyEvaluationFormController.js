const sql = require("../db");
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ============================================================
// 1. GET HOD INCHARGES LIST
// ============================================================
const getHodIncharges = async (req, res) => {
  try {
    const hodRes = await sql.query`
      SELECT username AS name, username, employeeId 
      FROM dbo.MachineShopUsers 
      WHERE LOWER(role) IN ('hod', 'headfacility', 'headofproduction') 
      ORDER BY username ASC
    `;

    const list =
      hodRes.recordset.length > 0
        ? hodRes.recordset
        : [{ name: 'hod', username: 'hod', employeeId: 'hod' }];

    return res.status(200).json({ hodList: list });
  } catch (err) {
    console.error('Error fetching HOD incharges:', err);
    return res.status(500).json({ error: 'Failed to fetch HOD list' });
  }
};

// ============================================================
// 2. SAVE COMPETENCY EVALUATION FORM
// ============================================================
const saveCompetencyEvaluationForm = async (req, res) => {
  const { header, questions, overallMark, signatures } = req.body;

  if (!header || !header.name || !header.employeeNo) {
    return res.status(400).json({
      error: 'Employee Name and Employee No are required.'
    });
  }

  const questionList = questions || [];
  if (questionList.length === 0) {
    return res.status(400).json({
      error: 'At least one evaluation question is required.'
    });
  }

  const wMark = overallMark?.writtenExamMark;
  const pMark = overallMark?.practicalExamMark;
  if (wMark !== null && wMark !== undefined && wMark !== '' && (Number(wMark) < 0 || Number(wMark) > 100)) {
    return res.status(400).json({ error: 'Written exam mark must be between 0 and 100.' });
  }
  if (pMark !== null && pMark !== undefined && pMark !== '' && (Number(pMark) < 0 || Number(pMark) > 40)) {
    return res.status(400).json({ error: 'Practical exam mark must be between 0 and 40.' });
  }

  let transaction;

  try {
    transaction = new sql.Transaction();
    await transaction.begin();

    const machineShop = parseInt(header.machineShop || 3, 10);
    const employeeNo = String(header.employeeNo).trim();
    const evalDate = header.date ? String(header.date).split('T')[0] : null;

    const deleteReq = new sql.Request(transaction);
    deleteReq.input('employeeNo', sql.NVarChar(50), employeeNo);
    deleteReq.input('evalDate', sql.Date, evalDate);
    deleteReq.input('machineShop', sql.Int, machineShop);

    await deleteReq.query(`
      DELETE FROM CompetencyEvaluationForm
      WHERE employeeNo = @employeeNo
        AND CONVERT(date, evalDate) = CONVERT(date, @evalDate)
        AND machineShop = @machineShop
        AND (hodSign IS NULL OR hodSign = '' OR hodSign = 'Pending')
    `);

    const inchargeSignature = signatures?.inchargeSign || '';
    const assignedHod = header?.assignedHod || signatures?.evaluatedBy || '';
    const hodSignature = signatures?.hodSign || 'Pending';

    for (const q of questionList) {
      const request = new sql.Request(transaction);

      request
        .input('machineShop', sql.Int, machineShop)
        .input('name', sql.NVarChar(150), header.name)
        .input('employeeNo', sql.NVarChar(50), employeeNo)
        .input('qualification', sql.NVarChar(100), header.qualification || '')
        .input('evalDate', sql.Date, evalDate)
        .input('doj', sql.Date, header.doj ? String(header.doj).split('T')[0] : null)
        .input('line', sql.NVarChar(100), header.line || '')
        .input('levelBadge', sql.NVarChar(50), header.levelBadge || 'LEVEL - 3')
        .input('qNo', sql.Int, q.qNo)
        .input('questionText', sql.NVarChar(500), q.questionText)
        .input('rating', sql.NVarChar(20), q.rating || '')
        .input('mark', sql.Int, q.mark !== null && q.mark !== undefined ? q.mark : null)
        .input('writtenExamMark', sql.Int, overallMark?.writtenExamMark !== null && overallMark?.writtenExamMark !== undefined && overallMark?.writtenExamMark !== '' ? parseInt(overallMark.writtenExamMark, 10) : null)
        .input('writtenExamPercentage', sql.NVarChar(20), overallMark?.writtenExamPercentage || '')
        .input('practicalExamMark', sql.Int, overallMark?.practicalExamMark !== null && overallMark?.practicalExamMark !== undefined && overallMark?.practicalExamMark !== '' ? parseInt(overallMark.practicalExamMark, 10) : null)
        .input('practicalExamPercentage', sql.NVarChar(20), overallMark?.practicalExamPercentage || '')
        .input('status', sql.NVarChar(20), overallMark?.status || '')
        .input('inchargeSign', sql.NVarChar(100), inchargeSignature)
        .input('evaluatedBy', sql.NVarChar(100), assignedHod)
        .input('hodSign', sql.NVarChar(100), hodSignature);

      await request.query(`
        INSERT INTO CompetencyEvaluationForm
        (
          machineShop, name, employeeNo, qualification, evalDate, doj, line, levelBadge,
          qNo, questionText, rating, mark,
          writtenExamMark, writtenExamPercentage, practicalExamMark, practicalExamPercentage, status,
          inchargeSign, evaluatedBy, hodSign
        )
        VALUES
        (
          @machineShop, @name, @employeeNo, @qualification, @evalDate, @doj, @line, @levelBadge,
          @qNo, @questionText, @rating, @mark,
          @writtenExamMark, @writtenExamPercentage, @practicalExamMark, @practicalExamPercentage, @status,
          @inchargeSign, @evaluatedBy, @hodSign
        )
      `);
    }

    await transaction.commit();

    return res.status(201).json({
      message: 'Competency Evaluation Form saved successfully'
    });
  } catch (err) {
    console.error('Error saving Competency Evaluation Form:', err);
    if (transaction) {
      try { await transaction.rollback(); } catch (rollbackErr) {}
    }
    return res.status(500).json({
      error: 'Failed to save Competency Evaluation Form'
    });
  }
};

// ============================================================
// 3. GET ALL COMPETENCY EVALUATION FORMS
// ============================================================
const getCompetencyEvaluationForms = async (req, res) => {
  const { machineShop, employeeNo, date } = req.query;

  try {
    let query = `
      SELECT DISTINCT
        name, employeeNo, qualification,
        FORMAT(evalDate, 'yyyy-MM-dd') AS evalDate,
        FORMAT(doj, 'yyyy-MM-dd') AS doj,
        line, levelBadge, writtenExamMark, practicalExamMark,
        status, inchargeSign, evaluatedBy AS assignedHod, hodSign, createdAt
      FROM CompetencyEvaluationForm
      WHERE 1 = 1
    `;

    const request = new sql.Request();

    if (machineShop) {
      query += ` AND machineShop = @machineShop`;
      request.input('machineShop', sql.Int, parseInt(machineShop, 10));
    }

    if (employeeNo) {
      query += ` AND employeeNo = @employeeNo`;
      request.input('employeeNo', sql.NVarChar(50), employeeNo);
    }

    if (date) {
      query += ` AND CONVERT(date, evalDate) = CONVERT(date, @date)`;
      request.input('date', sql.Date, String(date).split('T')[0]);
    }

    query += ` ORDER BY evalDate DESC`;

    const result = await request.query(query);
    return res.status(200).json(result.recordset);
  } catch (err) {
    console.error('Error fetching Competency Evaluation Forms:', err);
    return res.status(500).json({ error: 'Failed to fetch Competency Evaluation Forms' });
  }
};

// ============================================================
// 4. GET SPECIFIC FORM BY EMPLOYEE NO & DATE
// ============================================================
const getCompetencyEvaluationFormByEmp = async (req, res) => {
  const { employeeNo } = req.params;
  const { date } = req.query;

  try {
    let query = `
      SELECT *,
        FORMAT(evalDate, 'yyyy-MM-dd') AS evalDateFormatted,
        FORMAT(doj, 'yyyy-MM-dd') AS dojFormatted
      FROM CompetencyEvaluationForm
      WHERE employeeNo = @employeeNo
    `;

    const request = new sql.Request();
    request.input('employeeNo', sql.NVarChar(50), employeeNo);

    if (date) {
      query += ` AND CONVERT(date, evalDate) = CONVERT(date, @date)`;
      request.input('date', sql.Date, String(date).split('T')[0]);
    }

    query += ` ORDER BY qNo ASC`;

    const result = await request.query(query);
    return res.status(200).json(result.recordset);
  } catch (err) {
    console.error('Error fetching evaluation form for employee:', err);
    return res.status(500).json({ error: 'Failed to fetch evaluation form' });
  }
};

// ============================================================
// 5. GET PENDING HOD COMPETENCY EVALUATIONS
// ============================================================
const getPendingHodReports = async (req, res) => {
  try {
    const { name } = req.params;
    const shopId = req.query.shopId;

    const request = new sql.Request();
    const cleanName = String(name || '').trim();

    let shopFilter = '';
    if (shopId) {
      request.input('machineShop', sql.Int, parseInt(shopId, 10));
      shopFilter = ' AND machineShop = @machineShop';
    }

    let hodFilter = '';
    if (cleanName && cleanName.toLowerCase() !== 'hod') {
      request.input('hodName', sql.NVarChar(100), cleanName);
      hodFilter = ' AND (evaluatedBy = @hodName OR evaluatedBy IS NULL OR evaluatedBy = \'\')';
    }

    const result = await request.query(`
      SELECT 
        MIN(id) AS id,
        machineShop,
        name,
        employeeNo,
        MAX(qualification) AS qualification,
        MAX(line) AS line,
        FORMAT(evalDate, 'yyyy-MM-dd') AS evalDate,
        MAX(writtenExamMark) AS writtenExamMark,
        MAX(writtenExamPercentage) AS writtenExamPercentage,
        MAX(practicalExamMark) AS practicalExamMark,
        MAX(practicalExamPercentage) AS practicalExamPercentage,
        MAX(status) AS status,
        MAX(inchargeSign) AS inchargeSign,
        MAX(evaluatedBy) AS assignedHod,
        MAX(hodSign) AS hodSign
      FROM CompetencyEvaluationForm
      WHERE (hodSign IS NULL OR hodSign = '' OR hodSign = 'Pending')
        ${shopFilter}
        ${hodFilter}
      GROUP BY machineShop, name, employeeNo, evalDate
      ORDER BY evalDate DESC, MIN(id) DESC
    `);

    const safeRecords = (result.recordset || []).map(r => ({
      ...r,
      name: r.name || '',
      employeeNo: r.employeeNo || '',
      evalDate: r.evalDate || '',
      assignedHod: r.assignedHod || '',
      hodSign: r.hodSign || 'Pending',
      inchargeSign: r.inchargeSign || 'Pending',
      status: r.status || '-'
    }));

    return res.status(200).json(safeRecords);
  } catch (err) {
    console.error('Pending HOD Competency Reports Fetch Error:', err);
    return res.status(500).json({ message: 'DB error fetching pending reports' });
  }
};

// ============================================================
// 6. POST HOD APPROVAL SIGNATURE
// ============================================================
const signHodApproval = async (req, res) => {
  try {
    const { employeeNo, date, signature, hodUsername } = req.body;

    if (!employeeNo || !date) {
      return res.status(400).json({ message: 'Missing employeeNo or date' });
    }

    const signVal = signature || hodUsername || 'Approved';
    const cleanDate = String(date).split('T')[0];

    const request = new sql.Request();
    request.input('employeeNo', sql.NVarChar(50), employeeNo);
    request.input('evalDate', sql.Date, cleanDate);
    request.input('signature', sql.NVarChar(100), signVal);

    const result = await request.query(`
      UPDATE CompetencyEvaluationForm 
      SET hodSign = @signature
      WHERE employeeNo = @employeeNo 
        AND CONVERT(date, evalDate) = CONVERT(date, @evalDate)
        AND (hodSign IS NULL OR hodSign = '' OR hodSign = 'Pending')
    `);

    if (!result.rowsAffected[0]) {
      return res.status(404).json({ message: 'No pending records found to approve' });
    }

    return res.status(200).json({
      success: true,
      message: 'Competency Evaluation approved by HOD successfully!'
    });
  } catch (err) {
    console.error('Sign HOD Error:', err);
    return res.status(500).json({ message: 'Failed to approve report' });
  }
};

// ============================================================
// 7. PDF REPORT GENERATOR WITH DYNAMIC QF HISTORY
// ============================================================
const generateReport = async (req, res) => {
  try {
    const { fromDate, toDate, shopId, employeeNo, date } = req.query;

    const request = new sql.Request();
    let query = `
      SELECT 
        id, machineShop, name, employeeNo, qualification,
        FORMAT(evalDate, 'yyyy-MM-dd') AS evalDate,
        FORMAT(doj, 'yyyy-MM-dd') AS doj,
        line, levelBadge,
        qNo, questionText, rating, mark,
        writtenExamMark, writtenExamPercentage,
        practicalExamMark, practicalExamPercentage,
        status, inchargeSign, evaluatedBy, hodSign
      FROM CompetencyEvaluationForm
      WHERE 1 = 1
    `;

    if (fromDate && toDate) {
      request.input('fromDate', sql.Date, String(fromDate).split('T')[0]);
      request.input('toDate', sql.Date, String(toDate).split('T')[0]);
      query += ` AND CONVERT(date, evalDate) >= CONVERT(date, @fromDate) AND CONVERT(date, evalDate) <= CONVERT(date, @toDate)`;
    } else if (date) {
      request.input('evalDate', sql.Date, String(date).split('T')[0]);
      query += ` AND CONVERT(date, evalDate) = CONVERT(date, @evalDate)`;
    } else {
      return res.status(400).send('fromDate and toDate (or date) are required.');
    }

    if (employeeNo) {
      request.input('employeeNo', sql.NVarChar(50), employeeNo);
      query += ` AND employeeNo = @employeeNo`;
    }

    if (shopId) {
      request.input('machineShop', sql.Int, parseInt(shopId, 10));
      query += ` AND machineShop = @machineShop`;
    }

    query += ` ORDER BY evalDate ASC, employeeNo ASC, qNo ASC`;

    const result = await request.query(query);
    const records = result.recordset;

    if (!records || records.length === 0) {
      return res.status(404).send('No records found for the selected parameters.');
    }

    let qfHistory = [];
    try {
      const qfRes = await sql.query(`
        SELECT id, formName, qfValue, FORMAT(date, 'yyyy-MM-dd') AS date 
        FROM CompetencyEvaluationQFvalues 
        ORDER BY date DESC, id DESC
      `);
      qfHistory = qfRes.recordset || [];
    } catch (qfErr) {
      console.error("Warning: Could not fetch CompetencyEvaluationQFvalues:", qfErr.message);
    }

    const getEffectiveQfValue = (recordDateStr) => {
      const fallback = "QF/06/ADM - 04, Rev.No: 01 dt 01.11.2018";
      if (!qfHistory || qfHistory.length === 0) return fallback;

      if (recordDateStr) {
        const targetDate = new Date(recordDateStr);
        targetDate.setHours(0, 0, 0, 0);

        for (let qf of qfHistory) {
          if (!qf.date) continue;
          const qfDate = new Date(qf.date);
          qfDate.setHours(0, 0, 0, 0);

          if (qfDate <= targetDate) {
            return qf.qfValue;
          }
        }
      }
      return qfHistory[0]?.qfValue || fallback;
    };

    const groupedMap = new Map();
    records.forEach((r) => {
      const key = `${r.employeeNo}_${r.evalDate}`;
      if (!groupedMap.has(key)) groupedMap.set(key, []);
      groupedMap.get(key).push(r);
    });

    const groups = Array.from(groupedMap.values());

    const doc = new PDFDocument({ margin: 25, size: 'A4', layout: 'portrait', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Competency_Evaluation_Report_${fromDate || date}_to_${toDate || date}.pdf`
    );
    doc.pipe(res);

    const startX = 25;
    const pageWidth = doc.page.width - 50;
    const logoPath = path.join(__dirname, 'logo.jpg');

    const drawCheckMark = (centerX, centerY, size = 10, color = '#16a34a') => {
      doc.save().lineWidth(1.5).strokeColor(color)
        .moveTo(centerX - size * 0.45, centerY)
        .lineTo(centerX - size * 0.1, centerY + size * 0.4)
        .lineTo(centerX + size * 0.45, centerY - size * 0.35)
        .stroke().restore();
    };

    const drawCrossMark = (centerX, centerY, size = 9, color = '#dc2626') => {
      const half = size / 2;
      doc.save().lineWidth(1.5).strokeColor(color)
        .moveTo(centerX - half, centerY - half).lineTo(centerX + half, centerY + half)
        .moveTo(centerX + half, centerY - half).lineTo(centerX - half, centerY + half)
        .stroke().restore();
    };

    const drawApprovedText = (x, y, w, name, fontSize) => {
      const label = `APPROVED BY: ${String(name).toUpperCase()}`;
      doc.font('Helvetica-Bold').fontSize(fontSize);
      const tw = doc.widthOfString(label);
      const iconW = 12;
      const startTextX = x + (w - (tw + iconW)) / 2 + iconW;
      drawCheckMark(startTextX - 7, y + fontSize / 2, 7);
      doc.fillColor('#16a34a').text(label, startTextX, y, { lineBreak: false });
      doc.fillColor('black');
    };

    groups.forEach((groupRecords, gIdx) => {
      const first = groupRecords[0];
      const effectiveQf = getEffectiveQfValue(first.evalDate);
      const [yy, mm, dd] = String(first.evalDate || '').split('-');
      const displayDate = dd && mm && yy ? `${dd}.${mm}.${yy}` : first.evalDate || '-';
      const [dojY, dojM, dojD] = String(first.doj || '').split('-');
      const displayDoj = dojD && dojM && dojY ? `${dojD}.${dojM}.${dojY}` : first.doj || '-';

      if (gIdx > 0) doc.addPage();

      let currY = 25;
      doc.lineWidth(1).strokeColor('black').rect(startX, currY, pageWidth, 50).stroke();

      const logoBoxWidth = 140;
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, startX + 5, currY + 5, { fit: [logoBoxWidth - 10, 40], align: 'center', valign: 'center' });
      } else {
        doc.font('Helvetica-Bold').fontSize(8).fillColor('black');
        doc.text('SAKTHI AUTO COMPONENT\nLIMITED', startX + 5, currY + 16, { width: logoBoxWidth - 10, align: 'center' });
      }
      doc.lineCap('butt').moveTo(startX + logoBoxWidth, currY).lineTo(startX + logoBoxWidth, currY + 50).stroke();

      doc.font('Helvetica-Bold').fontSize(10).text('COMPETENCY EVALUATION FORM', startX + 140, currY + 8, { width: 290, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(7.5).text(effectiveQf, startX + 140, currY + 21, { width: 290, align: 'center' });
      doc.font('Helvetica').fontSize(8.5).text('(PRACTICAL) - VTL & HTL', startX + 140, currY + 33, { width: 290, align: 'center' });
      doc.moveTo(startX + 430, currY).lineTo(startX + 430, currY + 50).stroke();

      doc.font('Helvetica-Bold').fontSize(11).text(first.levelBadge || 'LEVEL - 3', startX + 430, currY + 19, { width: 115, align: 'center' });
      currY += 50;

      const metaH = 46;
      doc.rect(startX, currY, pageWidth, metaH).stroke();
      doc.moveTo(startX + pageWidth / 2, currY).lineTo(startX + pageWidth / 2, currY + metaH).stroke();

      doc.font('Helvetica-Bold').fontSize(7.5);
      doc.text('NAME :', startX + 6, currY + 6);
      doc.font('Helvetica').text(first.name || '-', startX + 90, currY + 6);
      doc.font('Helvetica-Bold').text('EMPLOYEE NO :', startX + 6, currY + 19);
      doc.font('Helvetica').text(first.employeeNo || '-', startX + 90, currY + 19);
      doc.font('Helvetica-Bold').text('QUALIFICATION :', startX + 6, currY + 32);
      doc.font('Helvetica').text(first.qualification || '-', startX + 90, currY + 32);

      const rightMetaX = startX + pageWidth / 2 + 6;
      doc.font('Helvetica-Bold').text('DATE :', rightMetaX, currY + 6);
      doc.font('Helvetica').text(displayDate, rightMetaX + 60, currY + 6);
      doc.font('Helvetica-Bold').text('DOJ :', rightMetaX, currY + 19);
      doc.font('Helvetica').text(displayDoj, rightMetaX + 60, currY + 19);
      doc.font('Helvetica-Bold').text('LINE :', rightMetaX, currY + 32);
      doc.font('Helvetica').text(first.line || '-', rightMetaX + 60, currY + 32);

      currY += metaH + 4;

      const colSNo = 30;
      const colMarks = 40;
      const colQ = pageWidth - colSNo - colMarks * 3;

      doc.lineWidth(0.8);
      doc.rect(startX, currY, colSNo, 36).fillAndStroke('#f0f0f0', 'black');
      doc.fillColor('black').font('Helvetica-Bold').fontSize(7.5).text('S.NO', startX, currY + 14, { width: colSNo, align: 'center' });

      doc.rect(startX + colSNo, currY, colQ, 36).fillAndStroke('#f0f0f0', 'black');
      doc.fillColor('black').font('Helvetica-Bold').fontSize(8).text('QUESTIONS', startX + colSNo + 10, currY + 14);

      doc.rect(startX + colSNo + colQ, currY, colMarks * 3, 14).fillAndStroke('#f0f0f0', 'black');
      doc.fillColor('black').font('Helvetica-Bold').fontSize(7.5).text('MARKS', startX + colSNo + colQ, currY + 3.5, { width: colMarks * 3, align: 'center' });

      const marksX = startX + colSNo + colQ;
      doc.rect(marksX, currY + 14, colMarks, 11).stroke();
      doc.font('Helvetica-Bold').fontSize(7.5).text('2', marksX, currY + 16, { width: colMarks, align: 'center' });
      doc.rect(marksX + colMarks, currY + 14, colMarks, 11).stroke();
      doc.text('1', marksX + colMarks, currY + 16, { width: colMarks, align: 'center' });
      doc.rect(marksX + colMarks * 2, currY + 14, colMarks, 11).stroke();
      doc.text('0', marksX + colMarks * 2, currY + 16, { width: colMarks, align: 'center' });

      doc.rect(marksX, currY + 25, colMarks, 11).stroke();
      doc.font('Helvetica-Bold').fontSize(7).text('OK', marksX, currY + 27, { width: colMarks, align: 'center' });
      doc.rect(marksX + colMarks, currY + 25, colMarks, 11).stroke();
      doc.text('PARTIAL', marksX + colMarks, currY + 27, { width: colMarks, align: 'center' });
      doc.rect(marksX + colMarks * 2, currY + 25, colMarks, 11).stroke();
      doc.text('NOT OK', marksX + colMarks * 2, currY + 27, { width: colMarks, align: 'center' });

      currY += 36;

      doc.font('Helvetica').fontSize(6.5);
      const rowHeight = 26;

      groupRecords.forEach((q) => {
        const isFail = q.rating === 'FAIL';
        const isOk = q.rating === 'OK' || q.mark === 2;
        const isPartial = q.rating === 'PARTIAL' || q.mark === 1;
        const isNotOk = q.rating === 'NOT OK' || (q.mark === 0 && !isFail);

        doc.rect(startX, currY, colSNo, rowHeight).stroke();
        doc.font('Helvetica-Bold').fontSize(6.5).text(String(q.qNo), startX, currY + 9, { width: colSNo, align: 'center' });

        doc.rect(startX + colSNo, currY, colQ, rowHeight).stroke();
        doc.font('Helvetica').fontSize(6.5).text(q.questionText || '', startX + colSNo + 6, currY + 6, { width: colQ - 12 });

        const markCenterY = currY + rowHeight / 2;

        doc.rect(marksX, currY, colMarks, rowHeight).stroke();
        if (isOk) drawCheckMark(marksX + colMarks / 2, markCenterY, 10, '#16a34a');

        doc.rect(marksX + colMarks, currY, colMarks, rowHeight).stroke();
        if (isPartial) drawCheckMark(marksX + colMarks * 1.5, markCenterY, 10, '#eab308');

        doc.rect(marksX + colMarks * 2, currY, colMarks, rowHeight).stroke();
        if (isNotOk) drawCheckMark(marksX + colMarks * 2.5, markCenterY, 10, '#dc2626');
        if (isFail) drawCrossMark(marksX + colMarks * 2.5, markCenterY, 9, '#dc2626');

        doc.fillColor('black');
        currY += rowHeight;
      });

      const footerH = 50;
      doc.rect(startX, currY + 4, pageWidth, footerH).stroke();

      doc.font('Helvetica-Bold').fontSize(6.5).fillColor('black');
      doc.text('Note:- 1) NOT OK & PARTIAL SHOULD BE TAKEN TO RETRAINING', startX + 6, currY + 8);
      doc.text('       2) PRODUCTION TARGET ACHIEVED SHOULD BE 85%', startX + 6, currY + 18);
      doc.text('       3) QUALITY LEVEL 90% ABOVE SHOULD BE PASSED TO LEVEL-3', startX + 6, currY + 28);

      const sigBoxW = 160;
      const sigBoxX = startX + pageWidth - sigBoxW - 10;
      doc.rect(sigBoxX, currY + 10, sigBoxW, 36).stroke();
      doc.font('Helvetica-Bold').fontSize(7).text('INCHARGE SIGN (EVALUATED BY)', sigBoxX, currY + 13, { width: sigBoxW, align: 'center' });

      const inchargeApproved = first.inchargeSign && !String(first.inchargeSign).toLowerCase().includes('pending');
      if (inchargeApproved) {
        drawApprovedText(sigBoxX, currY + 28, sigBoxW, first.inchargeSign, 7.5);
      } else {
        doc.fillColor('red').font('Helvetica').fontSize(7.5).text('Pending Shift Incharge', sigBoxX, currY + 28, { width: sigBoxW, align: 'center' }).fillColor('black');
      }

      // PAGE 2
      doc.addPage();
      let page2Y = 30;

      doc.lineWidth(1).strokeColor('black').rect(startX, page2Y, pageWidth, 24).fillAndStroke('#f0f0f0', 'black');
      doc.fillColor('black').font('Helvetica-Bold').fontSize(10).text('EVALUATION CRITERIA', startX + 10, page2Y + 7);
      doc.rect(startX + pageWidth - 80, page2Y + 3, 70, 18).fillAndStroke('white', 'black');
      doc.fillColor('black').font('Helvetica-Bold').fontSize(8.5).text('LEVEL - 3', startX + pageWidth - 80, page2Y + 8, { width: 70, align: 'center' });

      page2Y += 32;

      doc.rect(startX, page2Y, pageWidth, 18).fillAndStroke('#e5e7eb', 'black');
      doc.fillColor('black').font('Helvetica-Bold').fontSize(8.5).text('WRITTEN EXAM', startX + 10, page2Y + 5);
      page2Y += 18;

      const descW = 345;
      const detW = 150;

      doc.rect(startX, page2Y, 50, 16).stroke();
      doc.text('S.NO', startX, page2Y + 5, { width: 50, align: 'center' });
      doc.rect(startX + 50, page2Y, descW, 16).stroke();
      doc.text('DESCRIPTION', startX + 60, page2Y + 5);
      doc.rect(startX + 50 + descW, page2Y, detW, 16).stroke();
      doc.text('DETAILS', startX + 50 + descW, page2Y + 5, { width: detW, align: 'center' });
      page2Y += 16;

      const writtenRows = [
        ['1', 'NUMBER OF QUESTIONS', '20'],
        ['2', 'EACH QUESTION MARK', '5'],
        ['3', 'TOTAL MARKS (20*5)', '100'],
        ['4', 'PASS MARK', '80'],
        ['5', 'PASS MARK CRITERIA', '80%']
      ];

      doc.font('Helvetica').fontSize(8);
      writtenRows.forEach((row) => {
        doc.rect(startX, page2Y, 50, 16).stroke();
        doc.text(row[0], startX, page2Y + 5, { width: 50, align: 'center' });
        doc.rect(startX + 50, page2Y, descW, 16).stroke();
        doc.text(row[1], startX + 60, page2Y + 5);
        doc.rect(startX + 50 + descW, page2Y, detW, 16).stroke();
        doc.font('Helvetica-Bold').text(row[2], startX + 50 + descW, page2Y + 5, { width: detW, align: 'center' }).font('Helvetica');
        page2Y += 16;
      });

      page2Y += 16;

      doc.rect(startX, page2Y, pageWidth, 18).fillAndStroke('#e5e7eb', 'black');
      doc.fillColor('black').font('Helvetica-Bold').fontSize(8.5).text('PRACTICAL EXAM', startX + 10, page2Y + 5);
      page2Y += 18;

      doc.rect(startX, page2Y, 50, 16).stroke();
      doc.text('S.NO', startX, page2Y + 5, { width: 50, align: 'center' });
      doc.rect(startX + 50, page2Y, descW, 16).stroke();
      doc.text('DESCRIPTION', startX + 60, page2Y + 5);
      doc.rect(startX + 50 + descW, page2Y, detW, 16).stroke();
      doc.text('DETAILS', startX + 50 + descW, page2Y + 5, { width: detW, align: 'center' });
      page2Y += 16;

      const practicalRows = [
        ['1', 'NUMBER OF QUESTIONS', '20'],
        ['2', 'EACH QUESTION MARK', '2'],
        ['3', 'TOTAL MARKS (20*2)', '40'],
        ['4', 'PASS MARK', '36'],
        ['5', 'PASS MARK CRITERIA', '90%']
      ];

      doc.font('Helvetica').fontSize(8);
      practicalRows.forEach((row) => {
        doc.rect(startX, page2Y, 50, 16).stroke();
        doc.text(row[0], startX, page2Y + 5, { width: 50, align: 'center' });
        doc.rect(startX + 50, page2Y, descW, 16).stroke();
        doc.text(row[1], startX + 60, page2Y + 5);
        doc.rect(startX + 50 + descW, page2Y, detW, 16).stroke();
        doc.font('Helvetica-Bold').text(row[2], startX + 50 + descW, page2Y + 5, { width: detW, align: 'center' }).font('Helvetica');
        page2Y += 16;
      });

      page2Y += 16;

      doc.rect(startX, page2Y, pageWidth, 18).fillAndStroke('#e5e7eb', 'black');
      doc.fillColor('black').font('Helvetica-Bold').fontSize(8.5).text('OVERALL MARK', startX + 10, page2Y + 5);
      page2Y += 18;

      const omDescW = 285;
      const omMarkW = 105;
      const omPercW = 105;

      doc.rect(startX, page2Y, 50, 16).stroke();
      doc.text('S.NO', startX, page2Y + 5, { width: 50, align: 'center' });
      doc.rect(startX + 50, page2Y, omDescW, 16).stroke();
      doc.text('DESCRIPTION', startX + 60, page2Y + 5);
      doc.rect(startX + 50 + omDescW, page2Y, omMarkW, 16).stroke();
      doc.text('MARK', startX + 50 + omDescW, page2Y + 5, { width: omMarkW, align: 'center' });
      doc.rect(startX + 50 + omDescW + omMarkW, page2Y, omPercW, 16).stroke();
      doc.text('PERCENTAGE', startX + 50 + omDescW + omMarkW, page2Y + 5, { width: omPercW, align: 'center' });
      page2Y += 16;

      doc.rect(startX, page2Y, 50, 20).stroke();
      doc.text('1', startX, page2Y + 6, { width: 50, align: 'center' });
      doc.rect(startX + 50, page2Y, omDescW, 20).stroke();
      doc.font('Helvetica-Bold').text('SCORED MARK IN WRITTEN EXAM', startX + 60, page2Y + 6);
      doc.rect(startX + 50 + omDescW, page2Y, omMarkW, 20).stroke();
      doc.text(first.writtenExamMark != null ? `${first.writtenExamMark} (out of 100)` : '-', startX + 50 + omDescW, page2Y + 6, { width: omMarkW, align: 'center' });
      doc.rect(startX + 50 + omDescW + omMarkW, page2Y, omPercW, 20).stroke();
      doc.text(first.writtenExamPercentage || '-', startX + 50 + omDescW + omMarkW, page2Y + 6, { width: omPercW, align: 'center' });
      page2Y += 20;

      doc.rect(startX, page2Y, 50, 20).stroke();
      doc.text('2', startX, page2Y + 6, { width: 50, align: 'center' });
      doc.rect(startX + 50, page2Y, omDescW, 20).stroke();
      doc.text('SCORED MARK IN PRACTICAL EXAM', startX + 60, page2Y + 6);
      doc.rect(startX + 50 + omDescW, page2Y, omMarkW, 20).stroke();
      doc.text(first.practicalExamMark != null ? `${first.practicalExamMark} (out of 40)` : '-', startX + 50 + omDescW, page2Y + 6, { width: omMarkW, align: 'center' });
      doc.rect(startX + 50 + omDescW + omMarkW, page2Y, omPercW, 20).stroke();
      doc.text(first.practicalExamPercentage || '-', startX + 50 + omDescW + omMarkW, page2Y + 6, { width: omPercW, align: 'center' });
      page2Y += 20;

      doc.rect(startX, page2Y, 50 + omDescW, 22).fillAndStroke('#f9fafb', 'black');
      doc.fillColor('black').font('Helvetica-Bold').fontSize(9).text('STATUS :', startX + 50, page2Y + 7, { width: omDescW, align: 'right' });

      doc.rect(startX + 50 + omDescW, page2Y, omMarkW + omPercW, 22).stroke();
      const statusColor = String(first.status).toUpperCase() === 'PASS' ? '#16a34a' : String(first.status).toUpperCase() === 'FAIL' ? '#dc2626' : 'black';
      doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(10).text(first.status ? String(first.status).toUpperCase() : '-', startX + 50 + omDescW, page2Y + 6, { width: omMarkW + omPercW, align: 'center' }).fillColor('black');
      page2Y += 32;

      const sigColW = pageWidth / 2;
      doc.rect(startX, page2Y, sigColW, 55).stroke();
      doc.font('Helvetica-Bold').fontSize(8).text('INCHARGE SIGN (EVALUATED BY)', startX, page2Y + 8, { width: sigColW, align: 'center' });
      if (inchargeApproved) {
        drawApprovedText(startX, page2Y + 30, sigColW, first.inchargeSign, 8);
      } else {
        doc.fillColor('red').font('Helvetica').fontSize(8).text('Pending Shift Incharge', startX, page2Y + 30, { width: sigColW, align: 'center' }).fillColor('black');
      }

      doc.rect(startX + sigColW, page2Y, sigColW, 55).stroke();
      doc.font('Helvetica-Bold').fontSize(8).text('HOD SIGN', startX + sigColW, page2Y + 8, { width: sigColW, align: 'center' });
      const hodApproved = first.hodSign && !String(first.hodSign).toLowerCase().includes('pending');
      if (hodApproved) {
        drawApprovedText(startX + sigColW, page2Y + 30, sigColW, first.hodSign, 8);
      } else {
        const assignedTxt = first.evaluatedBy ? `(Assigned: ${first.evaluatedBy.toUpperCase()})` : '';
        doc.fillColor('red').font('Helvetica').fontSize(8).text(`Pending ${assignedTxt}`, startX + sigColW, page2Y + 30, { width: sigColW, align: 'center' }).fillColor('black');
      }

      // Render QF Value at the bottom of Page 2
      page2Y += 65;
      doc.font('Helvetica').fontSize(7.5).fillColor('#6b7280').text(effectiveQf, startX, page2Y);
      doc.fillColor('black');
    });

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'PDF generation failed' });
    else res.end();
  }
};
module.exports = {
  getHodIncharges,
  saveCompetencyEvaluationForm,
  getCompetencyEvaluationForms,
  getCompetencyEvaluationFormByEmp,
  getPendingHodReports,
  signHodApproval,
  generateReport
};