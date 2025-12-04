const fs = require('fs');
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
    roomNumber TEXT,
    counselor TEXT,
    program TEXT,
    dayin DATE
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




const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcrypt');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/images') // specify the directory where uploaded files will be stored
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname) // specify a unique filename for each uploaded file
    }
});
const upload = multer({ storage: storage });
const app = express();
const port = 3000;
app.listen (port, ()=> {
    console.log(`App listening on port ${port}`)
})
app.use(
  session({
    secret: 'JesusLoves',  
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 } // 2 hours
  })
);
app.use((req, res, next) => {
  const openPaths = ['/login.html', '/auth/login', '/auth/logout'];

  // allow login & auth routes
  if (openPaths.includes(req.path)) {
    return next();
  }

  // allow static assets (adjust paths if needed)
  if (
    req.path.startsWith('/js/') ||
    req.path.startsWith('/css/') ||
    req.path.startsWith('/images/') ||
    req.path.startsWith('/public/')
  ) {
    return next();
  }

  // protect HTML pages: if not logged in, go to login
  if (req.path.endsWith('.html')) {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login.html');
    }
  }

  next();
});

// ⬇️ NOW static files get served, but only after the check above
app.use(express.static('public'));


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors({
  origin: 'http://localhost:4200',  // your Angular dev origin
  credentials: true,               // allow cookies to be sent
}));


function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated' });
}

function ensureAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin only' });
}
function ensureOffice(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  if (req.session && req.session.role === 'office') {
    return next();
  }
  return res.status(403).json({ error: 'Admin only' });
}

// AUTH ROUTES
// POST /auth/login  { email, password }
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // better-sqlite3: sync query using shared db instance
    const stmt = db.prepare(
      'SELECT id, email, password_hash, role FROM users WHERE email = ?'
    );
    const user = stmt.get(email); // returns row or undefined

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // bcrypt.compare is still async, that’s fine
    bcrypt.compare(password, user.password_hash, (bcryptErr, same) => {
      if (bcryptErr) {
        console.error(bcryptErr);
        return res.status(500).json({ error: 'Error checking password' });
      }

      if (!same) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Success: store minimal user info in session
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.email = user.email;

      return res.json({
        id: user.id,
        email: user.email,
        role: user.role
      });
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error' });
  }
});


// POST /auth/logout
app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out' });
  });
});

// GET /auth/me  -> who am I?
app.get('/auth/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(200).json(null);
  }

  res.json({
    id: req.session.userId,
    email: req.session.email,
    role: req.session.role
  });
});

// POST /auth/users  (admin only)
// body: { email, password, role: 'admin' | 'user' }
app.post('/auth/users', ensureAuthenticated, ensureAdmin, (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }

  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or user' });
  }

  bcrypt.hash(password, 10, (hashErr, hash) => {
    if (hashErr) {
      console.error(hashErr);
      return res.status(500).json({ error: 'Error hashing password' });
    }

    try {
      const stmt = db.prepare(
        'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)'
      );
      const info = stmt.run(email, hash, role);

      res.status(201).json({
        id: info.lastInsertRowid,
        email,
        role
      });
    } catch (err) {
      console.error(err);
      if (err.message && err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      return res.status(500).json({ error: 'Database error creating user' });
    }
  });
});
// GET /auth/users  (admin only) - list all users
app.get('/auth/users', ensureAuthenticated, ensureAdmin, (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, email, role, created_at FROM users ORDER BY email ASC');
    const users = stmt.all();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching users' });
  }
});

