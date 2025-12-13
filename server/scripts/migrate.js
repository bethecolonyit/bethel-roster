// server/scripts/migrate.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

const db = require('../database/db'); // uses your existing MSSQL db module

const migrationsDir = path.join(__dirname, '..', 'migrations');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

async function ensureMigrationsTable() {
  // We create schema_migrations in dbo to avoid dependency on app schema existence.
  // (You can move it to app later if you want. dbo is conventional.)
  await db.query(`
    IF OBJECT_ID('dbo.schema_migrations','U') IS NULL
    BEGIN
      CREATE TABLE dbo.schema_migrations (
        id         INT IDENTITY(1,1) PRIMARY KEY,
        filename   NVARCHAR(260) NOT NULL UNIQUE,
        applied_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        checksum   VARBINARY(32) NULL
      );
    END
  `);
}

async function getApplied() {
  const r = await db.query(`SELECT filename, checksum FROM dbo.schema_migrations ORDER BY id ASC;`);
  const map = new Map();
  for (const row of r.recordset) {
    map.set(row.filename, row.checksum); // checksum is a Buffer
  }
  return map;
}

async function applyMigration(filename, sqlText, checksum) {
  const pool = await db.getPool();
  const tx = new db.sql.Transaction(pool);

  await tx.begin();
  try {
    // Execute migration in one batch (supports GO-less scripts; do not use GO in migration files)
    await new db.sql.Request(tx).batch(sqlText);

    // Record migration
    await new db.sql.Request(tx)
      .input('filename', db.sql.NVarChar(260), filename)
      .input('checksum', db.sql.VarBinary(32), checksum)
      .query(`INSERT INTO dbo.schema_migrations (filename, checksum) VALUES (@filename, @checksum);`);

    await tx.commit();
  } catch (e) {
    try { await tx.rollback(); } catch {}
    throw e;
  }
}

async function main() {
  await ensureMigrationsTable();

  const applied = await getApplied();

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.toLowerCase().endsWith('.sql'))
    .sort();

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const contents = fs.readFileSync(fullPath);
    const checksum = sha256(contents);

    if (applied.has(file)) {
      const prevChecksum = applied.get(file);
      // Fail fast if someone edited an already-applied migration
      if (prevChecksum && Buffer.compare(Buffer.from(prevChecksum), checksum) !== 0) {
        throw new Error(
          `Migration file changed after being applied: ${file}\n` +
          `Do not edit applied migrations. Create a new migration instead.`
        );
      }
      continue;
    }

    console.log(`Applying ${file}...`);
    await applyMigration(file, contents.toString('utf8'), checksum);
    console.log(`Applied ${file}`);
  }

  console.log('Migrations complete.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
