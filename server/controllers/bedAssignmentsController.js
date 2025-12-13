// controllers/bedAssignmentsController.js (MSSQL)
const { ensureAuthenticated, ensureOffice } = require('../middleware/auth');

function registerBedAssignmentRoutes(app, db) {
  const { sql, query, getPool } = db;

  // POST /residential/bed-assignments
  app.post('/residential/bed-assignments', ensureOffice, async (req, res) => {
    try {
      const { bedId, studentId, startDate } = req.body;

      if (!bedId || !studentId) {
        return res.status(400).json({ error: 'bedId and studentId are required' });
      }

      const bedIdNum = Number(bedId);
      const studentIdNum = Number(studentId);
      const isoDate = (startDate && String(startDate).slice(0, 10)) || new Date().toISOString().slice(0, 10);

      const pool = await getPool();
      const tx = new sql.Transaction(pool);
      await tx.begin();

      try {
        // Validate bed
        const bedR = await new sql.Request(tx)
          .input('bedId', sql.Int, bedIdNum)
          .query(`SELECT id, roomId FROM app.beds WHERE id = @bedId;`);
        if (bedR.recordset.length === 0) {
          await tx.rollback();
          return res.status(400).json({ error: 'Bed not found' });
        }

        // Validate student
        const studentR = await new sql.Request(tx)
          .input('studentId', sql.Int, studentIdNum)
          .query(`SELECT id FROM app.students WHERE id = @studentId;`);
        if (studentR.recordset.length === 0) {
          await tx.rollback();
          return res.status(400).json({ error: 'Student not found' });
        }

        // Bed already occupied?
        const bedOccR = await new sql.Request(tx)
          .input('bedId', sql.Int, bedIdNum)
          .query(`
            SELECT TOP (1) id
            FROM app.bed_assignments
            WHERE bed_id = @bedId AND end_date IS NULL;
          `);
        if (bedOccR.recordset.length > 0) {
          await tx.rollback();
          return res.status(400).json({ error: 'This bed is already occupied' });
        }

        // Student already assigned?
        const studOccR = await new sql.Request(tx)
          .input('studentId', sql.Int, studentIdNum)
          .query(`
            SELECT TOP (1) id, bed_id
            FROM app.bed_assignments
            WHERE student_id = @studentId AND end_date IS NULL;
          `);
        if (studOccR.recordset.length > 0) {
          await tx.rollback();
          return res.status(400).json({
            error: 'Student already has an active bed assignment',
            currentAssignmentId: studOccR.recordset[0].id,
            currentBedId: studOccR.recordset[0].bed_id,
          });
        }

        // Insert assignment
        const insR = await new sql.Request(tx)
          .input('bedId', sql.Int, bedIdNum)
          .input('studentId', sql.Int, studentIdNum)
          .input('startDate', sql.Date, isoDate)
          .query(`
            INSERT INTO app.bed_assignments (bed_id, student_id, start_date, end_date)
            OUTPUT INSERTED.id
            VALUES (@bedId, @studentId, @startDate, NULL);
          `);

        const newId = insR.recordset[0].id;

        // Return assignment detail (same shape you had)
        const outR = await new sql.Request(tx)
          .input('id', sql.Int, newId)
          .query(`
            SELECT
              ba.*,
              s.firstName AS studentFirstName,
              s.lastName  AS studentLastName,
              b.bedLetter,
              r.roomNumber,
              r.roomType,
              bl.buildingName
            FROM app.bed_assignments ba
            JOIN app.students   s  ON ba.student_id = s.id
            JOIN app.beds       b  ON ba.bed_id = b.id
            JOIN app.rooms      r  ON b.roomId = r.id
            JOIN app.buildings  bl ON r.buildingId = bl.id
            WHERE ba.id = @id;
          `);

        await tx.commit();
        res.status(201).json(outR.recordset[0]);
      } catch (inner) {
        try { await tx.rollback(); } catch {}
        throw inner;
      }
    } catch (err) {
      console.error(err);
      // unique violations (if you created filtered unique indexes)
      if (err.number === 2601 || err.number === 2627) {
        return res.status(400).json({
          error: 'Either this bed or this student already has an active assignment',
        });
      }
      res.status(500).json({ error: 'Failed to create bed assignment' });
    }
  });

  // POST /residential/bed-assignments/:id/checkout
  app.post('/residential/bed-assignments/:id/checkout', ensureOffice, async (req, res) => {
    try {
      const { endDate } = req.body || {};
      const id = Number(req.params.id);
      const isoDate = (endDate && String(endDate).slice(0, 10)) || new Date().toISOString().slice(0, 10);

      const pool = await getPool();
      const tx = new sql.Transaction(pool);
      await tx.begin();

      try {
        // Ensure active assignment exists
        const curR = await new sql.Request(tx)
          .input('id', sql.Int, id)
          .query(`
            SELECT *
            FROM app.bed_assignments
            WHERE id = @id AND end_date IS NULL;
          `);

        if (curR.recordset.length === 0) {
          await tx.rollback();
          return res.status(404).json({ error: 'Active bed assignment not found' });
        }

        await new sql.Request(tx)
          .input('id', sql.Int, id)
          .input('endDate', sql.Date, isoDate)
          .query(`
            UPDATE app.bed_assignments
            SET end_date = @endDate
            WHERE id = @id;
          `);

        const outR = await new sql.Request(tx)
          .input('id', sql.Int, id)
          .query(`
            SELECT
              ba.*,
              s.firstName AS studentFirstName,
              s.lastName  AS studentLastName,
              b.bedLetter,
              r.roomNumber,
              r.roomType,
              bl.buildingName
            FROM app.bed_assignments ba
            JOIN app.students   s  ON ba.student_id = s.id
            JOIN app.beds       b  ON ba.bed_id = b.id
            JOIN app.rooms      r  ON b.roomId = r.id
            JOIN app.buildings  bl ON r.buildingId = bl.id
            WHERE ba.id = @id;
          `);

        await tx.commit();
        res.json(outR.recordset[0]);
      } catch (inner) {
        try { await tx.rollback(); } catch {}
        throw inner;
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to end bed assignment' });
    }
  });

  // GET /residential/bed-assignments
  app.get('/residential/bed-assignments', ensureAuthenticated, async (req, res) => {
    try {
      const {
        current = 'true',
        studentId,
        bedId,
        buildingId,
        roomId,
      } = req.query;

      const filters = [];
      const params = {};

      if (current === 'true') filters.push('ba.end_date IS NULL');
      else if (current === 'false') filters.push('ba.end_date IS NOT NULL');

      if (studentId) {
        filters.push('ba.student_id = @studentId');
        params.studentId = { type: sql.Int, value: Number(studentId) };
      }

      if (bedId) {
        filters.push('ba.bed_id = @bedId');
        params.bedId = { type: sql.Int, value: Number(bedId) };
      }

      if (roomId) {
        filters.push('b.roomId = @roomId');
        params.roomId = { type: sql.Int, value: Number(roomId) };
      }

      if (buildingId) {
        filters.push('r.buildingId = @buildingId');
        params.buildingId = { type: sql.Int, value: Number(buildingId) };
      }

      const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

      const r = await query(
        `
        SELECT
          ba.*,
          s.firstName AS studentFirstName,
          s.lastName  AS studentLastName,
          b.bedLetter,
          r.roomNumber,
          r.roomType,
          bl.buildingName
        FROM app.bed_assignments ba
        JOIN app.students   s  ON ba.student_id = s.id
        JOIN app.beds       b  ON ba.bed_id = b.id
        JOIN app.rooms      r  ON b.roomId = r.id
        JOIN app.buildings  bl ON r.buildingId = bl.id
        ${whereClause}
        ORDER BY bl.buildingName, r.roomNumber, b.bedLetter, ba.start_date;
        `,
        params
      );

      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch bed assignments' });
    }
  });

  // GET /residential/available-beds
  app.get('/residential/available-beds', ensureAuthenticated, async (req, res) => {
    try {
      const { buildingId, roomId, roomType } = req.query;

      const filters = [];
      const params = {};

      if (roomId) {
        filters.push('r.id = @roomId');
        params.roomId = { type: sql.Int, value: Number(roomId) };
      }

      if (buildingId) {
        filters.push('bl.id = @buildingId');
        params.buildingId = { type: sql.Int, value: Number(buildingId) };
      }

      if (roomType) {
        filters.push('r.roomType = @roomType');
        params.roomType = { type: sql.NVarChar(20), value: String(roomType) };
      }

      const whereClause = filters.length ? `AND ${filters.join(' AND ')}` : '';

      const r = await query(
        `
        SELECT
          b.id         AS bedId,
          b.bedLetter,
          r.id         AS roomId,
          r.roomNumber,
          r.roomType,
          bl.id        AS buildingId,
          bl.buildingName
        FROM app.beds b
        JOIN app.rooms      r  ON b.roomId = r.id
        JOIN app.buildings  bl ON r.buildingId = bl.id
        LEFT JOIN app.bed_assignments ba
          ON ba.bed_id = b.id AND ba.end_date IS NULL
        WHERE ba.id IS NULL
        ${whereClause}
        ORDER BY bl.buildingName, r.roomNumber, b.bedLetter;
        `,
        params
      );

      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch available beds' });
    }
  });

  // GET /residential/students/:id/current-bed
  app.get('/residential/students/:id/current-bed', ensureAuthenticated, async (req, res) => {
    try {
      const studentId = Number(req.params.id);

      const r = await query(
        `
        SELECT TOP (1)
          ba.*,
          b.bedLetter,
          r.roomNumber,
          r.roomType,
          bl.buildingName
        FROM app.bed_assignments ba
        JOIN app.beds      b  ON ba.bed_id = b.id
        JOIN app.rooms     r  ON b.roomId = r.id
        JOIN app.buildings bl ON r.buildingId = bl.id
        WHERE ba.student_id = @studentId
          AND ba.end_date IS NULL;
        `,
        { studentId: { type: sql.Int, value: studentId } }
      );

      const row = r.recordset[0];
      res.json(row || null);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch current bed' });
    }
  });
}

module.exports = registerBedAssignmentRoutes;
