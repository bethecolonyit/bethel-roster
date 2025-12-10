// controllers/studentController.js
const fs = require('fs');
const { ensureAuthenticated, ensureOffice } = require('../middleware/auth');
const { json } = require('stream/consumers');

function registerStudentRoutes(app, db, upload) {
  // GET /students
app.get('/students', ensureAuthenticated, (req, res) => {
  try {
    const stmt = db.prepare(`SELECT * FROM students`);
    const students = stmt.all();
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database read error' });
  }
});
app.get('/students/:id', ensureAuthenticated, (req, res) => {
   try {
    const { id } = req.params;

    const stmt = db.prepare(`
      SELECT
        s.id,
        s.firstName,
        s.lastName,
        s.program,
        s.idNumber,
        s.counselor,
        s.dayIn,
        s.dayOut,
        s.isFelon,
        s.onProbation,
        s.usesNicotine,
        s.hasDriverLicense,
        s.foodAllergies,
        s.beeAllergies,
        r.roomNumber    AS roomNumber,
        b.bedLetter     AS bedLetter,
        bu.buildingName AS buildingName
      FROM students s
      LEFT JOIN bed_assignments ba
        ON ba.student_id = s.id
        AND ba.end_date IS NULL
      LEFT JOIN beds b
        ON b.id = ba.bed_id
      LEFT JOIN rooms r
        ON r.id = b.roomId
      LEFT JOIN buildings bu
        ON bu.id = r.buildingId
      WHERE s.id = ?
      LIMIT 1
    `);

    const row = stmt.get(id);

    if (!row) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(row);
  } catch (err) {
    console.error('Error fetching student with room info', err);
    res.status(500).json({ error: 'Failed to load student' });
  }
});

app.get('/students/simple', ensureAuthenticated, (req, res) => {
  try {
    const stmt = db.prepare(`SELECT id, firstName, lastName FROM students`);
    const students = stmt.all();
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database read error' });
  }
});

// students.controller.js (or wherever your routes live)
app.get('/students-with-rooms', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT
        s.id,
        s.firstName,
        s.lastName,
        s.program,
        s.idNumber,
        s.counselor,
        s.dayIn,
        s.dayOut,
        s.isFelon,
        s.onProbation,
        s.usesNicotine,
        s.hasDriverLicense,
        s.foodAllergies,
        s.beeAllergies,
        r.roomNumber AS roomNumber,
        b.bedLetter  AS bedLetter,
        bu.buildingName AS buildingName
      FROM students s
      LEFT JOIN bed_assignments ba
        ON ba.student_id = s.id
        AND ba.end_date IS NULL
      LEFT JOIN beds b
        ON b.id = ba.bed_id
      LEFT JOIN rooms r
        ON r.id = b.roomId
      LEFT JOIN buildings bu
        ON bu.id = r.buildingId
      ORDER BY s.lastName, s.firstName
    `);

    const rows = stmt.all();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching students with room info', err);
    res.status(500).json({ error: 'Failed to load students' });
  }
});

  // POST /students
app.post('/students', ensureOffice, upload.single('photo'), (req, res) => {
  try {
    // Student data comes in via multipart/form-data as a JSON string
    const student = JSON.parse(req.body.data);

    const {
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
    } = student;

    // ---- HANDLE PHOTO UPLOAD ----
    if (!req.file) {
      return res.status(400).json({ error: 'Photo is required' });
    }

    const fs = require('fs');
    const path = require('path');

    const uploadsDir = path.join(__dirname, '../uploads/students');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Rename uploaded file → {idNumber}.jpg
    const newFilename = `${idNumber}.jpg`;
    const newPath = path.join(uploadsDir, newFilename);

    fs.renameSync(req.file.path, newPath);

    // ---- INSERT INTO DATABASE ----
    const stmt = db.prepare(`
      INSERT INTO students (
        firstName, lastName, idNumber, counselor, program, dayin, dayout,
        isFelon, onProbation, usesNicotine, hasDriverLicense,
        foodAllergies, beeAllergies
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      firstName,
      lastName,
      idNumber,
      counselor,
      program,
      dayin,
      dayout,
      isFelon ? 1 : 0,
      onProbation ? 1 : 0,
      usesNicotine ? 1 : 0,
      hasDriverLicense ? 1 : 0,
      foodAllergies ? 1 : 0,
      beeAllergies ? 1 : 0
    );

    res.json({ message: 'Student added successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).send('Database insert error');
  }
});


  // PUT /edit
 app.put('/students/:id', ensureOffice, (req, res) => {
  try {
    const { id } = req.params; // ← primary key (number as a string)

    const {
      idNumber,
      firstName,
      lastName,
      counselor,
      program,
      dayin,
      dayout,
      isFelon,
      onProbation,
      usesNicotine,
      hasDriverLicense,
      foodAllergies,
      beeAllergies,
    } = req.body;

    const stmt = db.prepare(`
      UPDATE students
      SET
        firstName      = ?,
        lastName       = ?,
        counselor      = ?,
        program        = ?,
        dayin          = ?,
        dayout         = ?,
        isFelon        = ?,
        onProbation    = ?,
        usesNicotine   = ?,
        hasDriverLicense = ?,
        foodAllergies  = ?,
        beeAllergies   = ?,
        idNumber       = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      firstName,
      lastName,
      counselor,
      program,
      dayin,
      dayout,
      isFelon ? 1 : 0,
      onProbation ? 1 : 0,
      usesNicotine ? 1 : 0,
      hasDriverLicense ? 1 : 0,
      foodAllergies ? 1 : 0,
      beeAllergies ? 1 : 0,
      idNumber,
      id            // ← WHERE id = ?
    );

    if (result.changes === 0) {
      return res.status(404).send('Student not found');
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Database update error', err);
    res.status(500).send('Database update error');
  }
});


  // DELETE /students
  app.delete('/students/', ensureOffice, (req, res) => {
    try {
      const { id, idNumber } = req.body;

      const stmt = db.prepare(`DELETE FROM students WHERE id = ?`);
      stmt.run(id);

      const path = `./uploads/students/${idNumber}.jpg`;

      fs.unlink(path, err => {
        if (err) {
          console.warn('Image not found or already deleted:', path);
        }
      });

      res.send(`${id} was successfully deleted`);
    } catch (err) {
      console.error(err);
      res.status(500).send('Database delete error');
    }
  });
}

module.exports = registerStudentRoutes;
