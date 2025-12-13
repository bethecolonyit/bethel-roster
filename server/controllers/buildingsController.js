// controllers/buildingsController.js (MSSQL)
const { ensureAuthenticated, ensureOffice } = require('../middleware/auth');

function registerBuildingRoutes(app, db) {
  const { sql, query } = db;

  // GET /residential/buildings
  app.get('/residential/buildings', ensureAuthenticated, async (req, res) => {
    try {
      const r = await query(`SELECT * FROM app.buildings ORDER BY buildingName;`);
      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch buildings' });
    }
  });

  // GET /residential/buildings/:id
  app.get('/residential/buildings/:id', ensureAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await query(
        `SELECT * FROM app.buildings WHERE id = @id;`,
        { id: { type: sql.Int, value: id } }
      );

      const building = r.recordset[0];
      if (!building) return res.status(404).json({ error: 'Building not found' });

      res.json(building);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch building' });
    }
  });

  // POST /residential/buildings
  app.post('/residential/buildings', ensureOffice, async (req, res) => {
    try {
      const { buildingName } = req.body;
      if (!buildingName) {
        return res.status(400).json({ error: 'buildingName is required' });
      }

      const name = String(buildingName).trim();

      const r = await query(
        `
        INSERT INTO app.buildings (buildingName)
        OUTPUT INSERTED.*
        VALUES (@buildingName);
        `,
        { buildingName: { type: sql.NVarChar(255), value: name } }
      );

      res.status(201).json(r.recordset[0]);
    } catch (err) {
      console.error(err);
      // unique violation
      if (err.number === 2601 || err.number === 2627) {
        return res.status(400).json({ error: 'A building with that name already exists' });
      }
      res.status(500).json({ error: 'Failed to create building' });
    }
  });

  // PUT /residential/buildings/:id
  app.put('/residential/buildings/:id', ensureOffice, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { buildingName } = req.body;
      if (!buildingName) {
        return res.status(400).json({ error: 'buildingName is required' });
      }

      const name = String(buildingName).trim();

      const r = await query(
        `
        UPDATE app.buildings
        SET buildingName = @buildingName
        WHERE id = @id;

        SELECT * FROM app.buildings WHERE id = @id;
        `,
        {
          id: { type: sql.Int, value: id },
          buildingName: { type: sql.NVarChar(255), value: name },
        }
      );

      // With multiple statements, mssql returns the last SELECT as recordset
      const updated = r.recordset[0];
      if (!updated) return res.status(404).json({ error: 'Building not found' });

      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update building' });
    }
  });

  // DELETE /residential/buildings/:id
  app.delete('/residential/buildings/:id', ensureOffice, async (req, res) => {
    try {
      const id = Number(req.params.id);

      const r = await query(
        `
        DELETE FROM app.buildings
        WHERE id = @id;
        `,
        { id: { type: sql.Int, value: id } }
      );

      if (!r.rowsAffected || r.rowsAffected[0] === 0) {
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
