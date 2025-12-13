// seed-admin-mssql.js
require('dotenv').config(); // optional: if you use .env in this folder
const sql = require('mssql');
const bcrypt = require('bcrypt');

// --- CHANGE THESE BEFORE RUNNING ---
const email = 'admin@bethelcolony.org';
const password = '$piritL3d';
const role = 'admin';
// -----------------------------------

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME, // bethel_roster_dev or bethel_roster
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

(async () => {
  let pool;
  try {
    if (!config.user || !config.password || !config.server || !config.database) {
      throw new Error('Missing DB env vars. Need DB_HOST, DB_NAME, DB_USER, DB_PASSWORD (and optionally DB_PORT).');
    }

    pool = await sql.connect(config);

    const password_hash = await bcrypt.hash(password, 10);

    // If user exists, stop (match your old UNIQUE constraint behavior)
    const existing = await pool.request()
      .input('email', sql.NVarChar(255), email)
      .query(`SELECT TOP (1) id FROM app.users WHERE email = @email`);

    if (existing.recordset.length > 0) {
      console.error(`Error: A user with email ${email} already exists (id=${existing.recordset[0].id}).`);
      process.exitCode = 1;
      return;
    }

    // Insert and return inserted row
    const inserted = await pool.request()
      .input('email', sql.NVarChar(255), email)
      .input('password_hash', sql.NVarChar(255), password_hash)
      .input('role', sql.NVarChar(50), role)
      .query(`
        INSERT INTO app.users (email, password_hash, role)
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.role, INSERTED.created_at
        VALUES (@email, @password_hash, @role)
      `);

    const u = inserted.recordset[0];
    console.log('Admin user created successfully!');
    console.log(`ID: ${u.id}`);
    console.log(`Email: ${u.email}`);
    console.log(`Role: ${u.role}`);
    console.log(`Created: ${u.created_at}`);
  } catch (err) {
    // SQL Server unique constraint violations are often 2601 or 2627
    if (err && (err.number === 2601 || err.number === 2627)) {
      console.error(`Error: A user with email ${email} already exists.`);
    } else {
      console.error('Error creating admin user:', err);
    }
    process.exitCode = 1;
  } finally {
    if (pool) await pool.close();
  }
})();
