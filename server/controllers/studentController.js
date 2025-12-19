// controllers/studentController.js (MSSQL)
const fs = require('fs');
const path = require('path');
const { ensureAuthenticated, ensureOffice } = require('../middleware/auth');

function registerStudentRoutes(app, db, upload) {
  const { sql, query } = db;

  // GET /students
  app.get('/students', ensureAuthenticated, async (req, res) => {
    try {
      const r = await query(`
        SELECT * 
        FROM app.students
        ORDER BY firstName ASC
        `);
      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database read error' });
    }
  });

  // GET /students/simple
  app.get('/students/simple', ensureAuthenticated, async (req, res) => {
    try {
      const r = await query(`SELECT id, firstName, lastName FROM app.students`);
      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database read error' });
    }
  });

  // GET /students/:id (with room info)
  app.get('/students/:id', ensureAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);

      const r = await query(
        `
        SELECT TOP (1)
          s.id,
          s.firstName,
          s.lastName,
          s.program,
          s.idNumber,
          s.counselor,
          s.dayin,
          s.dayout,
          s.isFelon,
          s.onProbation,
          s.usesNicotine,
          s.hasDriverLicense,
          s.foodAllergies,
          s.beeAllergies,
          r.roomNumber    AS roomNumber,
          b.bedLetter     AS bedLetter,
          bu.buildingName AS buildingName
        FROM app.students s
        LEFT JOIN app.bed_assignments ba
          ON ba.student_id = s.id
          AND ba.end_date IS NULL
        LEFT JOIN app.beds b
          ON b.id = ba.bed_id
        LEFT JOIN app.rooms r
          ON r.id = b.roomId
        LEFT JOIN app.buildings bu
          ON bu.id = r.buildingId
        WHERE s.id = @id
        `,
        { id: { type: sql.Int, value: id } }
      );

      const row = r.recordset[0];
      if (!row) return res.status(404).json({ error: 'Student not found' });
      res.json(row);
    } catch (err) {
      console.error('Error fetching student with room info', err);
      res.status(500).json({ error: 'Failed to load student' });
    }
  });

  // GET /students-with-rooms
  app.get('/students-with-rooms', ensureAuthenticated, async (req, res) => {
    try {
      const r = await query(
        `
        SELECT
          s.id,
          s.firstName,
          s.lastName,
          s.program,
          s.idNumber,
          s.counselor,
          s.dayin,
          s.dayout,
          s.isFelon,
          s.onProbation,
          s.usesNicotine,
          s.hasDriverLicense,
          s.foodAllergies,
          s.beeAllergies,
          r.roomNumber AS roomNumber,
          b.bedLetter  AS bedLetter,
          bu.buildingName AS buildingName
        FROM app.students s
        LEFT JOIN app.bed_assignments ba
          ON ba.student_id = s.id
          AND ba.end_date IS NULL
        LEFT JOIN app.beds b
          ON b.id = ba.bed_id
        LEFT JOIN app.rooms r
          ON r.id = b.roomId
        LEFT JOIN app.buildings bu
          ON bu.id = r.buildingId
        ORDER BY s.firstName, s.lastName
        `
      );

      res.json(r.recordset);
    } catch (err) {
      console.error('Error fetching students with room info', err);
      res.status(500).json({ error: 'Failed to load students' });
    }
  });

  // POST /students
  app.post('/students', ensureOffice, upload.single('photo'), async (req, res) => {
    try {
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

      if (!req.file) return res.status(400).json({ error: 'Photo is required' });

      // NOTE: keep your current upload path behavior; your index.js serves /uploads
      const uploadsDir = path.join(__dirname, '..', 'uploads', 'students');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const newFilename = `${idNumber}.jpg`;
      const newPath = path.join(uploadsDir, newFilename);
      fs.renameSync(req.file.path, newPath);

      await query(
        `
        INSERT INTO app.students (
          firstName, lastName, idNumber, counselor, program, dayin, dayout,
          isFelon, onProbation, usesNicotine, hasDriverLicense,
          foodAllergies, beeAllergies
        )
        VALUES (
          @firstName, @lastName, @idNumber, @counselor, @program, @dayin, @dayout,
          @isFelon, @onProbation, @usesNicotine, @hasDriverLicense,
          @foodAllergies, @beeAllergies
        )
        `,
        {
          firstName: { type: sql.NVarChar(100), value: firstName ?? null },
          lastName: { type: sql.NVarChar(100), value: lastName ?? null },
          idNumber: { type: sql.NVarChar(50), value: idNumber ?? null },
          counselor: { type: sql.NVarChar(100), value: counselor ?? null },
          program: { type: sql.NVarChar(100), value: program ?? null },
          dayin: { type: sql.Date, value: dayin ?? null },
          dayout: { type: sql.Date, value: dayout ?? null },
          isFelon: { type: sql.Bit, value: !!isFelon },
          onProbation: { type: sql.Bit, value: !!onProbation },
          usesNicotine: { type: sql.Bit, value: !!usesNicotine },
          hasDriverLicense: { type: sql.Bit, value: !!hasDriverLicense },
          foodAllergies: { type: sql.Bit, value: !!foodAllergies },
          beeAllergies: { type: sql.Bit, value: !!beeAllergies },
        }
      );

      res.json({ message: 'Student added successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).send('Database insert error');
    }
  });

  // PUT /students/:id
  app.put('/students/:id', ensureOffice, async (req, res) => {
    try {
      const id = Number(req.params.id);

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

      const r = await query(
        `
        UPDATE app.students
        SET
          firstName=@firstName,
          lastName=@lastName,
          counselor=@counselor,
          program=@program,
          dayin=@dayin,
          dayout=@dayout,
          isFelon=@isFelon,
          onProbation=@onProbation,
          usesNicotine=@usesNicotine,
          hasDriverLicense=@hasDriverLicense,
          foodAllergies=@foodAllergies,
          beeAllergies=@beeAllergies,
          idNumber=@idNumber
        WHERE id=@id
        `,
        {
          id: { type: sql.Int, value: id },
          firstName: { type: sql.NVarChar(100), value: firstName ?? null },
          lastName: { type: sql.NVarChar(100), value: lastName ?? null },
          counselor: { type: sql.NVarChar(100), value: counselor ?? null },
          program: { type: sql.NVarChar(100), value: program ?? null },
          dayin: { type: sql.Date, value: dayin ?? null },
          dayout: { type: sql.Date, value: dayout ?? null },
          isFelon: { type: sql.Bit, value: !!isFelon },
          onProbation: { type: sql.Bit, value: !!onProbation },
          usesNicotine: { type: sql.Bit, value: !!usesNicotine },
          hasDriverLicense: { type: sql.Bit, value: !!hasDriverLicense },
          foodAllergies: { type: sql.Bit, value: !!foodAllergies },
          beeAllergies: { type: sql.Bit, value: !!beeAllergies },
          idNumber: { type: sql.NVarChar(50), value: idNumber ?? null },
        }
      );

      if (!r.rowsAffected || r.rowsAffected[0] === 0) {
        return res.status(404).send('Student not found');
      }

      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Database update error', err);
      res.status(500).send('Database update error');
    }
  });

  // DELETE /students
  app.delete('/students/', ensureOffice, async (req, res) => {
    try {
      const { id, idNumber } = req.body;

      await query(`DELETE FROM app.students WHERE id=@id`, {
        id: { type: sql.Int, value: Number(id) },
      });

      const imgPath = path.join(__dirname, '..', 'uploads', 'students', `${idNumber}.jpg`);
      fs.unlink(imgPath, err => {
        if (err) console.warn('Image not found or already deleted:', imgPath);
      });

      res.send(`${id} was successfully deleted`);
    } catch (err) {
      console.error(err);
      res.status(500).send('Database delete error');
    }
  });
}

module.exports = registerStudentRoutes;
