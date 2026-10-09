const fs = require('fs');
const mysql = require('mysql2/promise');
const path = require('path');

async function initDB() {
    try {
        console.log("Connecting to MySQL...");
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            multipleStatements: true
        });
        
        console.log("Connected successfully. Executing schema.sql...");
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        await connection.query(schema);
        console.log("Database initialized successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Failed to initialize database:");
        console.error(err);
        process.exit(1);
    }
}

initDB();
