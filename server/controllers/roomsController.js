// controllers/roomsController.js (MSSQL)
const { ensureAuthenticated, ensureOffice, ensureAnyRole } = require('../middleware/auth');

function registerRoomRoutes(app, db) {
  const { sql, query, getPool } = db;

  // GET /residential/rooms
  app.get('/residential/rooms', ensureAuthenticated, async (req, res) => {
    try {
      const buildingId = req.query.buildingId ? Number(req.query.buildingId) : null;

      if (buildingId) {
        const r = await query(
          `
          SELECT r.*, b.buildingName
          FROM app.rooms r
          JOIN app.buildings b ON r.buildingId = b.id
          WHERE r.buildingId = @buildingId
          ORDER BY r.roomNumber;
          `,
          { buildingId: { type: sql.Int, value: buildingId } }
        );
        return res.json(r.recordset);
      }

      const r = await query(
        `
        SELECT r.*, b.buildingName
        FROM app.rooms r
        JOIN app.buildings b ON r.buildingId = b.id
        ORDER BY b.buildingName, r.roomNumber;
        `
      );

      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  });

  // GET /residential/rooms/:id
  app.get('/residential/rooms/:id', ensureAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);

      const r = await query(
        `SELECT * FROM app.rooms WHERE id = @id;`,
        { id: { type: sql.Int, value: id } }
      );

      const room = r.recordset[0];
      if (!room) return res.status(404).json({ error: 'Room not found' });

      res.json(room);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch room' });
    }
  });

  // POST /residential/rooms
  app.post('/residential/rooms', ensureOffice, async (req, res) => {
    try {
      const { buildingId, roomNumber, roomType } = req.body;

      if (!buildingId || !roomNumber || !roomType) {
        return res.status(400).json({
          error: 'buildingId, roomNumber, and roomType are required',
        });
      }

      const r = await query(
        `
        INSERT INTO app.rooms (buildingId, roomNumber, roomType)
        OUTPUT INSERTED.*
        VALUES (@buildingId, @roomNumber, @roomType);
        `,
        {
          buildingId: { type: sql.Int, value: Number(buildingId) },
          roomNumber: { type: sql.NVarChar(50), value: String(roomNumber).trim() },
          roomType: { type: sql.NVarChar(20), value: String(roomType) },
        }
      );

      res.status(201).json(r.recordset[0]);
    } catch (err) {
      console.error(err);
      // check constraint violations often surface as 547 with constraint name in message
      if (err.number === 547 && String(err.message || '').toLowerCase().includes('check')) {
        return res.status(400).json({ error: 'roomType must be student, staff, or vsp' });
      }
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  // PUT /residential/rooms/:id
  app.put('/residential/rooms/:id', ensureOffice, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { buildingId, roomNumber, roomType } = req.body;

      if (!buildingId || !roomNumber || !roomType) {
        return res.status(400).json({
          error: 'buildingId, roomNumber, and roomType are required',
        });
      }

      const r = await query(
        `
        UPDATE app.rooms
        SET buildingId = @buildingId, roomNumber = @roomNumber, roomType = @roomType
        WHERE id = @id;

        SELECT * FROM app.rooms WHERE id = @id;
        `,
        {
          id: { type: sql.Int, value: id },
          buildingId: { type: sql.Int, value: Number(buildingId) },
          roomNumber: { type: sql.NVarChar(50), value: String(roomNumber).trim() },
          roomType: { type: sql.NVarChar(20), value: String(roomType) },
        }
      );

      const updated = r.recordset[0];
      if (!updated) return res.status(404).json({ error: 'Room not found' });

      res.json(updated);
    } catch (err) {
      console.error(err);
      if (err.number === 547 && String(err.message || '').toLowerCase().includes('check')) {
        return res.status(400).json({ error: 'roomType must be student, staff, or vsp' });
      }
      res.status(500).json({ error: 'Failed to update room' });
    }
  });

  // DELETE /residential/rooms/:id
  app.delete('/residential/rooms/:id', ensureOffice, async (req, res) => {
    const roomId = Number(req.params.id);

    try {
      const pool = await getPool();
      const tx = new sql.Transaction(pool);
      await tx.begin();

      try {
        // Ensure room exists
        const roomR = await new sql.Request(tx)
          .input('roomId', sql.Int, roomId)
          .query(`SELECT id FROM app.rooms WHERE id = @roomId;`);

        if (roomR.recordset.length === 0) {
          await tx.rollback();
          return res.status(404).json({ error: 'Room not found' });
        }

        // Block deletion if any active bed assignment in this room
        const activeR = await new sql.Request(tx)
          .input('roomId', sql.Int, roomId)
          .query(`
            SELECT TOP (1) 1 AS hasActive
            FROM app.bed_assignments ba
            JOIN app.beds b ON ba.bed_id = b.id
            WHERE b.roomId = @roomId AND ba.end_date IS NULL;
          `);

        if (activeR.recordset.length > 0) {
          await tx.rollback();
          return res.status(400).json({
            error: 'Cannot delete a room that has an active bed assignment.',
          });
        }

        // Delete assignments for beds in this room
        await new sql.Request(tx)
          .input('roomId', sql.Int, roomId)
          .query(`
            DELETE ba
            FROM app.bed_assignments ba
            JOIN app.beds b ON ba.bed_id = b.id
            WHERE b.roomId = @roomId;
          `);

        // Delete beds in this room
        await new sql.Request(tx)
          .input('roomId', sql.Int, roomId)
          .query(`DELETE FROM app.beds WHERE roomId = @roomId;`);

        // Delete room
        const delR = await new sql.Request(tx)
          .input('roomId', sql.Int, roomId)
          .query(`DELETE FROM app.rooms WHERE id = @roomId;`);

        if (!delR.rowsAffected || delR.rowsAffected[0] === 0) {
          await tx.rollback();
          return res.status(404).json({ error: 'Room not found' });
        }

        await tx.commit();
        return res.status(204).send();
      } catch (inner) {
        try { await tx.rollback(); } catch {}
        throw inner;
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete room' });
    }
  });
}

module.exports = registerRoomRoutes;
