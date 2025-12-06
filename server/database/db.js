const Database = require('better-sqlite3');

const DB_FILE = 'mydb.sqlite';

// Open DB once, reuse everywhere
const db = new Database(DB_FILE, { verbose: console.log });

// Ensure tables exist (runs every start, harmless if already created)
db.prepare(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    idNumber TEXT,
    counselor TEXT,
    program TEXT,
    dayin DATE,
    dayout DATE,
    isFelon BOOLEAN,
    onProbation BOOLEAN,
    usesNicotine BOOLEAN,
    hasDriverLicense BOOLEAN,
    foodAllergies boolean,
    beeAllergies boolean
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// --- Residential schema ---
db.prepare(`
  CREATE TABLE IF NOT EXISTS buildings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    buildingName TEXT NOT NULL UNIQUE
  );
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS rooms (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    buildingId  INTEGER NOT NULL,
    roomNumber  TEXT NOT NULL,
    roomType    TEXT NOT NULL CHECK (roomType IN ('student', 'staff', 'vsp')),
    FOREIGN KEY (buildingId) REFERENCES buildings(id) ON DELETE CASCADE
  );
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS beds (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    roomId    INTEGER NOT NULL,
    bedLetter TEXT NOT NULL CHECK (bedLetter IN ('A','B','C','D')),
    FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE
  );
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS bed_assignments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    bed_id      INTEGER NOT NULL,
    student_id  INTEGER NOT NULL,
    start_date  TEXT NOT NULL,
    end_date    TEXT,
    FOREIGN KEY (bed_id) REFERENCES beds(id),
    FOREIGN KEY (student_id) REFERENCES students(id)
  );
`).run();

// Only one current assignment per bed
db.prepare(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bed_assignments_bed_current
  ON bed_assignments(bed_id)
  WHERE end_date IS NULL;
`).run();

// Only one current bed per student
db.prepare(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bed_assignments_student_current
  ON bed_assignments(student_id)
  WHERE end_date IS NULL;
`).run();

module.exports = db;