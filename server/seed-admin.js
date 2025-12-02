const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const DB_FILE = 'mydb.sqlite';

// --- CHANGE THESE BEFORE RUNNING ---
const email = 'admin@bethelcolony.org';
const password = '$piritL3d';
const role = 'admin';
// -----------------------------------

// Open DB connection
const db = new Database(DB_FILE);

(async () => {
    try {
        // Hash the password
        const password_hash = await bcrypt.hash(password, 10);

        // Prepare INSERT
        const stmt = db.prepare(`
            INSERT INTO users (email, password_hash, role)
            VALUES (?, ?, ?)
        `);

        const result = stmt.run(email, password_hash, role);

        console.log(`Admin user created successfully!`);
        console.log(`ID: ${result.lastInsertRowid}`);
        console.log(`Email: ${email}`);
        console.log(`Role: ${role}`);
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            console.error(`Error: A user with email ${email} already exists.`);
        } else {
            console.error("Error creating admin user:", err);
        }
    } finally {
        db.close();
    }
})();
