// migrations/add-dayout-column.js
const Database = require('better-sqlite3');

try {
  const db = new Database('./mydb.sqlite'); // adjust path if needed

  // Check if column already exists
  const pragma = db.prepare("PRAGMA table_info(students)").all();
  const hasDayOut = pragma.some(col => col.name === "dayout");

  if (hasDayOut) {
    console.log("Column 'dayout' already exists. No changes made.");
    process.exit(0);
  }

  // Add the new column
  db.prepare(`
    ALTER TABLE students
    ADD COLUMN dayout TEXT;
  `).run();

  console.log("Successfully added 'dayout' column to students table.");
  
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
}
