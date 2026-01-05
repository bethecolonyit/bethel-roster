// controllers/pastorsController.js (MSSQL)
const { ensureAuthenticated, ensureAnyRole } = require('../middleware/auth');

function registerPastorRoutes(app, db) {
  const { sql, query } = db;

  // GET /pastors?activeOnly=1
  app.get('/pastors', ensureAuthenticated, async (req, res) => {
    try {
      const activeOnly =
        typeof req.query.activeOnly === 'string' &&
        (req.query.activeOnly === '1' || req.query.activeOnly.toLowerCase() === 'true');

      const where = activeOnly ? 'WHERE isActive = 1' : '';

      const r = await query(
        `
        SELECT id, fullName, isActive, sortOrder
        FROM app.pastors
        ${where}
        ORDER BY sortOrder ASC, fullName ASC
        `
      );

      res.json(r.recordset);
    } catch (err) {
      console.error('Error fetching pastors', err);
      res.status(500).json({ error: 'Failed to load pastors' });
    }
  });

  // OPTIONAL: POST /pastors (office/admin)
  app.post('/pastors', ensureAnyRole('office', 'admin'), async (req, res) => {
    try {
      const { fullName, isActive = true, sortOrder = 0 } = req.body;

      const name = (fullName ?? '').trim();
      if (!name) return res.status(400).json({ error: 'fullName is required' });

      await query(
        `
        INSERT INTO app.pastors (fullName, isActive, sortOrder, updatedAt)
        VALUES (@fullName, @isActive, @sortOrder, SYSUTCDATETIME())
        `,
        {
          fullName: { type: sql.NVarChar(150), value: name },
          isActive: { type: sql.Bit, value: !!isActive },
          sortOrder: { type: sql.Int, value: Number(sortOrder) || 0 },
        }
      );

      res.json({ success: true });
    } catch (err) {
      console.error('Error creating pastor', err);
      res.status(500).json({ error: 'Failed to create pastor' });
    }
  });

  // OPTIONAL: PUT /pastors/:id (office/admin)
  app.put('/pastors/:id', ensureAnyRole('office', 'admin'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid id' });
      }

      const { fullName, isActive, sortOrder } = req.body;

      const name = typeof fullName === 'string' ? fullName.trim() : null;
      const isActiveVal = typeof isActive === 'boolean' ? isActive : null;
      const sortOrderVal = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : null;

      const r = await query(
        `
        UPDATE app.pastors
        SET
          fullName  = COALESCE(@fullName, fullName),
          isActive  = COALESCE(@isActive, isActive),
          sortOrder = COALESCE(@sortOrder, sortOrder),
          updatedAt = SYSUTCDATETIME()
        WHERE id = @id
        `,
        {
          id: { type: sql.Int, value: id },
          fullName: { type: sql.NVarChar(150), value: name },
          isActive: { type: sql.Bit, value: isActiveVal },
          sortOrder: { type: sql.Int, value: sortOrderVal },
        }
      );

      if (!r.rowsAffected || r.rowsAffected[0] === 0) {
        return res.status(404).json({ error: 'Pastor not found' });
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Error updating pastor', err);
      res.status(500).json({ error: 'Failed to update pastor' });
    }
  });
}

module.exports = registerPastorRoutes;
