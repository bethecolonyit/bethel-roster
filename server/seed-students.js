

const fs = require('fs');
const path = require('path');
const db = require('./database/db'); // your existing better-sqlite3 db setup

// ---- Helpers to keep date math stable ----

/**
 * Takes a "YYYY-MM-DD" string and returns an ISO string in UTC.
 * e.g. "2025-11-10" -> "2025-11-10T00:00:00.000Z"
 */
function toISOFromYMD(ymd) {
  if (!ymd) return null;
  const [year, month, day] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.toISOString();
}

/**
 * Takes a "YYYY-MM-DD" string and returns an ISO string
 * that is `daysToAdd` days later.
 */
function addDaysISO(ymd, daysToAdd) {
  if (!ymd) return null;
  const [year, month, day] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + daysToAdd);
  return dt.toISOString();
}

// ---- Load students.json ----

const studentsPath = path.join(__dirname, 'students.json');
const raw = fs.readFileSync(studentsPath, 'utf8');
const students = JSON.parse(raw);

console.log(`Loaded ${students.length} students from students.json`);

// ---- Prepare INSERT statement ----
// Schema (from db.js):
//   firstName, lastName, idNumber, counselor, program,
//   dayin, dayout,
//   isFelon, onProbation, usesNicotine, hasDriverLicense,
//   foodAllergies, beeAllergies

const insertStmt = db.prepare(`
  INSERT INTO students (
    firstName,
    lastName,
    idNumber,
    counselor,
    program,
    dayin,
    dayout,
    isFelon,
    onProbation,
    usesNicotine,
    hasDriverLicense,
    foodAllergies,
    beeAllergies
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Optional: uncomment this if you want to clear existing students first
// console.log('Clearing existing students table...');
// db.prepare('DELETE FROM students').run();

// ---- Wrap inserts in a transaction for speed & safety ----

const insertMany = db.transaction((rows) => {
  for (const s of rows) {
    try {
      const dayInISO = toISOFromYMD(s.dayin);
      const dayOutISO = addDaysISO(s.dayin, 65);

      if (!dayInISO || !dayOutISO) {
        console.warn(
          `Skipping student ${s.firstName} ${s.lastName} (idNumber: ${s.idNumber}) due to invalid date:`,
          s.dayin
        );
        continue;
      }

      insertStmt.run(
        s.firstName,
        s.lastName,
        s.idNumber,
        s.counselor,
        s.program,
        dayInISO,
        dayOutISO,
        0, // isFelon
        0, // onProbation
        0, // usesNicotine
        0, // hasDriverLicense
        0, // foodAllergies
        0  // beeAllergies
      );
    } catch (err) {
      console.error(
        `Error inserting student ${s.firstName} ${s.lastName} (idNumber: ${s.idNumber}):`,
        err.message
      );
    }
  }
});

// ---- Run it ----

insertMany(students);

console.log('Seeding complete!');
