// export-sqlite.js
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SQLITE_PATH = process.argv[2];              // e.g. C:\path\mydb.sqlite
const OUT_DIR = process.argv[3] || 'bethel_export';

if (!SQLITE_PATH) {
  console.error('Usage: node export-sqlite.js <path-to-mydb.sqlite> [output-dir]');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const db = new Database(SQLITE_PATH, { readonly: true });

// Table list
const tables = db.prepare(`
  SELECT name
  FROM sqlite_master
  WHERE type='table'
    AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`).all().map(r => r.name);

fs.writeFileSync(path.join(OUT_DIR, 'tables.json'), JSON.stringify(tables, null, 2));

// Schema (CREATE TABLE statements)
const schemaRows = db.prepare(`
  SELECT name, sql
  FROM sqlite_master
  WHERE type='table'
    AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`).all();

fs.writeFileSync(path.join(OUT_DIR, 'sqlite_schema.sql'),
  schemaRows.map(r => `-- ${r.name}\n${r.sql};\n`).join('\n'));

// Export each table to JSON (safe + preserves types)
for (const t of tables) {
  const rows = db.prepare(`SELECT * FROM "${t}"`).all();
  fs.writeFileSync(path.join(OUT_DIR, `${t}.json`), JSON.stringify(rows, null, 2));
  console.log(`Exported ${t}: ${rows.length} rows`);
}

console.log('Done. Output folder:', path.resolve(OUT_DIR));
