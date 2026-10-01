const sql = require('../db');

const getMappingTableName = (shopId) => {
    const validShopIds = ['1', '2', '3', '4', '5'];
    if (!validShopIds.includes(shopId)) throw new Error('Invalid Machine Shop ID');
    return `M${shopId}LineandPartMapping`;
};

const getPartSetsTableName = (shopId) => {
    const validShopIds = ['1', '2', '3', '4', '5'];
    if (!validShopIds.includes(shopId)) throw new Error('Invalid Machine Shop ID');
    return `M${shopId}PartSets`;
};

exports.getLineCodes = async (req, res) => {
    try {
        const { shopId } = req.params;
        const tableName = getMappingTableName(shopId);
        
        // Fetch shift quantities along with the mapping
        const result = await sql.query(`
            SELECT id, lineCode, partSet, idSet, shift1Quantity, shift2Quantity, shift3Quantity 
            FROM ${tableName} 
            ORDER BY lineCode
        `);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching line codes:', error);
        res.status(500).json({ message: "Error fetching line codes" });
    }
};

exports.getPartSets = async (req, res) => {
    try {
        const { shopId } = req.params;
        const tableName = getPartSetsTableName(shopId);
        
        const result = await sql.query(`SELECT id, partId, partName FROM ${tableName} ORDER BY partName`);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching part sets:', error);
        res.status(500).json({ message: "Error fetching part sets" });
    }
};

exports.updateMapping = async (req, res) => {
    try {
        const { shopId } = req.params;
        // Extract mapping and quantity data from the request body
        const { lineCode, partSet, idSet, shift1Quantity, shift2Quantity, shift3Quantity } = req.body;
        
        const tableName = getMappingTableName(shopId);
        const request = new sql.Request();
        
        await request
            .input('lineCode', sql.NVarChar(50), lineCode)
            .input('partSet', sql.NVarChar(sql.MAX), partSet)
            .input('idSet', sql.NVarChar(sql.MAX), idSet)
            .input('s1', sql.Int, shift1Quantity || 0)
            .input('s2', sql.Int, shift2Quantity || 0)
            .input('s3', sql.Int, shift3Quantity || 0)
            .query(`
                UPDATE ${tableName} 
                SET partSet = @partSet,
                    idSet = @idSet,
                    shift1Quantity = @s1,
                    shift2Quantity = @s2,
                    shift3Quantity = @s3
                WHERE lineCode = @lineCode
            `);
            
        res.status(200).json({ message: "Part mapping and quantities updated successfully" });
    } catch (error) {
        console.error('Error updating part mapping:', error);
        res.status(500).json({ message: "Error updating part mapping" });
    }
};