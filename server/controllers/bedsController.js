// controllers/bedsController.js (MSSQL)
const { ensureAuthenticated, ensureOffice } = require('../middleware/auth');

function registerBedRoutes(app, db) {
  const { sql, query, getPool } = db;

  // GET /residential/beds
  app.get('/residential/beds', ensureAuthenticated, async (req, res) => {
    try {
      const roomId = req.query.roomId ? Number(req.query.roomId) : null;

      if (roomId) {
        const r = await query(
          `
          SELECT b.*, r.roomNumber, r.roomType, r.buildingId
          FROM app.beds b
          JOIN app.rooms r ON b.roomId = r.id
          WHERE b.roomId = @roomId
          ORDER BY b.bedLetter;
          `,
          { roomId: { type: sql.Int, value: roomId } }
        );
        return res.json(r.recordset);
      }

      const r = await query(
        `
        SELECT b.*, r.roomNumber, r.roomType, r.buildingId
        FROM app.beds b
        JOIN app.rooms r ON b.roomId = r.id
        ORDER BY r.roomNumber, b.bedLetter;
        `
      );
      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch beds' });
    }
  });

  // GET /residential/beds/:id
  app.get('/residential/beds/:id', ensureAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);

      const r = await query(
        `SELECT * FROM app.beds WHERE id = @id;`,
        { id: { type: sql.Int, value: id } }
      );

      const bed = r.recordset[0];
      if (!bed) return res.status(404).json({ error: 'Bed not found' });

      res.json(bed);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch bed' });
    }
  });

  // POST /residential/beds
  app.post('/residential/beds', ensureOffice, async (req, res) => {
    try {
      const { roomId, bedLetter } = req.body;

      if (!roomId || !bedLetter) {
        return res.status(400).json({ error: 'roomId and bedLetter are required' });
      }

      const r = await query(
        `
        INSERT INTO app.beds (roomId, bedLetter)
        OUTPUT INSERTED.*
        VALUES (@roomId, UPPER(@bedLetter));
        `,
        {
          roomId: { type: sql.Int, value: Number(roomId) },
          bedLetter: { type: sql.NVarChar(1), value: String(bedLetter).trim() },
        }
      );

      res.status(201).json(r.recordset[0]);
    } catch (err) {
      console.error(err);
      if (err.number === 547 && String(err.message || '').toLowerCase().includes('check')) {
        return res.status(400).json({ error: 'bedLetter must be A, B, C, or D' });
      }
      res.status(500).json({ error: 'Failed to create bed' });
    }
  });

  // PUT /residential/beds/:id
  app.put('/residential/beds/:id', ensureOffice, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { roomId, bedLetter } = req.body;

      if (!roomId || !bedLetter) {
        return res.status(400).json({ error: 'roomId and bedLetter are required' });
      }

      const r = await query(
        `
        UPDATE app.beds
        SET roomId = @roomId, bedLetter = UPPER(@bedLetter)
        WHERE id = @id;

        SELECT * FROM app.beds WHERE id = @id;
        `,
        {
          id: { type: sql.Int, value: id },
          roomId: { type: sql.Int, value: Number(roomId) },
          bedLetter: { type: sql.NVarChar(1), value: String(bedLetter).trim() },
        }
      );

      const updated = r.recordset[0];
      if (!updated) return res.status(404).json({ error: 'Bed not found' });

      res.json(updated);
    } catch (err) {
      console.error(err);
      if (err.number === 547 && String(err.message || '').toLowerCase().includes('check')) {
        return res.status(400).json({ error: 'bedLetter must be A, B, C, or D' });
      }
      res.status(500).json({ error: 'Failed to update bed' });
    }
  });

  // DELETE /residential/beds/:id
  app.delete('/residential/beds/:id', ensureOffice, async (req, res) => {
    const bedId = Number(req.params.id);

    try {
      const pool = await getPool();
      const tx = new sql.Transaction(pool);
      await tx.begin();

      try {
        const existsR = await new sql.Request(tx)
          .input('bedId', sql.Int, bedId)
          .query(`SELECT id FROM app.beds WHERE id = @bedId;`);

        if (existsR.recordset.length === 0) {
          await tx.rollback();
          return res.status(404).json({ error: 'Bed not found' });
        }

        // delete assignments first (your SQLite code did this manually)
        await new sql.Request(tx)
          .input('bedId', sql.Int, bedId)
          .query(`DELETE FROM app.bed_assignments WHERE bed_id = @bedId;`);

        const delR = await new sql.Request(tx)
          .input('bedId', sql.Int, bedId)
          .query(`DELETE FROM app.beds WHERE id = @bedId;`);

        if (!delR.rowsAffected || delR.rowsAffected[0] === 0) {
          await tx.rollback();
          return res.status(404).json({ error: 'Bed not found' });
        }

        await tx.commit();
        res.status(204).send();
      } catch (inner) {
        try { await tx.rollback(); } catch {}
        throw inner;
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete bed' });
    }
  });
}

module.exports = registerBedRoutes;
