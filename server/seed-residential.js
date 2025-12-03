// seed-residential.js
// Run with:  node seed-residential.js

const Database = require('better-sqlite3');
const db = new Database('./mydb.sqlite');

// --- Helper ---
function log(msg) {
  console.log('\x1b[36m%s\x1b[0m', msg); // cyan text
}

log('🌱 Starting residential seed process...');

// ===========================
// 1. CLEAR TABLES
// ===========================
db.exec(`
  PRAGMA foreign_keys = OFF;

  DELETE FROM bed_assignments;
  DELETE FROM beds;
  DELETE FROM rooms;
  DELETE FROM buildings;
  DELETE FROM students;   -- remove if you don’t want student table reset

  PRAGMA foreign_keys = ON;
`);

log('✔ Cleared existing residential + student data.');

// ===========================
// 2. INSERT BUILDINGS
// ===========================
const buildings = [
  { buildingName: 'Rock' },
  { buildingName: 'Grace' },
  { buildingName: 'Love' },
  { buildingName: 'Hope' },
  { buildingName: 'Faith' },
];

const insertBuilding = db.prepare(`
  INSERT INTO buildings (buildingName) VALUES (?);
`);

buildings.forEach(b => insertBuilding.run(b.buildingName));

log('✔ Inserted buildings (Rock, Grace, Love, Hope, Faith).');

// Get building IDs
const buildingRows = db.prepare(`SELECT * FROM buildings;`).all();

// ===========================
// 3. INSERT ROOMS
// ===========================
// For each building:
//  - Floors 1–3
//  - Each floor: rooms 01–10  => 101–110, 201–210, 301–310 (student rooms)
//  - One staff room: S1

const insertRoom = db.prepare(`
  INSERT INTO rooms (buildingId, roomNumber, roomType)
  VALUES (?, ?, ?);
`);

buildingRows.forEach(b => {
  // Student rooms: 3 floors, 10 rooms each
  for (let floor = 1; floor <= 3; floor++) {
    for (let r = 1; r <= 10; r++) {
      const roomNumber = `${floor}${r.toString().padStart(2, '0')}`; // e.g., 101, 102 ... 110, 201 ...
      insertRoom.run(b.id, roomNumber, 'student');
    }
  }

  // One staff room per building
  insertRoom.run(b.id, 'S1', 'staff');
});

log('✔ Inserted rooms for each building (30 student rooms + 1 staff room per building).');

// Fetch rooms with IDs
const roomRows = db.prepare(`SELECT * FROM rooms;`).all();

// ===========================
// 4. INSERT BEDS
// ===========================
// - Student rooms: beds A, B
// - Staff rooms: bed A only

const insertBed = db.prepare(`
  INSERT INTO beds (roomId, bedLetter) VALUES (?, ?);
`);

roomRows.forEach(room => {
  if (room.roomType === 'student') {
    ['A', 'B'].forEach(letter => insertBed.run(room.id, letter));
  } else if (room.roomType === 'staff') {
    insertBed.run(room.id, 'A');
  }
});

log('✔ Inserted beds (2 per student room, 1 per staff room).');

// ===========================
// 5. SEED STUDENTS (~30)
// ===========================
const students = [
  { firstName: 'John', lastName: 'Doe', idNumber: 'M25-001' },
  { firstName: 'David', lastName: 'Smith', idNumber: 'M25-002' },
  { firstName: 'Michael', lastName: 'Reed', idNumber: 'M25-003' },
  { firstName: 'Daniel', lastName: 'Brown', idNumber: 'M25-004' },
  { firstName: 'Andrew', lastName: 'Jones', idNumber: 'M25-005' },
  { firstName: 'Paul', lastName: 'Wilson', idNumber: 'M25-006' },
  { firstName: 'Matthew', lastName: 'Taylor', idNumber: 'M25-007' },
  { firstName: 'Mark', lastName: 'Anderson', idNumber: 'M25-008' },
  { firstName: 'Luke', lastName: 'Thomas', idNumber: 'M25-009' },
  { firstName: 'James', lastName: 'Jackson', idNumber: 'M25-010' },
  { firstName: 'Timothy', lastName: 'White', idNumber: 'M25-011' },
  { firstName: 'Peter', lastName: 'Harris', idNumber: 'M25-012' },
  { firstName: 'Nathan', lastName: 'Martin', idNumber: 'M25-013' },
  { firstName: 'Caleb', lastName: 'Thompson', idNumber: 'M25-014' },
  { firstName: 'Ethan', lastName: 'Garcia', idNumber: 'M25-015' },
  { firstName: 'Logan', lastName: 'Martinez', idNumber: 'M25-016' },
  { firstName: 'Joshua', lastName: 'Robinson', idNumber: 'M25-017' },
  { firstName: 'Aaron', lastName: 'Clark', idNumber: 'M25-018' },
  { firstName: 'Samuel', lastName: 'Rodriguez', idNumber: 'M25-019' },
  { firstName: 'Isaac', lastName: 'Lewis', idNumber: 'M25-020' },
  { firstName: 'Noah', lastName: 'Lee', idNumber: 'M25-021' },
  { firstName: 'Elijah', lastName: 'Walker', idNumber: 'M25-022' },
  { firstName: 'Josiah', lastName: 'Hall', idNumber: 'M25-023' },
  { firstName: 'Gavin', lastName: 'Allen', idNumber: 'M25-024' },
  { firstName: 'Cole', lastName: 'Young', idNumber: 'M25-025' },
  { firstName: 'Blake', lastName: 'King', idNumber: 'M25-026' },
  { firstName: 'Zachary', lastName: 'Wright', idNumber: 'M25-027' },
  { firstName: 'Tyler', lastName: 'Scott', idNumber: 'M25-028' },
  { firstName: 'Hunter', lastName: 'Green', idNumber: 'M25-029' },
  { firstName: 'Jordan', lastName: 'Baker', idNumber: 'M25-030' },
];

const insertStudent = db.prepare(`
  INSERT INTO students (firstName, lastName, idNumber)
  VALUES (?, ?, ?);
`);

students.forEach(s => insertStudent.run(s.firstName, s.lastName, s.idNumber));

log('✔ Inserted 30 students.');

const studentRows = db.prepare(`SELECT * FROM students ORDER BY id;`).all();

// ===========================
// 6. ASSIGN SOME STUDENTS TO BEDS
// ===========================
// Take the first 12 student beds (from student rooms) and assign
// the first 12 students to them.

const studentBeds = db.prepare(`
  SELECT beds.id AS bedId
  FROM beds
  JOIN rooms ON beds.roomId = rooms.id
  WHERE rooms.roomType = 'student'
  ORDER BY beds.id
  LIMIT 12;
`).all();

const insertAssignment = db.prepare(`
  INSERT INTO bed_assignments (bed_id, student_id, start_date, end_date)
  VALUES (?, ?, DATE('now'), NULL);
`);

const assignmentsToCreate = Math.min(studentBeds.length, studentRows.length, 12);

for (let i = 0; i < assignmentsToCreate; i++) {
  insertAssignment.run(studentBeds[i].bedId, studentRows[i].id);
}

log(`✔ Assigned ${assignmentsToCreate} students to beds.`);

// DONE
log('🌱 Residential seed complete!\n');
