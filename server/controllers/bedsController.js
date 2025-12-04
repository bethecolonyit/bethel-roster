// controllers/bedsController.js

function registerBedRoutes(app, db) {
  // GET /residential/beds
  app.get('/residential/beds', (req, res) => {
    try {
      const { roomId } = req.query;
      let beds;

      if (roomId) {
        const stmt = db.prepare(`
          SELECT b.*, r.roomNumber, r.roomType, r.buildingId
          FROM beds b
          JOIN rooms r ON b.roomId = r.id
          WHERE b.roomId = ?
          ORDER BY b.bedLetter;
        `);
        beds = stmt.all(roomId);
      } else {
        const stmt = db.prepare(`
          SELECT b.*, r.roomNumber, r.roomType, r.buildingId
          FROM beds b
          JOIN rooms r ON b.roomId = r.id
          ORDER BY r.roomNumber, b.bedLetter;
        `);
        beds = stmt.all();
      }

      res.json(beds);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch beds' });
    }
  });

  // GET /residential/beds/:id
  app.get('/residential/beds/:id', (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM beds WHERE id = ?;');
      const bed = stmt.get(req.params.id);

      if (!bed) {
        return res.status(404).json({ error: 'Bed not found' });
      }

      res.json(bed);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch bed' });
    }
  });

  // POST /residential/beds
  app.post('/residential/beds', (req, res) => {
    try {
      const { roomId, bedLetter } = req.body;

      if (!roomId || !bedLetter) {
        return res
          .status(400)
          .json({ error: 'roomId and bedLetter are required' });
      }

      const stmt = db.prepare(`
        INSERT INTO beds (roomId, bedLetter)
        VALUES (?, UPPER(?));
      `);

      const info = stmt.run(roomId, bedLetter);
      const newBed = db
        .prepare('SELECT * FROM beds WHERE id = ?;')
        .get(info.lastInsertRowid);

      res.status(201).json(newBed);
    } catch (err) {
      console.error(err);
      if (err.code === 'SQLITE_CONSTRAINT_CHECK') {
        return res
          .status(400)
          .json({ error: 'bedLetter must be A, B, C, or D' });
      }
      res.status(500).json({ error: 'Failed to create bed' });
    }
  });

  // PUT /residential/beds/:id
  app.put('/residential/beds/:id', (req, res) => {
    try {
      const { roomId, bedLetter } = req.body;

      if (!roomId || !bedLetter) {
        return res
          .status(400)
          .json({ error: 'roomId and bedLetter are required' });
      }

      const stmt = db.prepare(`
        UPDATE beds
        SET roomId = ?, bedLetter = UPPER(?)
        WHERE id = ?;
      `);

      const info = stmt.run(roomId, bedLetter, req.params.id);

      if (info.changes === 0) {
        return res.status(404).json({ error: 'Bed not found' });
      }

      const updated = db
        .prepare('SELECT * FROM beds WHERE id = ?;')
        .get(req.params.id);

      res.json(updated);
    } catch (err) {
      console.error(err);
      if (err.code === 'SQLITE_CONSTRAINT_CHECK') {
        return res
          .status(400)
          .json({ error: 'bedLetter must be A, B, C, or D' });
      }
      res.status(500).json({ error: 'Failed to update bed' });
    }
  });

  // DELETE /residential/beds/:id
  app.delete('/residential/beds/:id', (req, res) => {
    const bedId = req.params.id;

    try {
      const existing = db
        .prepare('SELECT id FROM beds WHERE id = ?;')
        .get(bedId);

      if (!existing) {
        return res.status(404).json({ error: 'Bed not found' });
      }

      db.prepare('DELETE FROM bed_assignments WHERE bed_id = ?;').run(
        bedId
      );

      const info = db
        .prepare('DELETE FROM beds WHERE id = ?;')
        .run(bedId);

      if (info.changes === 0) {
        return res.status(404).json({ error: 'Bed not found' });
      }

      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete bed' });
    }
  });
}

module.exports = registerBedRoutes;
