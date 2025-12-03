// seed.js
// Run with:  node seed.js

const Database = require('better-sqlite3');
const db = new Database('./mydb.sqlite');

// --- Helper ---
function log(msg) {
  console.log('\x1b[36m%s\x1b[0m', msg); // cyan text
}

log('🌱 Starting seed process...');

// ===========================
// 1. CLEAR TABLES
// ===========================
db.exec(`
  PRAGMA foreign_keys = OFF;

  DELETE FROM bed_assignments;
  DELETE FROM beds;
  DELETE FROM rooms;
  DELETE FROM buildings;
  DELETE FROM students;   -- optional: remove if you don’t want student table reset

  PRAGMA foreign_keys = ON;
`);

log('✔ Cleared existing residential data.');


// ===========================
// 2. INSERT BUILDINGS
// ===========================
const buildings = [
  { buildingName: 'Men\'s Dorm A' },
  { buildingName: 'Men\'s Dorm B' },
];

const insertBuilding = db.prepare(`
  INSERT INTO buildings (buildingName) VALUES (?);
`);

buildings.forEach(b => insertBuilding.run(b.buildingName));

log('✔ Inserted buildings');


// Get building IDs
const buildingRows = db.prepare(`SELECT * FROM buildings;`).all();


// ===========================
// 3. INSERT ROOMS
// ===========================
const roomsToInsert = [
  // Building 1
  { buildingIndex: 0, roomNumber: '101', roomType: 'student' },
  { buildingIndex: 0, roomNumber: '102', roomType: 'student' },
  { buildingIndex: 0, roomNumber: '201', roomType: 'student' },

  // Building 2
  { buildingIndex: 1, roomNumber: '101', roomType: 'student' },
  { buildingIndex: 1, roomNumber: '102', roomType: 'staff' },
];

const insertRoom = db.prepare(`
  INSERT INTO rooms (buildingId, roomNumber, roomType)
  VALUES (?, ?, ?);
`);

roomsToInsert.forEach(r => {
  const buildingId = buildingRows[r.buildingIndex].id;
  insertRoom.run(buildingId, r.roomNumber, r.roomType);
});

log('✔ Inserted rooms');


// Fetch rooms with IDs
const roomRows = db.prepare(`SELECT * FROM rooms;`).all();


// ===========================
// 4. INSERT BEDS
// ===========================
const insertBed = db.prepare(`
  INSERT INTO beds (roomId, bedLetter) VALUES (?, ?);
`);

roomRows.forEach(room => {
  // Give every room 4 beds (A–D) for now
  ['A', 'B', 'C', 'D'].forEach(letter => {
    insertBed.run(room.id, letter);
  });
});

log('✔ Inserted beds for every room');


// ===========================
// 5. OPTIONAL: SEED STUDENTS
// ===========================

// Only add this if you want to see occupancy in Angular immediately

const students = [
  { firstName: 'John', lastName: 'Doe', idNumber: 'M25-001' },
  { firstName: 'David', lastName: 'Smith', idNumber: 'M25-002' },
  { firstName: 'Michael', lastName: 'Reed', idNumber: 'M25-003' },
];

const insertStudent = db.prepare(`
  INSERT INTO students (firstName, lastName, idNumber)
  VALUES (?, ?, ?);
`);

students.forEach(s =>
  insertStudent.run(s.firstName, s.lastName, s.idNumber)
);

log('✔ Inserted sample students');

const studentRows = db.prepare(`SELECT * FROM students;`).all();


// ===========================
// 6. OPTIONAL: ASSIGN STUDENTS TO BEDS
// ===========================

const beds = db.prepare(`SELECT * FROM beds ORDER BY id LIMIT 3;`).all();

const insertAssignment = db.prepare(`
  INSERT INTO bed_assignments (bed_id, student_id, start_date, end_date)
  VALUES (?, ?, DATE('now'), NULL);
`);

insertAssignment.run(beds[0].id, studentRows[0].id);
insertAssignment.run(beds[1].id, studentRows[1].id);
insertAssignment.run(beds[2].id, studentRows[2].id);

log('✔ Assigned 3 students to 3 beds');


// DONE
log('🌱 Seed complete!\n');
