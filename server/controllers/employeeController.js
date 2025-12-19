const { ensureAdmin } = require('../middleware/auth');


function registerEmployeeRoutes(app, db) {
    const {sql, query } = db;

    app.get('/employees', ensureAdmin, async (req, res) => {
        try {
            const r = await query(
                `SELECT id, userId, firstName, lastName, hireDate FROM app.employees ORDER BY firstName ASC`
            );
            res.json(r.recordset);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Database error fetching employees'});
        }
    });

    app.post('/employees', ensureAdmin, async (req, res) => {
        const {userId, firstName, lastName, hireDate} = req.body;
        if (!userId || !firstName || !lastName || !hireDate ) {
            return res.status(400).json({ error: 'userId, firstName, lastName, and hireDate are required'});
        }
        try {
            const r = await query(
                `INSERT INTO app.employees (userId, firstName, lastName, hireDate)
                OUTPUT INSERTED.id, INSERTED.userId, INSERTED.firstName, INSERTED.lastName, INSERTED.hireDate
                VALUES (@userId, @firstName, @lastName, @hireDate)`,
                {
                    userId: { type: sql.Int, value: userId },
                    firstName: { type: sql.NVarChar(100), value: firstName },
                    lastName: { type: sql.NVarChar(100), value: lastName },
                    hireDate: { type: sql.DATE, value: hireDate},
                }
            );
            res.status(201).json(r.recordset[0]);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error creating employee'})
        }
    });
    // EDIT
  app.put('/employees/:id', ensureAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { userId, firstName, lastName, hireDate } = req.body;

    if (!id) return res.status(400).json({ error: 'Invalid employee id' });
    if (!userId || !firstName || !lastName || !hireDate) {
      return res.status(400).json({ error: 'userId, firstName, lastName, and hireDate are required' });
    }

    try {
      const r = await query(
        `
        UPDATE app.employees
        SET userId = @userId,
            firstName = @firstName,
            lastName = @lastName,
            hireDate = @hireDate
        OUTPUT INSERTED.id, INSERTED.userId, INSERTED.firstName, INSERTED.lastName, INSERTED.hireDate
        WHERE id = @id
        `,
        {
          id: { type: sql.Int, value: id },
          userId: { type: sql.Int, value: userId },
          firstName: { type: sql.NVarChar(100), value: firstName },
          lastName: { type: sql.NVarChar(100), value: lastName },
          hireDate: { type: sql.Date, value: hireDate },
        }
      );

      if (!r.recordset?.length) return res.status(404).json({ error: 'Employee not found' });
      res.json(r.recordset[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error updating employee' });
    }
  });


}

module.exports = registerEmployeeRoutes;