// PUT /auth/users/:id  (admin only) - update email/role and optionally password
app.put('/auth/users/:id', ensureAuthenticated, ensureAdmin, (req, res) => {
  const { id } = req.params;
  const { email, role, password } = req.body;

  if (!email || !role) {
    return res.status(400).json({ error: 'Email and role are required' });
  }

  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or user' });
  }

  const updateUser = (passwordHash = null) => {
    try {
      let stmt;
      if (passwordHash) {
        stmt = db.prepare(`
          UPDATE users
          SET email = ?, role = ?, password_hash = ?
          WHERE id = ?
        `);
        stmt.run(email, role, passwordHash, id);
      } else {
        stmt = db.prepare(`
          UPDATE users
          SET email = ?, role = ?
          WHERE id = ?
        `);
        stmt.run(email, role, id);
      }

      // return updated record
      const selectStmt = db.prepare('SELECT id, email, role, created_at FROM users WHERE id = ?');
      const user = selectStmt.get(id);
      res.json(user);
    } catch (err) {
      console.error(err);
      if (err.message && err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      res.status(500).json({ error: 'Database error updating user' });
    }
  };

  if (password) {
    bcrypt.hash(password, 10, (hashErr, hash) => {
      if (hashErr) {
        console.error(hashErr);
        return res.status(500).json({ error: 'Error hashing password' });
      }
      updateUser(hash);
    });
  } else {
    updateUser();
  }
});
// POST /auth/users/:id/reset-password  (admin only)
// body: { password: 'newPasswordHere' }
app.post('/auth/users/:id/reset-password', ensureAuthenticated, ensureAdmin, (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || typeof password !== 'string' || password.trim().length < 6) {
    return res.status(400).json({ error: 'A password of at least 6 characters is required' });
  }

  // Hash the new password
  bcrypt.hash(password, 10, (hashErr, hash) => {
    if (hashErr) {
      console.error(hashErr);
      return res.status(500).json({ error: 'Error hashing password' });
    }

    try {
      const stmt = db.prepare(`
        UPDATE users
        SET password_hash = ?
        WHERE id = ?
      `);

      const info = stmt.run(hash, id);

      if (info.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ message: 'Password reset successfully' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error resetting password' });
    }
  });
});

// DELETE /auth/users/:id  (admin only)
app.delete('/auth/users/:id', ensureAuthenticated, ensureAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const info = stmt.run(id);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error deleting user' });
  }
});

// STUDENT ROUTES
app.get('/students', ensureAuthenticated, (req, res) => {
    try {
        const stmt = db.prepare(`SELECT * FROM students ORDER BY lastName ASC`);
        const students = stmt.all();
        res.json(students);
    } catch (err) {
        console.error(err);
        res.status(500).send("Database error");
    }
});
app.get('/students/simple', ensureAuthenticated, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, firstName, lastName, idNumber
      FROM students
      ORDER BY lastName COLLATE NOCASE, firstName COLLATE NOCASE;
    `).all();

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch students list' });
  }
});


app.post('/students', ensureOffice, upload.single('photo'), (req, res) => {
    try {
        const student = JSON.parse(req.body.data);
        const { firstName, lastName, idNumber, roomNumber, counselor, program, dayin } = student;

        const stmt = db.prepare(`
            INSERT INTO students (firstName, lastName, idNumber, roomNumber, counselor, program, dayin)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(firstName, lastName, idNumber, roomNumber, counselor, program, dayin);

        res.json({ message: "Student added successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).send("Database insert error");
    }
});


app.post('/edit', ensureOffice, (req, res) => {
    try {
        const { idNumber, roomNumber, firstName, lastName, counselor, program, dayin } = req.body;

        const stmt = db.prepare(`
            UPDATE students
            SET roomNumber = ?, firstName = ?, lastName = ?, counselor = ?, program = ?, dayin = ?
            WHERE idNumber = ?
        `);

        stmt.run(roomNumber, firstName, lastName, counselor, program, dayin, idNumber);

        res.send("success");
    } catch (err) {
        console.error(err);
        res.status(500).send("Database update error");
    }
});

app.delete('/students', ensureOffice, (req, res) => {
    try {
        const { idNumber } = req.body;

        // Delete from the database
        const stmt = db.prepare(`DELETE FROM students WHERE idNumber = ?`);
        stmt.run(idNumber);

        // Delete image like before
        const path = `./public/images/${idNumber}.jpg`;

        fs.unlink(path, (err) => {
            if (err) {
                console.warn("Image not found or already deleted:", path);
            }
        });

        res.send(`${idNumber} was successfully deleted`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Database delete error");
    }
});
// --- BUILDINGS ---
// GET all buildings
app.get('/residential/buildings', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM buildings ORDER BY buildingName;');
    const buildings = stmt.all();
    res.json(buildings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch buildings' });
  }
});

