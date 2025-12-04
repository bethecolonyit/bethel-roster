// controllers/bedAssignmentsController.js
const { ensureAuthenticated, ensureOffice} = require('../middleware/auth');
function registerBedAssignmentRoutes(app, db) {
  // POST /residential/bed-assignments
  app.post('/residential/bed-assignments', ensureOffice, (req, res) => {
    try {
      const { bedId, studentId, startDate } = req.body;

      if (!bedId || !studentId) {
        return res
          .status(400)
          .json({ error: 'bedId and studentId are required' });
      }

      const bed = db
        .prepare('SELECT id, roomId FROM beds WHERE id = ?;')
        .get(bedId);
      if (!bed) {
        return res.status(400).json({ error: 'Bed not found' });
      }

      const student = db
        .prepare('SELECT id FROM students WHERE id = ?;')
        .get(studentId);
      if (!student) {
        return res.status(400).json({ error: 'Student not found' });
      }

      const currentBedAssignment = db
        .prepare(`
          SELECT id
          FROM bed_assignments
          WHERE bed_id = ? AND end_date IS NULL;
        `)
        .get(bedId);

      if (currentBedAssignment) {
        return res
          .status(400)
          .json({ error: 'This bed is already occupied' });
      }

      const currentStudentAssignment = db
        .prepare(`
          SELECT ba.id, ba.bed_id
          FROM bed_assignments ba
          WHERE ba.student_id = ? AND ba.end_date IS NULL;
        `)
        .get(studentId);

      if (currentStudentAssignment) {
        return res.status(400).json({
          error: 'Student already has an active bed assignment',
          currentAssignmentId: currentStudentAssignment.id,
          currentBedId: currentStudentAssignment.bed_id,
        });
      }

      const isoDate = startDate || new Date().toISOString().slice(0, 10);

      const insert = db.prepare(`
        INSERT INTO bed_assignments (bed_id, student_id, start_date, end_date)
        VALUES (?, ?, ?, NULL);
      `);

      const info = insert.run(bedId, studentId, isoDate);

      const assignment = db
        .prepare(`
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
        `)
        .get(info.lastInsertRowid);

      res.status(201).json(assignment);
    } catch (err) {
      console.error(err);
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({
          error:
            'Either this bed or this student already has an active assignment',
        });
      }

      res.status(500).json({ error: 'Failed to create bed assignment' });
    }
  });

  // POST /residential/bed-assignments/:id/checkout
  app.post('/residential/bed-assignments/:id/checkout', ensureOffice, (req, res) => {
    try {
      const { endDate } = req.body || {};
      const id = req.params.id;

      const current = db
        .prepare(`
          SELECT *
          FROM bed_assignments
          WHERE id = ? AND end_date IS NULL;
        `)
        .get(id);

      if (!current) {
        return res
          .status(404)
          .json({ error: 'Active bed assignment not found' });
      }

      const isoDate = endDate || new Date().toISOString().slice(0, 10);

      const update = db.prepare(`
        UPDATE bed_assignments
        SET end_date = ?
        WHERE id = ?;
      `);

      update.run(isoDate, id);

      const updated = db
        .prepare(`
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
        `)
        .get(id);

      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to end bed assignment' });
    }
  });

  // GET /residential/bed-assignments
  app.get('/residential/bed-assignments', ensureAuthenticated, (req, res) => {
    try {
      const {
        current = 'true',
        studentId,
        bedId,
        buildingId,
        roomId,
      } = req.query;

      const filters = [];
      const params = [];

      if (current === 'true') {
        filters.push('ba.end_date IS NULL');
      } else if (current === 'false') {
        filters.push('ba.end_date IS NOT NULL');
      }

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

      const whereClause = filters.length
        ? `WHERE ${filters.join(' AND ')}`
        : '';

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

  // GET /residential/available-beds
  app.get('/residential/available-beds', ensureAuthenticated, (req, res) => {
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

      const whereClause = filters.length
        ? `AND ${filters.join(' AND ')}`
        : '';

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

  // GET /residential/students/:id/current-bed
  app.get('/residential/students/:id/current-bed', ensureAuthenticated, (req, res) => {
    try {
      const studentId = req.params.id;

      const row = db
        .prepare(`
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
        `)
        .get(studentId);

      if (!row) {
        return res.json(null);
      }

      res.json(row);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch current bed' });
    }
  });
}

module.exports = registerBedAssignmentRoutes;
