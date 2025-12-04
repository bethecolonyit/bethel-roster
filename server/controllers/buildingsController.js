// controllers/buildingsController.js
const { ensureAuthenticated, ensureOffice} = require('../middleware/auth');
function registerBuildingRoutes(app, db) {
  // GET /residential/buildings
  app.get('/residential/buildings', ensureAuthenticated, (req, res) => {
    try {
      const stmt = db.prepare(
        'SELECT * FROM buildings ORDER BY buildingName;'
      );
      const buildings = stmt.all();
      res.json(buildings);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch buildings' });
    }
  });

  // GET /residential/buildings/:id
  app.get('/residential/buildings/:id', ensureAuthenticated, (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM buildings WHERE id = ?;');
      const building = stmt.get(req.params.id);
      if (!building) {
        return res.status(404).json({ error: 'Building not found' });
      }
      res.json(building);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch building' });
    }
  });

  // POST /residential/buildings
  app.post('/residential/buildings', ensureOffice, (req, res) => {
    try {
      const { buildingName } = req.body;
      if (!buildingName) {
        return res.status(400).json({ error: 'buildingName is required' });
      }

      const stmt = db.prepare(
        'INSERT INTO buildings (buildingName) VALUES (?);'
      );
      const info = stmt.run(buildingName.trim());

      const newBuilding = db
        .prepare('SELECT * FROM buildings WHERE id = ?;')
        .get(info.lastInsertRowid);

      res.status(201).json(newBuilding);
    } catch (err) {
      console.error(err);
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res
          .status(400)
          .json({ error: 'A building with that name already exists' });
      }
      res.status(500).json({ error: 'Failed to create building' });
    }
  });

  // PUT /residential/buildings/:id
  app.put('/residential/buildings/:id', ensureOffice, (req, res) => {
    try {
      const { buildingName } = req.body;
      if (!buildingName) {
        return res.status(400).json({ error: 'buildingName is required' });
      }

      const stmt = db.prepare(
        'UPDATE buildings SET buildingName = ? WHERE id = ?;'
      );
      const info = stmt.run(buildingName.trim(), req.params.id);

      if (info.changes === 0) {
        return res.status(404).json({ error: 'Building not found' });
      }

      const updated = db
        .prepare('SELECT * FROM buildings WHERE id = ?;')
        .get(req.params.id);

      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update building' });
    }
  });

  // DELETE /residential/buildings/:id
  app.delete('/residential/buildings/:id', ensureOffice, (req, res) => {
    try {
      const stmt = db.prepare('DELETE FROM buildings WHERE id = ?;');
      const info = stmt.run(req.params.id);

      if (info.changes === 0) {
        return res.status(404).json({ error: 'Building not found' });
      }

      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete building' });
    }
  });
}

module.exports = registerBuildingRoutes;
