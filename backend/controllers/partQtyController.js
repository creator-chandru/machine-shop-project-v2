const sql = require('../db');

// Helper to safely construct table name and prevent SQL injection
const getTableName = (shopId) => {
    const validShopIds = ['1', '2', '3', '4', '5'];
    if (!validShopIds.includes(shopId)) throw new Error('Invalid Machine Shop ID');
    return `MachineShop${shopId}PartQty`;
};

// ============================================================
// GET PARTS BY SHOP ID
// ============================================================
exports.getPartsByShop = async (req, res) => {
    try {
        const { shopId } = req.params;
        const tableName = getTableName(shopId);
        
        // Execute query directly on the imported sql object
        const result = await sql.query(`
            SELECT id, partId, partName, shift1Quantity, shift2Quantity, shift3Quantity 
            FROM ${tableName}
        `);
            
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching parts data:', error);
        res.status(500).json({ message: "Error fetching parts data" });
    }
};


// ============================================================
// UPDATE PART QUANTITIES
// ============================================================
exports.updatePartQuantities = async (req, res) => {
    try {
        const { shopId, partId } = req.params;
        const { shift1Quantity, shift2Quantity, shift3Quantity } = req.body;
        
        const tableName = getTableName(shopId);
        
        // Fix: Use 'new sql.Request()' instead of 'sql.request()'
        const request = new sql.Request();
        
        await request
            .input('partId', sql.NVarChar(50), partId)
            .input('s1', sql.Int, shift1Quantity || 0)
            .input('s2', sql.Int, shift2Quantity || 0)
            .input('s3', sql.Int, shift3Quantity || 0)
            .query(`
                UPDATE ${tableName} 
                SET shift1Quantity = @s1, 
                    shift2Quantity = @s2, 
                    shift3Quantity = @s3 
                WHERE partId = @partId
            `);
            
        res.status(200).json({ message: "Part quantities updated successfully" });
    } catch (error) {
        console.error('Error updating part quantities:', error);
        res.status(500).json({ message: "Error updating part quantities" });
    }
};