// GET single building
app.get('/residential/buildings/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM buildings WHERE id = ?;');
    const building = stmt.get(req.params.id);
    if (!building) return res.status(404).json({ error: 'Building not found' });
    res.json(building);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch building' });
  }
});

// CREATE building
app.post('/residential/buildings', (req, res) => {
  try {
    const { buildingName } = req.body;
    if (!buildingName) {
      return res.status(400).json({ error: 'buildingName is required' });
    }
    const stmt = db.prepare('INSERT INTO buildings (buildingName) VALUES (?);');
    const info = stmt.run(buildingName.trim());
    const newBuilding = db.prepare('SELECT * FROM buildings WHERE id = ?;').get(info.lastInsertRowid);
    res.status(201).json(newBuilding);
  } catch (err) {
    console.error(err);
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'A building with that name already exists' });
    }
    res.status(500).json({ error: 'Failed to create building' });
  }
});

// UPDATE building
app.put('/residential/buildings/:id', (req, res) => {
  try {
    const { buildingName } = req.body;
    if (!buildingName) {
      return res.status(400).json({ error: 'buildingName is required' });
    }
    const stmt = db.prepare('UPDATE buildings SET buildingName = ? WHERE id = ?;');
    const info = stmt.run(buildingName.trim(), req.params.id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Building not found' });
    }
    const updated = db.prepare('SELECT * FROM buildings WHERE id = ?;').get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update building' });
  }
});

