// controllers/studentController.js (MSSQL)
const fs = require('fs');
const path = require('path');
const { ensureAuthenticated, ensureOffice, ensureAnyRole } = require('../middleware/auth');

/**
 * Convert incoming date-ish values to a DATE-ONLY string "YYYY-MM-DD".
 */
function toDateOnlyString(value) {
  if (value == null || value === '') return null;

  // JS Date
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof value !== 'string') {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const s = value.trim();
  if (!s) return null;

  // Already date-only
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m1) return s;

  // ISO -> extract UTC date
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
      const r = await query(`
        SELECT id, firstName, lastName, counselor, pastorId
        FROM app.students
      `);
      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database read error' });
    }
  });

  // GET /students/:id (with room + pastor name)
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
          s.pastorId,
          p.fullName AS pastorName,
          s.dayin,
          s.dayout,
          s.isFelon,
          s.onProbation,
          s.usesNicotine,
          s.hasDriverLicense,
          s.foodAllergies,
          s.beeAllergies,
          s.enrolledInGed,
          s.tutoring,
          r.roomNumber    AS roomNumber,
          b.bedLetter     AS bedLetter,
          bu.buildingName AS buildingName
        FROM app.students s
        LEFT JOIN app.pastors p
          ON p.id = s.pastorId
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

  // GET /students-with-rooms (with pastor name)
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
          s.pastorId,
          p.fullName AS pastorName,
          s.dayin,
          s.dayout,
          s.isFelon,
          s.onProbation,
          s.usesNicotine,
          s.hasDriverLicense,
          s.foodAllergies,
          s.beeAllergies,
          s.enrolledInGed,
          s.tutoring,
          r.roomNumber AS roomNumber,
          b.bedLetter  AS bedLetter,
          bu.buildingName AS buildingName,
          COALESCE(wa.totalDemerits, 0) AS totalDemerits
        FROM app.students s
        LEFT JOIN app.pastors p
          ON p.id = s.pastorId
        LEFT JOIN app.bed_assignments ba
          ON ba.student_id = s.id
          AND ba.end_date IS NULL
        LEFT JOIN app.beds b
          ON b.id = ba.bed_id
        LEFT JOIN app.rooms r
          ON r.id = b.roomId
        LEFT JOIN app.buildings bu
          ON bu.id = r.buildingId
        LEFT JOIN (
          SELECT
            studentId,
            SUM(COALESCE(demerits, 0)) AS totalDemerits
          FROM app.writing_assignments
          GROUP BY studentId
        ) wa
          ON wa.studentId = s.id
        ORDER BY s.firstName, s.lastName;
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
        pastorId,
        program,
        dayin,
        dayout,
        isFelon,
        onProbation,
        usesNicotine,
        hasDriverLicense,
        foodAllergies,
        beeAllergies,
        enrolledInGed,
        tutoring
      } = student;

      if (!req.file) return res.status(400).json({ error: 'Photo is required' });

      const uploadsDir = path.join(__dirname, '..', 'uploads', 'students');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const newFilename = `${idNumber}.jpg`;
      const newPath = path.join(uploadsDir, newFilename);
      fs.renameSync(req.file.path, newPath);

      const dayinDateOnly = toDateOnlyString(dayin);
      const dayoutDateOnly = toDateOnlyString(dayout);

      await query(
        `
        INSERT INTO app.students (
          firstName, lastName, idNumber, counselor, pastorId, program, dayin, dayout,
          isFelon, onProbation, usesNicotine, hasDriverLicense,
          foodAllergies, beeAllergies, enrolledInGed, tutoring
        )
        VALUES (
          @firstName, @lastName, @idNumber, @counselor, @pastorId, @program,
          CAST(@dayin AS date), CAST(@dayout AS date),
          @isFelon, @onProbation, @usesNicotine, @hasDriverLicense,
          @foodAllergies, @beeAllergies, @enrolledInGed, @tutoring
        )
        `,
        {
          firstName: { type: sql.NVarChar(100), value: firstName ?? null },
          lastName: { type: sql.NVarChar(100), value: lastName ?? null },
          idNumber: { type: sql.NVarChar(50), value: idNumber ?? null },
          counselor: { type: sql.NVarChar(100), value: counselor ?? null },
          pastorId: { type: sql.Int, value: Number.isInteger(Number(pastorId)) ? Number(pastorId) : null },
          program: { type: sql.NVarChar(100), value: program ?? null },
          dayin: { type: sql.NVarChar(10), value: dayinDateOnly },
          dayout: { type: sql.NVarChar(10), value: dayoutDateOnly },
          isFelon: { type: sql.Bit, value: !!isFelon },
          onProbation: { type: sql.Bit, value: !!onProbation },
          usesNicotine: { type: sql.Bit, value: !!usesNicotine },
          hasDriverLicense: { type: sql.Bit, value: !!hasDriverLicense },
          foodAllergies: { type: sql.Bit, value: !!foodAllergies },
          beeAllergies: { type: sql.Bit, value: !!beeAllergies },
          enrolledInGed: { type: sql.Bit, value: !!enrolledInGed },
          tutoring: { type: sql.Bit, value: !!tutoring },
        }
      );

      res.json({ message: 'Student added successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).send('Database insert error');
    }
  });

  /**
   * PUT /students/:id
   * IMPORTANT: This endpoint now supports PARTIAL updates safely.
   * We load the current row, merge req.body over it, then update.
   */
  app.put('/students/:id', ensureAnyRole('counseling_coordinator', 'counselor', 'office', 'admin'), async (req, res) => {
    try {
      const id = Number(req.params.id);

      // 1) Load existing student (so partial updates do not null out required fields)
      const existingResult = await query(
        `
        SELECT TOP (1)
          id,
          idNumber,
          firstName,
          lastName,
          counselor,
          pastorId,
          program,
          dayin,
          dayout,
          isFelon,
          onProbation,
          usesNicotine,
          hasDriverLicense,
          foodAllergies,
          beeAllergies,
          enrolledInGed,
          tutoring
        FROM app.students
        WHERE id=@id
        `,
        { id: { type: sql.Int, value: id } }
      );

      const existing = existingResult.recordset[0];
      if (!existing) return res.status(404).send('Student not found');

      // 2) Merge: incoming fields overwrite existing; undefined does NOT overwrite
      const incoming = req.body ?? {};

      const merged = {
        ...existing,
        ...Object.fromEntries(
          Object.entries(incoming).filter(([_, v]) => v !== undefined)
        )
      };

      // 3) Normalize / convert
      const dayinDateOnly = toDateOnlyString(merged.dayin);
      const dayoutDateOnly = toDateOnlyString(merged.dayout);

      const pastorIdValue =
        merged.pastorId === null || merged.pastorId === '' || merged.pastorId === undefined
          ? null
          : Number.isInteger(Number(merged.pastorId))
            ? Number(merged.pastorId)
            : null;

      // 4) Update with merged values
      const r = await query(
        `
        UPDATE app.students
        SET
          firstName=@firstName,
          lastName=@lastName,
          counselor=@counselor,
          pastorId=@pastorId,
          program=@program,
          dayin=CAST(@dayin AS date),
          dayout=CAST(@dayout AS date),
          isFelon=@isFelon,
          onProbation=@onProbation,
          usesNicotine=@usesNicotine,
          hasDriverLicense=@hasDriverLicense,
          foodAllergies=@foodAllergies,
          beeAllergies=@beeAllergies,
          enrolledInGed=@enrolledInGed,
          tutoring=@tutoring,
          idNumber=@idNumber
        WHERE id=@id
        `,
        {
          id: { type: sql.Int, value: id },
          firstName: { type: sql.NVarChar(100), value: merged.firstName ?? null },
          lastName: { type: sql.NVarChar(100), value: merged.lastName ?? null },
          counselor: { type: sql.NVarChar(100), value: merged.counselor ?? null },
          pastorId: { type: sql.Int, value: pastorIdValue },
          program: { type: sql.NVarChar(100), value: merged.program ?? null },
          dayin: { type: sql.NVarChar(10), value: dayinDateOnly },
          dayout: { type: sql.NVarChar(10), value: dayoutDateOnly },
          isFelon: { type: sql.Bit, value: !!merged.isFelon },
          onProbation: { type: sql.Bit, value: !!merged.onProbation },
          usesNicotine: { type: sql.Bit, value: !!merged.usesNicotine },
          hasDriverLicense: { type: sql.Bit, value: !!merged.hasDriverLicense },
          foodAllergies: { type: sql.Bit, value: !!merged.foodAllergies },
          beeAllergies: { type: sql.Bit, value: !!merged.beeAllergies },
          enrolledInGed: { type: sql.Bit, value: !!merged.enrolledInGed },
          tutoring: { type: sql.Bit, value: !!merged.tutoring },
          idNumber: { type: sql.NVarChar(50), value: merged.idNumber ?? null },
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
