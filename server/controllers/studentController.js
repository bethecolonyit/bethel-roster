// controllers/studentController.js
const fs = require('fs');
const { ensureAuthenticated, ensureOffice } = require('../middleware/auth');

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


  // GET /students/simple
  app.get('/students/simple', ensureAuthenticated, (req, res) => {
    try {
      const rows = db
        .prepare(
          `
        SELECT id, firstName, lastName, idNumber
        FROM students
        ORDER BY lastName COLLATE NOCASE, firstName COLLATE NOCASE;
      `
        )
        .all();

      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch students list' });
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
        firstName, lastName, idNumber, counselor, program, dayin,
        isFelon, onProbation, usesNicotine, hasDriverLicense,
        foodAllergies, beeAllergies
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      firstName,
      lastName,
      idNumber,
      counselor,
      program,
      dayin,
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


  // POST /edit
  app.post('/edit', ensureOffice, (req, res) => {
    try {
      const {
        idNumber,
        roomNumber,
        firstName,
        lastName,
        counselor,
        program,
        dayin,
      } = req.body;

      const stmt = db.prepare(`
        UPDATE students
        SET roomNumber = ?, firstName = ?, lastName = ?, counselor = ?, program = ?, dayin = ?
        WHERE idNumber = ?
      `);

      stmt.run(
        roomNumber,
        firstName,
        lastName,
        counselor,
        program,
        dayin,
        idNumber
      );

      res.send('success');
    } catch (err) {
      console.error(err);
      res.status(500).send('Database update error');
    }
  });

  // DELETE /students
  app.delete('/students', ensureOffice, (req, res) => {
    try {
      const { idNumber } = req.body;

      const stmt = db.prepare(`DELETE FROM students WHERE idNumber = ?`);
      stmt.run(idNumber);

      const path = `./public/images/${idNumber}.jpg`;

      fs.unlink(path, err => {
        if (err) {
          console.warn('Image not found or already deleted:', path);
        }
      });

      res.send(`${idNumber} was successfully deleted`);
    } catch (err) {
      console.error(err);
      res.status(500).send('Database delete error');
    }
  });
}

module.exports = registerStudentRoutes;
