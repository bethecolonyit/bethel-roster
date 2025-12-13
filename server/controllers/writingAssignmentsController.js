// controllers/writingAssignmentsController.js (MSSQL)
const { ensureAuthenticated, ensureOffice } = require('../middleware/auth');

function registerWritingAssignmentRoutes(app, db) {
  const { sql, query } = db;

  // GET /writing-assignments
  // Optional filters:
  //   ?studentId=123
  //   ?userId=5
  //   ?isComplete=true|false
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

      const r = await query(
        `
        SELECT
          wa.id,
          wa.userId,
          wa.studentId,
          wa.dateIssued,
          wa.dateDue,
          wa.infraction,
          wa.scripture,
          wa.demerits,
          wa.isComplete
        FROM app.writing_assignments wa
        ${whereSql}
        ORDER BY wa.dateDue ASC, wa.id DESC
        `,
        params
      );

      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database read error' });
    }
  });

  // GET /writing-assignments/:id
  app.get('/writing-assignments/:id', ensureAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

      const r = await query(
        `
        SELECT TOP (1)
          wa.id,
          wa.userId,
          wa.studentId,
          wa.dateIssued,
          wa.dateDue,
          wa.infraction,
          wa.scripture,
          wa.demerits,
          wa.isComplete
        FROM app.writing_assignments wa
        WHERE wa.id = @id
        `,
        { id: { type: sql.Int, value: id } }
      );

      const row = r.recordset[0];
      if (!row) return res.status(404).json({ error: 'Writing assignment not found' });
      res.json(row);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database read error' });
    }
  });

  // POST /writing-assignments
  app.post('/writing-assignments', ensureOffice, async (req, res) => {
    try {
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

      if (!userId || !studentId || !dateIssued || !dateDue) {
        return res
          .status(400)
          .json({ error: 'userId, studentId, dateIssued, and dateDue are required' });
      }

      const issued = new Date(dateIssued);
      const due = new Date(dateDue);
      if (Number.isNaN(issued.getTime()) || Number.isNaN(due.getTime())) {
        return res.status(400).json({ error: 'dateIssued/dateDue must be valid dates' });
      }

      const r = await query(
        `
        INSERT INTO app.writing_assignments (
          userId, studentId, dateIssued, dateDue, infraction, scripture, demerits, isComplete
        )
        OUTPUT INSERTED.id
        VALUES (
          @userId, @studentId, @dateIssued, @dateDue, @infraction, @scripture, @demerits, @isComplete
        )
        `,
        {
          userId: { type: sql.Int, value: Number(userId) },
          studentId: { type: sql.Int, value: Number(studentId) },
          dateIssued: { type: sql.DateTime2, value: issued },
          dateDue: { type: sql.DateTime2, value: due },
          infraction: { type: sql.NVarChar(sql.MAX), value: infraction ?? null },
          scripture: { type: sql.NVarChar(sql.MAX), value: scripture ?? null },
          demerits: { type: sql.Int, value: Number.isFinite(Number(demerits)) ? Number(demerits) : 0 },
          isComplete: { type: sql.Bit, value: !!isComplete }
        }
      );

      const newId = r.recordset?.[0]?.id;
      res.status(201).json({ success: true, id: newId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database insert error' });
    }
  });

  // PUT /writing-assignments/:id
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

      const issued = dateIssued != null ? new Date(dateIssued) : null;
      const due = dateDue != null ? new Date(dateDue) : null;

      if (issued && Number.isNaN(issued.getTime())) {
        return res.status(400).json({ error: 'dateIssued must be a valid date' });
      }
      if (due && Number.isNaN(due.getTime())) {
        return res.status(400).json({ error: 'dateDue must be a valid date' });
      }

      const r = await query(
        `
        UPDATE app.writing_assignments
        SET
          userId     = COALESCE(@userId, userId),
          studentId  = COALESCE(@studentId, studentId),
          dateIssued = COALESCE(@dateIssued, dateIssued),
          dateDue    = COALESCE(@dateDue, dateDue),
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
          dateIssued: { type: sql.DateTime2, value: issued ?? null },
          dateDue: { type: sql.DateTime2, value: due ?? null },

          infraction: { type: sql.NVarChar(sql.MAX), value: infraction ?? null },
          scripture: { type: sql.NVarChar(sql.MAX), value: scripture ?? null },

          demerits: { type: sql.Int, value: demerits == null ? null : Number(demerits) },
          isComplete: { type: sql.Bit, value: isComplete == null ? null : !!isComplete }
        }
      );

      if (!r.rowsAffected || r.rowsAffected[0] === 0) {
        return res.status(404).json({ error: 'Writing assignment not found' });
      }

      res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database update error' });
    }
  });

  // DELETE /writing-assignments  (expects JSON body: { id })
  app.delete('/writing-assignments', ensureOffice, async (req, res) => {
    try {
      const { id } = req.body;
      const numericId = Number(id);

      if (!Number.isInteger(numericId)) return res.status(400).json({ error: 'id is required' });

      const r = await query(
        `DELETE FROM app.writing_assignments WHERE id=@id`,
        { id: { type: sql.Int, value: numericId } }
      );

      if (!r.rowsAffected || r.rowsAffected[0] === 0) {
        return res.status(404).json({ error: 'Writing assignment not found' });
      }

      res.json({ success: true, message: `${numericId} was successfully deleted` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database delete error' });
    }
  });
}

module.exports = registerWritingAssignmentRoutes;
