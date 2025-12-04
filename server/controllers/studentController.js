// controllers/studentController.js
const fs = require('fs');
const { ensureAuthenticated, ensureOffice } = require('../middleware/auth');

function registerStudentRoutes(app, db, upload) {
  // GET /students
  app.get('/students', ensureAuthenticated, (req, res) => {
    try {
      const stmt = db.prepare(
        `SELECT * FROM students ORDER BY lastName ASC`
      );
      const students = stmt.all();
      res.json(students);
    } catch (err) {
      console.error(err);
      res.status(500).send('Database error');
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
      const student = JSON.parse(req.body.data);
      const {
        firstName,
        lastName,
        idNumber,
        roomNumber,
        counselor,
        program,
        dayin,
      } = student;

      const stmt = db.prepare(`
        INSERT INTO students (firstName, lastName, idNumber, roomNumber, counselor, program, dayin)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        firstName,
        lastName,
        idNumber,
        roomNumber,
        counselor,
        program,
        dayin
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
