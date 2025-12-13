// controllers/authController.js (MSSQL)
const bcrypt = require('bcrypt');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

function registerAuthRoutes(app, db) {
  const { sql, query } = db;

  // POST /auth/login
  app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      const r = await query(
        `SELECT TOP (1) id, email, password_hash, role
         FROM app.users
         WHERE email = @email`,
        { email: { type: sql.NVarChar(255), value: email } }
      );

      const user = r.recordset[0];
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      bcrypt.compare(password, user.password_hash, (bcryptErr, same) => {
        if (bcryptErr) return res.status(500).json({ error: 'Error checking password' });
        if (!same) return res.status(401).json({ error: 'Invalid credentials' });

        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.email = user.email;

        return res.json({ id: user.id, email: user.email, role: user.role });
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
  });

  // POST /auth/logout
  app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ message: 'Logged out' }));
  });

  // GET /auth/me
  app.get('/auth/me', (req, res) => {
    if (!req.session || !req.session.userId) return res.status(200).json(null);
    res.json({ id: req.session.userId, email: req.session.email, role: req.session.role });
  });

  // POST /auth/users (admin only)
  app.post('/auth/users', ensureAuthenticated, ensureAdmin, (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password, and role are required' });
    }
    bcrypt.hash(password, 10, async (hashErr, hash) => {
      if (hashErr) return res.status(500).json({ error: 'Error hashing password' });

      try {
        const r = await query(
          `INSERT INTO app.users (email, password_hash, role)
           OUTPUT INSERTED.id, INSERTED.email, INSERTED.role
           VALUES (@email, @password_hash, @role)`,
          {
            email: { type: sql.NVarChar(255), value: email },
            password_hash: { type: sql.NVarChar(255), value: hash },
            role: { type: sql.NVarChar(50), value: role },
          }
        );

        res.status(201).json(r.recordset[0]);
      } catch (err) {
        console.error(err);
        if (err.number === 2627 || err.number === 2601) {
          return res.status(409).json({ error: 'Email already in use' });
        }
        return res.status(500).json({ error: 'Database error creating user' });
      }
    });
  });

  // GET /auth/users (admin only)
  app.get('/auth/users', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
      const r = await query(
        `SELECT id, email, role, created_at FROM app.users ORDER BY email ASC`
      );
      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error fetching users' });
    }
  });

  // PUT /auth/users/:id (admin only)
  app.put('/auth/users/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { email, role, password } = req.body;

    if (!email || !role) return res.status(400).json({ error: 'Email and role are required' });
    const doUpdate = async (passwordHash = null) => {
      try {
        if (passwordHash) {
          await query(
            `UPDATE app.users
             SET email=@email, role=@role, password_hash=@password_hash
             WHERE id=@id`,
            {
              id: { type: sql.Int, value: id },
              email: { type: sql.NVarChar(255), value: email },
              role: { type: sql.NVarChar(50), value: role },
              password_hash: { type: sql.NVarChar(255), value: passwordHash },
            }
          );
        } else {
          await query(
            `UPDATE app.users
             SET email=@email, role=@role
             WHERE id=@id`,
            {
              id: { type: sql.Int, value: id },
              email: { type: sql.NVarChar(255), value: email },
              role: { type: sql.NVarChar(50), value: role },
            }
          );
        }

        const r = await query(
          `SELECT id, email, role, created_at FROM app.users WHERE id=@id`,
          { id: { type: sql.Int, value: id } }
        );

        const user = r.recordset[0];
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
      } catch (err) {
        console.error(err);
        if (err.number === 2627 || err.number === 2601) {
          return res.status(409).json({ error: 'Email already in use' });
        }
        res.status(500).json({ error: 'Database error updating user' });
      }
    };

    if (password) {
      bcrypt.hash(password, 10, (hashErr, hash) => {
        if (hashErr) return res.status(500).json({ error: 'Error hashing password' });
        doUpdate(hash);
      });
    } else {
      doUpdate();
    }
  });

  // POST /auth/users/:id/reset-password (admin only)
  app.post('/auth/users/:id/reset-password', ensureAuthenticated, ensureAdmin, (req, res) => {
    const id = Number(req.params.id);
    const { password } = req.body;

    if (!password || typeof password !== 'string' || password.trim().length < 6) {
      return res.status(400).json({ error: 'A password of at least 6 characters is required' });
    }

    bcrypt.hash(password, 10, async (hashErr, hash) => {
      if (hashErr) return res.status(500).json({ error: 'Error hashing password' });

      try {
        const r = await query(
          `UPDATE app.users SET password_hash=@password_hash WHERE id=@id`,
          {
            id: { type: sql.Int, value: id },
            password_hash: { type: sql.NVarChar(255), value: hash },
          }
        );

        if (!r.rowsAffected || r.rowsAffected[0] === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Password reset successfully' });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error resetting password' });
      }
    });
  });

  // DELETE /auth/users/:id (admin only)
  app.delete('/auth/users/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const id = Number(req.params.id);

    try {
      const r = await query(
        `DELETE FROM app.users WHERE id=@id`,
        { id: { type: sql.Int, value: id } }
      );

      if (!r.rowsAffected || r.rowsAffected[0] === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error deleting user' });
    }
  });
}

module.exports = registerAuthRoutes;
