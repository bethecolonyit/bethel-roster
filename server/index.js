const fs = require('fs');
const Database = require('better-sqlite3');

const DB_FILE = 'mydb.sqlite';

// Open DB once, reuse everywhere
const db = new Database(DB_FILE, { verbose: console.log });

// Ensure tables exist (runs every start, harmless if already created)
db.prepare(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    idNumber TEXT,
    roomNumber TEXT,
    counselor TEXT,
    program TEXT,
    dayin DATE
  )
`).run();

// Later when you add auth:
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();


const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcrypt');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/images') // specify the directory where uploaded files will be stored
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname) // specify a unique filename for each uploaded file
    }
});
const upload = multer({ storage: storage });
const app = express();
const port = 3000;
app.listen (port, ()=> {
    console.log(`App listening on port ${port}`)
})
app.use(
  session({
    secret: 'JesusLoves',  
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 } // 2 hours
  })
);
app.use((req, res, next) => {
  const openPaths = ['/login.html', '/auth/login', '/auth/logout'];

  // allow login & auth routes
  if (openPaths.includes(req.path)) {
    return next();
  }

  // allow static assets (adjust paths if needed)
  if (
    req.path.startsWith('/js/') ||
    req.path.startsWith('/css/') ||
    req.path.startsWith('/images/') ||
    req.path.startsWith('/public/')
  ) {
    return next();
  }

  // protect HTML pages: if not logged in, go to login
  if (req.path.endsWith('.html')) {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login.html');
    }
  }

  next();
});

// ⬇️ NOW static files get served, but only after the check above
app.use(express.static('public'));


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors({
  origin: 'http://localhost:4200',  // your Angular dev origin
  credentials: true,               // allow cookies to be sent
}));


function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated' });
}

function ensureAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin only' });
}
function ensureOffice(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  if (req.session && req.session.role === 'office') {
    return next();
  }
  return res.status(403).json({ error: 'Admin only' });
}

// AUTH ROUTES
// POST /auth/login  { email, password }
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // better-sqlite3: sync query using shared db instance
    const stmt = db.prepare(
      'SELECT id, email, password_hash, role FROM users WHERE email = ?'
    );
    const user = stmt.get(email); // returns row or undefined

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // bcrypt.compare is still async, that’s fine
    bcrypt.compare(password, user.password_hash, (bcryptErr, same) => {
      if (bcryptErr) {
        console.error(bcryptErr);
        return res.status(500).json({ error: 'Error checking password' });
      }

      if (!same) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Success: store minimal user info in session
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.email = user.email;

      return res.json({
        id: user.id,
        email: user.email,
        role: user.role
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

// GET /auth/me  -> who am I?
app.get('/auth/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(200).json(null);
  }

  res.json({
    id: req.session.userId,
    email: req.session.email,
    role: req.session.role
  });
});

// POST /auth/users  (admin only)
// body: { email, password, role: 'admin' | 'user' }
app.post('/auth/users', ensureAuthenticated, ensureAdmin, (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
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
        role
      });
    } catch (err) {
      console.error(err);
      if (err.message && err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      return res.status(500).json({ error: 'Database error creating user' });
    }
  });
});
// GET /auth/users  (admin only) - list all users
app.get('/auth/users', ensureAuthenticated, ensureAdmin, (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, email, role, created_at FROM users ORDER BY email ASC');
    const users = stmt.all();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching users' });
  }
});

// PUT /auth/users/:id  (admin only) - update email/role and optionally password
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

      // return updated record
      const selectStmt = db.prepare('SELECT id, email, role, created_at FROM users WHERE id = ?');
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
// POST /auth/users/:id/reset-password  (admin only)
// body: { password: 'newPasswordHere' }
app.post('/auth/users/:id/reset-password', ensureAuthenticated, ensureAdmin, (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || typeof password !== 'string' || password.trim().length < 6) {
    return res.status(400).json({ error: 'A password of at least 6 characters is required' });
  }

  // Hash the new password
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
      return res.status(500).json({ error: 'Database error resetting password' });
    }
  });
});

// DELETE /auth/users/:id  (admin only)
app.delete('/auth/users/:id', ensureAuthenticated, ensureAdmin, (req, res) => {
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
});

// STUDENT ROUTES
app.get('/students', ensureAuthenticated, (req, res) => {
    try {
        const stmt = db.prepare(`SELECT * FROM students ORDER BY lastName ASC`);
        const students = stmt.all();
        res.json(students);
    } catch (err) {
        console.error(err);
        res.status(500).send("Database error");
    }
});


app.post('/students', ensureOffice, upload.single('photo'), (req, res) => {
    try {
        const student = JSON.parse(req.body.data);
        const { firstName, lastName, idNumber, roomNumber, counselor, program, dayin } = student;

        const stmt = db.prepare(`
            INSERT INTO students (firstName, lastName, idNumber, roomNumber, counselor, program, dayin)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(firstName, lastName, idNumber, roomNumber, counselor, program, dayin);

        res.json({ message: "Student added successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).send("Database insert error");
    }
});


app.post('/edit', ensureOffice, (req, res) => {
    try {
        const { idNumber, roomNumber, firstName, lastName, counselor, program, dayin } = req.body;

        const stmt = db.prepare(`
            UPDATE students
            SET roomNumber = ?, firstName = ?, lastName = ?, counselor = ?, program = ?, dayin = ?
            WHERE idNumber = ?
        `);

        stmt.run(roomNumber, firstName, lastName, counselor, program, dayin, idNumber);

        res.send("success");
    } catch (err) {
        console.error(err);
        res.status(500).send("Database update error");
    }
});

app.delete('/students', ensureOffice, (req, res) => {
    try {
        const { idNumber } = req.body;

        // Delete from the database
        const stmt = db.prepare(`DELETE FROM students WHERE idNumber = ?`);
        stmt.run(idNumber);

        // Delete image like before
        const path = `./public/images/${idNumber}.jpg`;

        fs.unlink(path, (err) => {
            if (err) {
                console.warn("Image not found or already deleted:", path);
            }
        });

        res.send(`${idNumber} was successfully deleted`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Database delete error");
    }
});




