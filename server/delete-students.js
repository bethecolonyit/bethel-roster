// seed-students.js
const Database = require("better-sqlite3");
const db = new Database("./mydb.sqlite");

// -----------------------------
// Create Table
// -----------------------------
db.prepare(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    idNumber TEXT,
    counselor TEXT,
    program TEXT,
    dayin DATE,
    isFelon BOOLEAN,
    onProbation BOOLEAN,
    usesNicotine BOOLEAN,
    hasDriverLicense BOOLEAN,
    foodAllergies BOOLEAN,
    beeAllergies BOOLEAN
  )
`).run();

// -----------------------------
// Clear existing data
// -----------------------------
db.prepare("DELETE FROM students").run();



console.log("✔ Deleted all students successfully!");
db.close();
