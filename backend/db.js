require("dotenv").config();

const sql = require("mssql");

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT),

    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

console.log("Server:", process.env.DB_SERVER);
console.log("Port:", process.env.DB_PORT);
console.log("Database:", process.env.DB_DATABASE);
console.log("User:", process.env.DB_USER);

sql.connect(config)
    .then(() => console.log("✅ MSSQL Connected"))
    .catch(err => console.error("❌ DB Error:", err));

module.exports = sql;