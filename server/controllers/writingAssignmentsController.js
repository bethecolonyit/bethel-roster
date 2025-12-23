// controllers/writingAssignmentsController.js (MSSQL)
const { ensureAuthenticated, ensureOffice } = require('../middleware/auth');

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

  // ISO / datetime string: extract UTC date to avoid local TZ shifting
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function registerWritingAssignmentRoutes(app, db) {
  const { sql, query } = db;

  function toListItem(row) {
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      scripture: row.scripture,
      infraction: row.infraction,
      issuedBy: row.issuedBy,
      dateIssued: row.dateIssued,
      dateDue: row.dateDue,
      isComplete: row.isComplete,
      demerits: row.demerits
    };
  }

  function baseSelect(whereSql = '') {
    return `
      SELECT
        wa.id,
        s.firstName,
        s.lastName,
        wa.scripture,
        wa.infraction,
        CONCAT(e.firstName, ' ', e.lastName) AS issuedBy,
        wa.dateIssued,
        wa.dateDue,
        wa.isComplete,
        wa.demerits
      FROM app.writing_assignments wa
      INNER JOIN app.students s
        ON s.id = wa.studentId
      LEFT JOIN app.employees e
        ON e.userId = wa.userId
      ${whereSql}
      ORDER BY wa.dateDue ASC, wa.id DESC
    `;
  }

  // GET /api/writing-assignments
  app.get('/writing-assignments', ensureAuthenticated, async (req, res) => {
    try {
      const studentId = req.query.studentId ? Number(req.query.studentId) : null;
      const userId = req.query.userId ? Number(req.query.userId) : null;

      let isComplete = null;
      if (typeof req.query.isComplete === 'string') {
        const v = req.query.isComplete.toLowerCase().trim();
        if (v === 'true' || v === '1') isComplete = true;
        if (v === 'false' || v === '0') isComplete = false;
      }

      const where = [];
      const params = {};

      if (studentId !== null && Number.isInteger(studentId)) {
        where.push('wa.studentId = @studentId');
        params.studentId = { type: sql.Int, value: studentId };
      }

      if (userId !== null && Number.isInteger(userId)) {
        where.push('wa.userId = @userId');
        params.userId = { type: sql.Int, value: userId };
      }

      if (isComplete !== null) {
        where.push('wa.isComplete = @isComplete');
        params.isComplete = { type: sql.Bit, value: isComplete };
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const r = await query(baseSelect(whereSql), params);
      res.json((r.recordset || []).map(toListItem));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database read error' });
    }
  });

  // GET /api/writing-assignments/:studentId
  app.get('/writing-assignments/:studentId', ensureAuthenticated, async (req, res) => {
    try {
      const studentId = Number(req.params.studentId);
      if (!Number.isInteger(studentId)) {
        return res.status(400).json({ error: 'Invalid studentId' });
      }

      const r = await query(
        baseSelect('WHERE wa.studentId = @studentId'),
        { studentId: { type: sql.Int, value: studentId } }
      );

      res.json((r.recordset || []).map(toListItem));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database read error' });
    }
  });

  // POST /api/writing-assignments
  // Returns created WritingAssignmentListItem
  const multer = require('multer');
  const upload = multer();

  app.post('/writing-assignments', ensureAuthenticated, upload.none(), async (req, res) => {
    try {
      // Secure userId from session (do NOT trust client)
      const sessionUserId = req.session?.userId;
      if (!sessionUserId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const {
        studentId,
        dateIssued,
        dateDue,
        infraction,
        scripture,
        demerits,
        isComplete
      } = req.body ?? {};

      if (!studentId || !dateIssued || !dateDue) {
        return res
          .status(400)
          .json({ error: 'studentId, dateIssued, and dateDue are required' });
      }

      const parsedStudentId = Number(studentId);
      if (!Number.isFinite(parsedStudentId)) {
        return res.status(400).json({ error: 'studentId must be a number' });
      }

      const issuedDateOnly = toDateOnlyString(dateIssued);
      const dueDateOnly = toDateOnlyString(dateDue);

      if (!issuedDateOnly || !dueDateOnly) {
        return res.status(400).json({ error: 'dateIssued/dateDue must be valid dates' });
      }

      const parsedDemerits = Number(demerits);
      const safeDemerits = Number.isFinite(parsedDemerits) ? parsedDemerits : 0;

      // multipart/form-data sends strings; avoid !!"false" === true
      const safeIsComplete =
        isComplete === true ||
        isComplete === 'true' ||
        isComplete === '1' ||
        isComplete === 1;

      const insertResult = await query(
        `
        INSERT INTO app.writing_assignments (
          userId, studentId, dateIssued, dateDue, infraction, scripture, demerits, isComplete
        )
        OUTPUT INSERTED.id
        VALUES (
          @userId, @studentId, CAST(@dateIssued AS date), CAST(@dateDue AS date),
          @infraction, @scripture, @demerits, @isComplete
        )
        `,
        {
          userId: { type: sql.Int, value: Number(sessionUserId) },
          studentId: { type: sql.Int, value: parsedStudentId },

          // ✅ bind as text; SQL does date conversion (timezone-proof)
          dateIssued: { type: sql.NVarChar(10), value: issuedDateOnly },
          dateDue: { type: sql.NVarChar(10), value: dueDateOnly },

          infraction: { type: sql.NVarChar(sql.MAX), value: infraction ?? null },
          scripture: { type: sql.NVarChar(sql.MAX), value: scripture ?? null },
          demerits: { type: sql.Int, value: safeDemerits },
          isComplete: { type: sql.Bit, value: safeIsComplete }
        }
      );

      const newId = insertResult.recordset?.[0]?.id;
      if (!newId) return res.status(500).json({ error: 'Insert succeeded but no id returned' });

      const r = await query(
        baseSelect('WHERE wa.id = @id'),
        { id: { type: sql.Int, value: Number(newId) } }
      );

      const row = r.recordset?.[0];
      if (!row) return res.status(500).json({ error: 'Created row not found' });

      res.status(201).json(toListItem(row));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database insert error' });
    }
  });

  // PUT /api/writing-assignments/:id
  // Returns updated WritingAssignmentListItem
  app.put('/writing-assignments/:id', ensureOffice, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

      const {
        userId,
        studentId,
        dateIssued,
        dateDue,
        infraction,
        scripture,
        demerits,
        isComplete
      } = req.body;

      const issuedDateOnly = dateIssued != null ? toDateOnlyString(dateIssued) : null;
      const dueDateOnly = dateDue != null ? toDateOnlyString(dateDue) : null;

      // If caller provided dates, they must be valid
      if (dateIssued != null && !issuedDateOnly) {
        return res.status(400).json({ error: 'dateIssued must be a valid date' });
      }
      if (dateDue != null && !dueDateOnly) {
        return res.status(400).json({ error: 'dateDue must be a valid date' });
      }

      // Handle isComplete from JSON clients robustly ("false" should be false)
      const safeIsComplete =
        isComplete == null
          ? null
          : (isComplete === true ||
             isComplete === 'true' ||
             isComplete === '1' ||
             isComplete === 1);

      const updateResult = await query(
        `
        UPDATE app.writing_assignments
        SET
          userId     = COALESCE(@userId, userId),
          studentId  = COALESCE(@studentId, studentId),

          -- ✅ timezone-proof date-only writes
          dateIssued = COALESCE(CAST(@dateIssued AS date), dateIssued),
          dateDue    = COALESCE(CAST(@dateDue AS date), dateDue),

          infraction = COALESCE(@infraction, infraction),
          scripture  = COALESCE(@scripture, scripture),
          demerits   = COALESCE(@demerits, demerits),
          isComplete = CASE WHEN @isComplete IS NULL THEN isComplete ELSE @isComplete END
        WHERE id = @id
        `,
        {
          id: { type: sql.Int, value: id },
          userId: { type: sql.Int, value: userId == null ? null : Number(userId) },
          studentId: { type: sql.Int, value: studentId == null ? null : Number(studentId) },

          // ✅ bind as text; SQL does date conversion
          dateIssued: { type: sql.NVarChar(10), value: issuedDateOnly },
          dateDue: { type: sql.NVarChar(10), value: dueDateOnly },

          infraction: { type: sql.NVarChar(sql.MAX), value: infraction ?? null },
          scripture: { type: sql.NVarChar(sql.MAX), value: scripture ?? null },
          demerits: { type: sql.Int, value: demerits == null ? null : Number(demerits) },
          isComplete: { type: sql.Bit, value: safeIsComplete }
        }
      );

      if (!updateResult.rowsAffected || updateResult.rowsAffected[0] === 0) {
        return res.status(404).json({ error: 'Writing assignment not found' });
      }

      const r = await query(
        baseSelect('WHERE wa.id = @id'),
        { id: { type: sql.Int, value: id } }
      );

      const row = r.recordset?.[0];
      if (!row) return res.status(500).json({ error: 'Updated row not found' });

      res.json(toListItem(row));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database update error' });
    }
  });

  // DELETE /api/writing-assignments (expects JSON body { id })
  // Returns TEXT to match Angular deleteWritingAssignment(): responseType 'text'
  app.delete('/writing-assignments', ensureOffice, async (req, res) => {
    try {
      const { id } = req.body;
      const numericId = Number(id);

      if (!Number.isInteger(numericId)) {
        return res.status(400).json({ error: 'id is required' });
      }

      const r = await query(
        `DELETE FROM app.writing_assignments WHERE id=@id`,
        { id: { type: sql.Int, value: numericId } }
      );

      if (!r.rowsAffected || r.rowsAffected[0] === 0) {
        return res.status(404).json({ error: 'Writing assignment not found' });
      }

      res.type('text').send(`${numericId} was successfully deleted`);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database delete error' });
    }
  });
}

module.exports = registerWritingAssignmentRoutes;
