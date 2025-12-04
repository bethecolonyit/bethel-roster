// controllers/roomsController.js
const { ensureAuthenticated, ensureOffice} = require('../middleware/auth');
function registerRoomRoutes(app, db) {
  // GET /residential/rooms
  app.get('/residential/rooms', ensureAuthenticated, (req, res) => {
    try {
      const { buildingId } = req.query;
      let rooms;

      if (buildingId) {
        const stmt = db.prepare(`
          SELECT r.*, b.buildingName
          FROM rooms r
          JOIN buildings b ON r.buildingId = b.id
          WHERE r.buildingId = ?
          ORDER BY r.roomNumber;
        `);
        rooms = stmt.all(buildingId);
      } else {
        const stmt = db.prepare(`
          SELECT r.*, b.buildingName
          FROM rooms r
          JOIN buildings b ON r.buildingId = b.id
          ORDER BY b.buildingName, r.roomNumber;
        `);
        rooms = stmt.all();
      }

      res.json(rooms);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  });

  // GET /residential/rooms/:id
  app.get('/residential/rooms/:id', ensureAuthenticated, (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM rooms WHERE id = ?;');
      const room = stmt.get(req.params.id);

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      res.json(room);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch room' });
    }
  });

  // POST /residential/rooms
  app.post('/residential/rooms', ensureOffice, (req, res) => {
    try {
      const { buildingId, roomNumber, roomType } = req.body;

      if (!buildingId || !roomNumber || !roomType) {
        return res.status(400).json({
          error: 'buildingId, roomNumber, and roomType are required',
        });
      }

      const stmt = db.prepare(`
        INSERT INTO rooms (buildingId, roomNumber, roomType)
        VALUES (?, ?, ?);
      `);

      const info = stmt.run(
        buildingId,
        String(roomNumber).trim(),
        roomType
      );

      const newRoom = db
        .prepare('SELECT * FROM rooms WHERE id = ?;')
        .get(info.lastInsertRowid);

      res.status(201).json(newRoom);
    } catch (err) {
      console.error(err);
      if (err.code === 'SQLITE_CONSTRAINT_CHECK') {
        return res
          .status(400)
          .json({ error: 'roomType must be student, staff, or vsp' });
      }
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  // PUT /residential/rooms/:id
  app.put('/residential/rooms/:id', ensureOffice, (req, res) => {
    try {
      const { buildingId, roomNumber, roomType } = req.body;

      if (!buildingId || !roomNumber || !roomType) {
        return res.status(400).json({
          error: 'buildingId, roomNumber, and roomType are required',
        });
      }

      const stmt = db.prepare(`
        UPDATE rooms
        SET buildingId = ?, roomNumber = ?, roomType = ?
        WHERE id = ?;
      `);

      const info = stmt.run(
        buildingId,
        String(roomNumber).trim(),
        roomType,
        req.params.id
      );

      if (info.changes === 0) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const updated = db
        .prepare('SELECT * FROM rooms WHERE id = ?;')
        .get(req.params.id);

      res.json(updated);
    } catch (err) {
      console.error(err);
      if (err.code === 'SQLITE_CONSTRAINT_CHECK') {
        return res
          .status(400)
          .json({ error: 'roomType must be student, staff, or vsp' });
      }
      res.status(500).json({ error: 'Failed to update room' });
    }
  });

  // DELETE /residential/rooms/:id
  app.delete('/residential/rooms/:id', ensureOffice, (req, res) => {
    const roomId = Number(req.params.id);

    try {
      const existingRoom = db
        .prepare('SELECT id FROM rooms WHERE id = ?;')
        .get(roomId);

      if (!existingRoom) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const activeAssignment = db
        .prepare(`
          SELECT 1
          FROM bed_assignments ba
          JOIN beds b ON ba.bed_id = b.id
          WHERE b.roomId = ? AND ba.end_date IS NULL
          LIMIT 1;
        `)
        .get(roomId);

      if (activeAssignment) {
        return res.status(400).json({
          error: 'Cannot delete a room that has an active bed assignment.',
        });
      }

      db.prepare(
        `
        DELETE FROM bed_assignments
        WHERE bed_id IN (SELECT id FROM beds WHERE roomId = ?);
      `
      ).run(roomId);

      db.prepare('DELETE FROM beds WHERE roomId = ?;').run(roomId);

      const info = db
        .prepare('DELETE FROM rooms WHERE id = ?;')
        .run(roomId);

      if (info.changes === 0) {
        return res.status(404).json({ error: 'Room not found' });
      }

      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete room' });
    }
  });
}

module.exports = registerRoomRoutes;
