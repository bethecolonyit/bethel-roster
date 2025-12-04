// seed-students.js
const Database = require("better-sqlite3");
const db = new Database("./database.db");

// -----------------------------
// Utility functions
// -----------------------------
function randomBoolInt() {
  // SQLite prefers numbers for BOOLEAN fields (0/1)
  return Math.random() < 0.5 ? 1 : 0;
}

function randomDate(start, end) {
  const date = new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// -----------------------------
// Seed Data
// -----------------------------
const firstNames = [
  "John", "Michael", "David", "James", "Daniel", "Chris", "Robert", "Joseph",
  "Anthony", "Matthew", "Andrew", "Joshua", "Ethan", "Logan", "Noah", "Caleb",
  "Ryan", "Alex", "Tyler", "Zachary"
];

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis",
  "Garcia", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
  "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"
];

const counselors = [
  "Pastor Paul", "Pastor David", "Pastor Jonathan", "Pastor Aaron",
  "Pastor Sam", "Pastor Tim"
];

const programs = [
  "Men's Program", "Women's Program", "Overcomers"
];

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

// -----------------------------
// Insert Students
// -----------------------------
const insert = db.prepare(`
  INSERT INTO students (
    firstName, lastName, idNumber, counselor, program, dayin,
    isFelon, onProbation, usesNicotine, hasDriverLicense,
    foodAllergies, beeAllergies
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (let i = 1; i <= 40; i++) {
  const first = pickRandom(firstNames);
  const last = pickRandom(lastNames);

  insert.run(
    first,
    last,
    `STU-${1000 + i}`,                                // idNumber
    pickRandom(counselors),
    pickRandom(programs),
    randomDate(new Date(2023, 0, 1), new Date()),     // dayin
    randomBoolInt(),                                  // isFelon
    randomBoolInt(),                                  // onProbation
    randomBoolInt(),                                  // usesNicotine
    randomBoolInt(),                                  // hasDriverLicense
    randomBoolInt(),                                  // foodAllergies
    randomBoolInt()                                   // beeAllergies
  );
}

console.log("✔ Seeded 40 students successfully!");
db.close();
