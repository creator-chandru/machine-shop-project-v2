const sql = require('../db');

// Add new part set dynamically based on machine shop
const addPartSet = async (req, res) => {
  const { shopId, partId, partName } = req.body;

  if (!partId || !partName) {
    return res.status(400).json({ error: "partId and partName are required." });
  }

  const selectedShop = parseInt(shopId, 10) || 3;
  // Determines table name, e.g. M3PartSets, M4PartSets, M2PartSets
  const tableName = `M${selectedShop}PartSets`;

  try {
    const request = new sql.Request();
    request.input('partId', sql.NVarChar(255), partId.trim());
    request.input('partName', sql.NVarChar(500), partName.trim());

    // Check if duplicate partId already exists
    const checkQuery = `SELECT id FROM ${tableName} WHERE partId = @partId`;
    const checkResult = await request.query(checkQuery);

    if (checkResult.recordset && checkResult.recordset.length > 0) {
      return res.status(409).json({ error: `Part ID "${partId}" already exists in ${tableName}.` });
    }

    // Insert new part set
    const insertQuery = `
      INSERT INTO ${tableName} (partId, partName)
      VALUES (@partId, @partName)
    `;
    await request.query(insertQuery);

    return res.status(201).json({ message: `Part Set added successfully to Machine Shop ${selectedShop}!` });
  } catch (err) {
    console.error("Error adding part set:", err);
    return res.status(500).json({ error: "Failed to add part set to database." });
  }
};

module.exports = {
  addPartSet
};