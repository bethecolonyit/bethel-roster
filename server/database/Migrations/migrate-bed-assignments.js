// migrate-bed-assignments.js
//
// Run this once to recreate the bed_assignments table
// with ON DELETE CASCADE on student_id.
//
// Usage:
//   node migrate-bed-assignments.js

const Database = require('better-sqlite3');

const DB_FILE = '../../mydb.sqlite';

function main() {
  const db = new Database(DB_FILE, { verbose: console.log });

  try {
    console.log('Starting bed_assignments migration...');

    // Make sure foreign keys are enforced normally
    db.pragma('foreign_keys = ON');

    // Check that bed_assignments exists
    const tableExists = db
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type='table' AND name='bed_assignments'
      `)
      .get();

    if (!tableExists) {
      console.log('Table bed_assignments does not exist. Nothing to migrate.');
      return;
    }

    // Check current foreign key definition for student_id
    const fkList = db
      .prepare(`PRAGMA foreign_key_list(bed_assignments)`)
      .all();

    const studentFk = fkList.find(fk => fk.table === 'students');

    if (!studentFk) {
      console.warn(
        'No foreign key from bed_assignments to students found. Proceeding with migration anyway.'
      );
    } else if (studentFk.on_delete && studentFk.on_delete.toUpperCase() === 'CASCADE') {
      console.log('bed_assignments already has ON DELETE CASCADE on student_id. No migration needed.');
      return;
    } else {
      console.log(
        `Current student_id FK on_delete = '${studentFk.on_delete}'. Will migrate to ON DELETE CASCADE.`
      );
    }

    // Wrap in a transaction for safety
    const migrate = db.transaction(() => {
      console.log('Disabling foreign_keys for migration...');
      db.pragma('foreign_keys = OFF');

      console.log('Renaming old bed_assignments table...');
      db.prepare(`ALTER TABLE bed_assignments RENAME TO bed_assignments_old;`).run();

      console.log('Creating new bed_assignments table with ON DELETE CASCADE...');
      db.prepare(`
        CREATE TABLE bed_assignments (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          bed_id      INTEGER NOT NULL,
          student_id  INTEGER NOT NULL,
          start_date  TEXT NOT NULL,
          end_date    TEXT,
          FOREIGN KEY (bed_id) REFERENCES beds(id),
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        );
      `).run();

      console.log('Copying data from bed_assignments_old into new bed_assignments...');
      db.prepare(`
        INSERT INTO bed_assignments (id, bed_id, student_id, start_date, end_date)
        SELECT id, bed_id, student_id, start_date, end_date
        FROM bed_assignments_old;
      `).run();

      console.log('Dropping old bed_assignments_old table...');
      db.prepare(`DROP TABLE bed_assignments_old;`).run();

      console.log('Recreating indexes...');
      db.prepare(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_bed_assignments_bed_current
        ON bed_assignments(bed_id)
        WHERE end_date IS NULL;
      `).run();

      db.prepare(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_bed_assignments_student_current
        ON bed_assignments(student_id)
        WHERE end_date IS NULL;
      `).run();

      console.log('Re-enabling foreign key enforcement...');
      db.pragma('foreign_keys = ON');
    });

    migrate();
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration FAILED:', err);
  }
}

main();