// DELETE building
app.delete('/residential/buildings/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM buildings WHERE id = ?;');
    const info = stmt.run(req.params.id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Building not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete building' });
  }
});
// --- ROOMS ---
// GET rooms (optionally filter by buildingId)
app.get('/residential/rooms', (req, res) => {
  try {
    const { buildingId } = req.query;
    let rooms;
    if (buildingId) {
      const stmt = db.prepare(`
        SELECT r.*, b.buildingName
        FROM rooms r
        JOIN buildings b ON r.buildingId = b.id
        WHERE r.buildingId = ?
        ORDER BY r.roomNumber;
      `);
      rooms = stmt.all(buildingId);
    } else {
      const stmt = db.prepare(`
        SELECT r.*, b.buildingName
        FROM rooms r
        JOIN buildings b ON r.buildingId = b.id
        ORDER BY b.buildingName, r.roomNumber;
      `);
      rooms = stmt.all();
    }
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// GET single room
app.get('/residential/rooms/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM rooms WHERE id = ?;');
    const room = stmt.get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// CREATE room
app.post('/residential/rooms', (req, res) => {
  try {
    const { buildingId, roomNumber, roomType } = req.body;
    if (!buildingId || !roomNumber || !roomType) {
      return res.status(400).json({ error: 'buildingId, roomNumber, and roomType are required' });
    }

    const stmt = db.prepare(`
      INSERT INTO rooms (buildingId, roomNumber, roomType)
      VALUES (?, ?, ?);
    `);
    const info = stmt.run(buildingId, String(roomNumber).trim(), roomType);

    const newRoom = db.prepare('SELECT * FROM rooms WHERE id = ?;').get(info.lastInsertRowid);
    res.status(201).json(newRoom);
  } catch (err) {
    console.error(err);
    if (err.code === 'SQLITE_CONSTRAINT_CHECK') {
      return res.status(400).json({ error: 'roomType must be student, staff, or vsp' });
    }
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// UPDATE room
app.put('/residential/rooms/:id', (req, res) => {
  try {
    const { buildingId, roomNumber, roomType } = req.body;
    if (!buildingId || !roomNumber || !roomType) {
      return res.status(400).json({ error: 'buildingId, roomNumber, and roomType are required' });
    }

    const stmt = db.prepare(`
      UPDATE rooms
      SET buildingId = ?, roomNumber = ?, roomType = ?
      WHERE id = ?;
    `);
    const info = stmt.run(buildingId, String(roomNumber).trim(), roomType, req.params.id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const updated = db.prepare('SELECT * FROM rooms WHERE id = ?;').get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    if (err.code === 'SQLITE_CONSTRAINT_CHECK') {
      return res.status(400).json({ error: 'roomType must be student, staff, or vsp' });
    }
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// DELETE room
app.delete('/residential/rooms/:id', (req, res) => {
  const roomId = Number(req.params.id);

  try {
    // 1) Make sure the room exists
    const existingRoom = db
      .prepare('SELECT id FROM rooms WHERE id = ?;')
      .get(roomId);

    if (!existingRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // 2) Optional safety: block if any *active* assignment exists in this room
    const activeAssignment = db
      .prepare(`
        SELECT 1
        FROM bed_assignments ba
        JOIN beds b ON ba.bed_id = b.id
        WHERE b.roomId = ? AND ba.end_date IS NULL
        LIMIT 1
      `)
      .get(roomId);

    if (activeAssignment) {
      return res
        .status(400)
        .json({ error: 'Cannot delete a room that has an active bed assignment.' });
    }

    // 3) Delete assignment history for all beds in this room
    db.prepare(`
      DELETE FROM bed_assignments
      WHERE bed_id IN (SELECT id FROM beds WHERE roomId = ?);
    `).run(roomId);

    // 4) Delete all beds in this room
    db.prepare('DELETE FROM beds WHERE roomId = ?;').run(roomId);

    // 5) Delete the room itself
    const info = db
      .prepare('DELETE FROM rooms WHERE id = ?;')
      .run(roomId);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete room' });
  }
});
// --- BEDS ---
// GET beds (optional roomId filter)
app.get('/residential/beds', (req, res) => {
  try {
    const { roomId } = req.query;
    let beds;

    if (roomId) {
      const stmt = db.prepare(`
        SELECT b.*, r.roomNumber, r.roomType, r.buildingId
        FROM beds b
        JOIN rooms r ON b.roomId = r.id
        WHERE b.roomId = ?
        ORDER BY b.bedLetter;
      `);
      beds = stmt.all(roomId);
    } else {
      const stmt = db.prepare(`
        SELECT b.*, r.roomNumber, r.roomType, r.buildingId
        FROM beds b
        JOIN rooms r ON b.roomId = r.id
        ORDER BY r.roomNumber, b.bedLetter;
      `);
      beds = stmt.all();
    }

    res.json(beds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch beds' });
  }
});

// GET single bed
app.get('/residential/beds/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM beds WHERE id = ?;');
    const bed = stmt.get(req.params.id);
    if (!bed) return res.status(404).json({ error: 'Bed not found' });
    res.json(bed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bed' });
  }
});

// CREATE bed
app.post('/residential/beds', (req, res) => {
  try {
    const { roomId, bedLetter } = req.body;
    if (!roomId || !bedLetter) {
      return res.status(400).json({ error: 'roomId and bedLetter are required' });
    }

    const stmt = db.prepare(`
      INSERT INTO beds (roomId, bedLetter)
      VALUES (?, UPPER(?));
    `);
    const info = stmt.run(roomId, bedLetter);
    const newBed = db.prepare('SELECT * FROM beds WHERE id = ?;').get(info.lastInsertRowid);
    res.status(201).json(newBed);
  } catch (err) {
    console.error(err);
    if (err.code === 'SQLITE_CONSTRAINT_CHECK') {
      return res.status(400).json({ error: 'bedLetter must be A, B, C, or D' });
    }
    res.status(500).json({ error: 'Failed to create bed' });
  }
});

// UPDATE bed
app.put('/residential/beds/:id', (req, res) => {
  try {
    const { roomId, bedLetter } = req.body;
    if (!roomId || !bedLetter) {
      return res.status(400).json({ error: 'roomId and bedLetter are required' });
    }

    const stmt = db.prepare(`
      UPDATE beds
      SET roomId = ?, bedLetter = UPPER(?)
      WHERE id = ?;
    `);
    const info = stmt.run(roomId, bedLetter, req.params.id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Bed not found' });
    }

    const updated = db.prepare('SELECT * FROM beds WHERE id = ?;').get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    if (err.code === 'SQLITE_CONSTRAINT_CHECK') {
      return res.status(400).json({ error: 'bedLetter must be A, B, C, or D' });
    }
    res.status(500).json({ error: 'Failed to update bed' });
  }
});

// DELETE bed
app.delete('/residential/beds/:id', (req, res) => {
  const bedId = req.params.id;

  try {
    // 1) Make sure the bed exists
    const existing = db
      .prepare('SELECT id FROM beds WHERE id = ?;')
      .get(bedId);

    if (!existing) {
      return res.status(404).json({ error: 'Bed not found' });
    }

    // 2) Delete all assignment history for this bed
    db.prepare('DELETE FROM bed_assignments WHERE bed_id = ?;').run(bedId);

    // 3) Now delete the bed itself
    const info = db
      .prepare('DELETE FROM beds WHERE id = ?;')
      .run(bedId);

    if (info.changes === 0) {
      // Very unlikely, since we just checked, but safe to keep
      return res.status(404).json({ error: 'Bed not found' });
    }

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete bed' });
  }
});

// --- Bed Assignments ---

app.post('/residential/bed-assignments', (req, res) => {
  try {
    const { bedId, studentId, startDate } = req.body;

    if (!bedId || !studentId) {
      return res.status(400).json({ error: 'bedId and studentId are required' });
    }

    // 1) Ensure bed exists
    const bed = db.prepare('SELECT id, roomId FROM beds WHERE id = ?;').get(bedId);
    if (!bed) {
      return res.status(400).json({ error: 'Bed not found' });
    }

    // 2) Ensure student exists
    const student = db.prepare('SELECT id FROM students WHERE id = ?;').get(studentId);
    if (!student) {
      return res.status(400).json({ error: 'Student not found' });
    }

    // 3) Ensure bed is not currently occupied
    const currentBedAssignment = db.prepare(`
      SELECT id
      FROM bed_assignments
      WHERE bed_id = ? AND end_date IS NULL;
    `).get(bedId);

    if (currentBedAssignment) {
      return res.status(400).json({ error: 'This bed is already occupied' });
    }

    // 4) Ensure student is not currently in another bed
    const currentStudentAssignment = db.prepare(`
      SELECT ba.id, ba.bed_id
      FROM bed_assignments ba
      WHERE ba.student_id = ? AND ba.end_date IS NULL;
    `).get(studentId);

    if (currentStudentAssignment) {
      return res.status(400).json({
        error: 'Student already has an active bed assignment',
        currentAssignmentId: currentStudentAssignment.id,
        currentBedId: currentStudentAssignment.bed_id
      });
    }

    const isoDate = startDate || new Date().toISOString().slice(0, 10);

    // 5) Insert assignment
    const insert = db.prepare(`
      INSERT INTO bed_assignments (bed_id, student_id, start_date, end_date)
      VALUES (?, ?, ?, NULL);
    `);
    const info = insert.run(bedId, studentId, isoDate);

    // 6) Return with context (building / room / bed / student)
    const assignment = db.prepare(`
      SELECT
        ba.*,
        s.firstName AS studentFirstName,
        s.lastName  AS studentLastName,
        b.bedLetter,
        r.roomNumber,
        r.roomType,
        bl.buildingName
      FROM bed_assignments ba
      JOIN students   s  ON ba.student_id = s.id
      JOIN beds       b  ON ba.bed_id = b.id
      JOIN rooms      r  ON b.roomId = r.id
      JOIN buildings  bl ON r.buildingId = bl.id
      WHERE ba.id = ?;
    `).get(info.lastInsertRowid);

    res.status(201).json(assignment);
  } catch (err) {
    console.error(err);

    // Handle UNIQUE index violations nicely
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({
        error: 'Either this bed or this student already has an active assignment'
      });
    }

    res.status(500).json({ error: 'Failed to create bed assignment' });
  }
});
// End (checkout) a bed assignment
app.post('/residential/bed-assignments/:id/checkout', (req, res) => {
  try {
    const { endDate } = req.body || {};
    const id = req.params.id;

    // Make sure assignment exists and is active
    const current = db.prepare(`
      SELECT *
      FROM bed_assignments
      WHERE id = ? AND end_date IS NULL;
    `).get(id);

    if (!current) {
      return res.status(404).json({ error: 'Active bed assignment not found' });
    }

    const isoDate = endDate || new Date().toISOString().slice(0, 10);

    const update = db.prepare(`
      UPDATE bed_assignments
      SET end_date = ?
      WHERE id = ?;
    `);
    update.run(isoDate, id);

    const updated = db.prepare(`
      SELECT
        ba.*,
        s.firstName AS studentFirstName,
        s.lastName  AS studentLastName,
        b.bedLetter,
        r.roomNumber,
        r.roomType,
        bl.buildingName
      FROM bed_assignments ba
      JOIN students   s  ON ba.student_id = s.id
      JOIN beds       b  ON ba.bed_id = b.id
      JOIN rooms      r  ON b.roomId = r.id
      JOIN buildings  bl ON r.buildingId = bl.id
      WHERE ba.id = ?;
    `).get(id);

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to end bed assignment' });
  }
});
// List bed assignments (current by default)
app.get('/residential/bed-assignments', (req, res) => {
  try {
    const {
      current = 'true',
      studentId,
      bedId,
      buildingId,
      roomId
    } = req.query;

    const filters = [];
    const params = [];

    if (current === 'true') {
      filters.push('ba.end_date IS NULL');
    } else if (current === 'false') {
      filters.push('ba.end_date IS NOT NULL');
    } // if current omitted, return ALL (no filter)

    if (studentId) {
      filters.push('ba.student_id = ?');
      params.push(studentId);
    }

    if (bedId) {
      filters.push('ba.bed_id = ?');
      params.push(bedId);
    }

    if (roomId) {
      filters.push('b.roomId = ?');
      params.push(roomId);
    }

    if (buildingId) {
      filters.push('r.buildingId = ?');
      params.push(buildingId);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const stmt = db.prepare(`
      SELECT
        ba.*,
        s.firstName AS studentFirstName,
        s.lastName  AS studentLastName,
        b.bedLetter,
        r.roomNumber,
        r.roomType,
        bl.buildingName
      FROM bed_assignments ba
      JOIN students   s  ON ba.student_id = s.id
      JOIN beds       b  ON ba.bed_id = b.id
      JOIN rooms      r  ON b.roomId = r.id
      JOIN buildings  bl ON r.buildingId = bl.id
      ${whereClause}
      ORDER BY bl.buildingName, r.roomNumber, b.bedLetter, ba.start_date;
    `);

    const rows = stmt.all(...params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bed assignments' });
  }
});
// List beds that are currently available (no active assignment)
app.get('/residential/available-beds', (req, res) => {
  try {
    const { buildingId, roomId, roomType } = req.query;

    const filters = [];
    const params = [];

    if (roomId) {
      filters.push('r.id = ?');
      params.push(roomId);
    }

    if (buildingId) {
      filters.push('bl.id = ?');
      params.push(buildingId);
    }

    if (roomType) {
      filters.push('r.roomType = ?');
      params.push(roomType);
    }

    const whereClause = filters.length ? `AND ${filters.join(' AND ')}` : '';

    const stmt = db.prepare(`
      SELECT
        b.id         AS bedId,
        b.bedLetter,
        r.id         AS roomId,
        r.roomNumber,
        r.roomType,
        bl.id        AS buildingId,
        bl.buildingName
      FROM beds b
      JOIN rooms      r  ON b.roomId = r.id
      JOIN buildings  bl ON r.buildingId = bl.id
      LEFT JOIN bed_assignments ba
        ON ba.bed_id = b.id AND ba.end_date IS NULL
      WHERE ba.id IS NULL
      ${whereClause}
      ORDER BY bl.buildingName, r.roomNumber, b.bedLetter;
    `);

    const rows = stmt.all(...params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch available beds' });
  }
});
// Get the current bed for a student (if any)
app.get('/residential/students/:id/current-bed', (req, res) => {
  try {
    const studentId = req.params.id;

    const row = db.prepare(`
      SELECT
        ba.*,
        b.bedLetter,
        r.roomNumber,
        r.roomType,
        bl.buildingName
      FROM bed_assignments ba
      JOIN beds      b  ON ba.bed_id = b.id
      JOIN rooms     r  ON b.roomId = r.id
      JOIN buildings bl ON r.buildingId = bl.id
      WHERE ba.student_id = ?
        AND ba.end_date IS NULL;
    `).get(studentId);

    if (!row) {
      return res.json(null); // student not currently in a bed
    }

    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch current bed' });
  }
});
// GET /residential/structure
// Returns: buildings -> rooms -> beds + current occupancy
app.get('/residential/structure', (req, res) => {
  try {
    // You can add filters later (e.g., campusId) if needed
    const rows = db.prepare(`
      SELECT
        bl.id          AS buildingId,
        bl.buildingName,

        r.id           AS roomId,
        r.roomNumber,
        r.roomType,

        b.id           AS bedId,
        b.bedLetter,

        ba.id          AS assignmentId,
        ba.start_date  AS assignmentStartDate,
        ba.end_date    AS assignmentEndDate,

        s.id           AS studentId,
        s.firstName    AS studentFirstName,
        s.lastName     AS studentLastName,
        s.idNumber   AS studentCode  -- adjust to your schema if different
      FROM buildings bl
      LEFT JOIN rooms r
        ON r.buildingId = bl.id
      LEFT JOIN beds b
        ON b.roomId = r.id
      LEFT JOIN bed_assignments ba
        ON ba.bed_id = b.id AND ba.end_date IS NULL   -- only current assignment
      LEFT JOIN students s
        ON s.id = ba.student_id
      ORDER BY bl.buildingName, r.roomNumber, b.bedLetter;
    `).all();

    const buildingsMap = new Map();

    for (const row of rows) {
      // ----- BUILDING -----
      let building = buildingsMap.get(row.buildingId);
      if (!building) {
        building = {
          id: row.buildingId,
          buildingName: row.buildingName,
          rooms: [],
          totalBeds: 0,
          occupiedBeds: 0,
          availableBeds: 0, // we'll fill after
        };
        buildingsMap.set(row.buildingId, building);
      }

      // If there is no room yet (building with no rooms), continue
      if (!row.roomId) continue;

      // ----- ROOM -----
      let room = building.rooms.find(r => r.id === row.roomId);
      if (!room) {
        room = {
          id: row.roomId,
          roomNumber: row.roomNumber,
          roomType: row.roomType,
          beds: [],
          totalBeds: 0,
          occupiedBeds: 0,
          availableBeds: 0, // fill after
        };
        building.rooms.push(room);
      }

      // If there is no bed yet (room created, but no beds), continue
      if (!row.bedId) continue;

      // ----- BED + OCCUPANCY -----
      const hasAssignment = !!row.assignmentId;

      const bed = {
        id: row.bedId,
        bedLetter: row.bedLetter,
        occupancy: hasAssignment
          ? {
              assignmentId: row.assignmentId,
              startDate: row.assignmentStartDate,
              student: row.studentId
                ? {
                    id: row.studentId,
                    firstName: row.studentFirstName,
                    lastName: row.studentLastName,
                    studentId: row.studentCode, // external ID/code; adjust to your schema
                  }
                : null,
            }
          : null,
      };

      room.beds.push(bed);

      // Update counts
      room.totalBeds += 1;
      building.totalBeds += 1;

      if (hasAssignment) {
        room.occupiedBeds += 1;
        building.occupiedBeds += 1;
      }
    }

    // Compute availableBeds for each room and building
    for (const building of buildingsMap.values()) {
      for (const room of building.rooms) {
        room.availableBeds = room.totalBeds - room.occupiedBeds;
      }
      building.availableBeds = building.totalBeds - building.occupiedBeds;
    }

    res.json(Array.from(buildingsMap.values()));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch residential structure' });
  }
});







