// controllers/authController.js
const bcrypt = require('bcrypt');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

function registerAuthRoutes(app, db) {
  // POST /auth/login
  app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      const stmt = db.prepare(
        'SELECT id, email, password_hash, role FROM users WHERE email = ?'
      );
      const user = stmt.get(email);

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      bcrypt.compare(password, user.password_hash, (bcryptErr, same) => {
        if (bcryptErr) {
          console.error(bcryptErr);
          return res.status(500).json({ error: 'Error checking password' });
        }

        if (!same) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.email = user.email;

        return res.json({
          id: user.id,
          email: user.email,
          role: user.role,
        });
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
  });

  // POST /auth/logout
  app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ message: 'Logged out' });
    });
  });

  // GET /auth/me
  app.get('/auth/me', (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(200).json(null);
    }

    res.json({
      id: req.session.userId,
      email: req.session.email,
      role: req.session.role,
    });
  });

  // POST /auth/users (admin only)
  app.post('/auth/users', ensureAuthenticated, ensureAdmin, (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res
        .status(400)
        .json({ error: 'Email, password, and role are required' });
    }

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or user' });
    }

    bcrypt.hash(password, 10, (hashErr, hash) => {
      if (hashErr) {
        console.error(hashErr);
        return res.status(500).json({ error: 'Error hashing password' });
      }

      try {
        const stmt = db.prepare(
          'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)'
        );
        const info = stmt.run(email, hash, role);

        res.status(201).json({
          id: info.lastInsertRowid,
          email,
          role,
        });
      } catch (err) {
        console.error(err);
        if (err.message && err.message.includes('UNIQUE')) {
          return res.status(409).json({ error: 'Email already in use' });
        }
        return res
          .status(500)
          .json({ error: 'Database error creating user' });
      }
    });
  });

  // GET /auth/users (admin only)
  app.get('/auth/users', ensureAuthenticated, ensureAdmin, (req, res) => {
    try {
      const stmt = db.prepare(
        'SELECT id, email, role, created_at FROM users ORDER BY email ASC'
      );
      const users = stmt.all();
      res.json(users);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error fetching users' });
    }
  });

  // PUT /auth/users/:id (admin only)
  app.put('/auth/users/:id', ensureAuthenticated, ensureAdmin, (req, res) => {
    const { id } = req.params;
    const { email, role, password } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or user' });
    }

    const updateUser = (passwordHash = null) => {
      try {
        let stmt;
        if (passwordHash) {
          stmt = db.prepare(`
            UPDATE users
            SET email = ?, role = ?, password_hash = ?
            WHERE id = ?
          `);
          stmt.run(email, role, passwordHash, id);
        } else {
          stmt = db.prepare(`
            UPDATE users
            SET email = ?, role = ?
            WHERE id = ?
          `);
          stmt.run(email, role, id);
        }

        const selectStmt = db.prepare(
          'SELECT id, email, role, created_at FROM users WHERE id = ?'
        );
        const user = selectStmt.get(id);
        res.json(user);
      } catch (err) {
        console.error(err);
        if (err.message && err.message.includes('UNIQUE')) {
          return res.status(409).json({ error: 'Email already in use' });
        }
        res.status(500).json({ error: 'Database error updating user' });
      }
    };

    if (password) {
      bcrypt.hash(password, 10, (hashErr, hash) => {
        if (hashErr) {
          console.error(hashErr);
          return res.status(500).json({ error: 'Error hashing password' });
        }
        updateUser(hash);
      });
    } else {
      updateUser();
    }
  });

  // POST /auth/users/:id/reset-password (admin only)
  app.post(
    '/auth/users/:id/reset-password',
    ensureAuthenticated,
    ensureAdmin,
    (req, res) => {
      const { id } = req.params;
      const { password } = req.body;

      if (
        !password ||
        typeof password !== 'string' ||
        password.trim().length < 6
      ) {
        return res.status(400).json({
          error: 'A password of at least 6 characters is required',
        });
      }

      bcrypt.hash(password, 10, (hashErr, hash) => {
        if (hashErr) {
          console.error(hashErr);
          return res.status(500).json({ error: 'Error hashing password' });
        }

        try {
          const stmt = db.prepare(`
            UPDATE users
            SET password_hash = ?
            WHERE id = ?
          `);

          const info = stmt.run(hash, id);

          if (info.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
          }

          return res.json({ message: 'Password reset successfully' });
        } catch (err) {
          console.error(err);
          return res
            .status(500)
            .json({ error: 'Database error resetting password' });
        }
      });
    }
  );

  // DELETE /auth/users/:id (admin only)
  app.delete(
    '/auth/users/:id',
    ensureAuthenticated,
    ensureAdmin,
    (req, res) => {
      const { id } = req.params;

      try {
        const stmt = db.prepare('DELETE FROM users WHERE id = ?');
        const info = stmt.run(id);

        if (info.changes === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted' });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error deleting user' });
      }
    }
  );
}

module.exports = registerAuthRoutes;
