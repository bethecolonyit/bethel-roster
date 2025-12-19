// index.js
const path = require('path');

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.development';

require('dotenv').config({ path: path.join(__dirname, envFile) });
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const session = require('express-session');

// ----------------------
// Startup safety guard (DEV vs PROD DB protection)
// ----------------------
const nodeEnv = process.env.NODE_ENV || 'development';
const dbName = process.env.DB_NAME || '';

if (nodeEnv !== 'production' && dbName && !dbName.toLowerCase().endsWith('_dev')) {
  console.error(' REFUSING TO START');
  console.error(`NODE_ENV=${nodeEnv} but DB_NAME=${dbName}`);
  console.error('Non-production environment must use a *_dev database.');
  process.exit(1);
}

if (nodeEnv === 'production' && dbName.toLowerCase().endsWith('_dev')) {
  console.error(' REFUSING TO START');
  console.error(`NODE_ENV=production but DB_NAME=${dbName}`);
  console.error('Production environment must NOT use a *_dev database.');
  process.exit(1);
}
// ----------------------
// END SECTION
// ----------------------

const db = require('./database/db'); // <--- new db module
const registerAuthRoutes = require('./controllers/authController');
const registerStudentRoutes = require('./controllers/studentController');
const registerBuildingRoutes = require('./controllers/buildingsController');
const registerRoomRoutes = require('./controllers/roomsController');
const registerBedRoutes = require('./controllers/bedsController');
const registerBedAssignmentRoutes = require('./controllers/bedAssignmentsController');
const registerResidentialStructureRoutes = require('./controllers/residentialStructureController');
const registerWritingAssignmentRoutes = require('./controllers/writingAssignmentsController');
const registerEmployeeRoutes = require('./controllers/employeeController');



const app = express();
const port = process.env.PORT || 3000;

// ----------------------
// Multer storage for images
// ----------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/students/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

// ----------------------
// Session (cookie-based auth)
// ----------------------
if (!process.env.SESSION_SECRET) {
  console.error('SESSION_SECRET is not set');
  process.exit(1);
}

// If you are behind a reverse proxy later (nginx), keep this enabled.
// It does not break non-proxy HTTP in typical setups.
app.set('trust proxy', 1);

app.use(
  session({
    name: 'bethel.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 2, // 2 hours
      httpOnly: true,

      // IMPORTANT: you are currently using http:// (not https://)
      // secure MUST be false or the browser will drop the cookie and you'll get 401s.
      secure: false,

      // Works well for SPA + API on the same site.
      sameSite: 'lax',
    },
  })
);

// ----------------------
// HTML access guard (legacy HTML pages)
// This only affects *.html requests, not Angular routes (which are path-based).
// ----------------------
app.use((req, res, next) => {
  const openPaths = ['/login.html', '/auth/login', '/auth/logout'];

  if (openPaths.includes(req.path)) {
    return next();
  }

  if (
    req.path.startsWith('/js/') ||
    req.path.startsWith('/css/') ||
    req.path.startsWith('/images/') ||
    req.path.startsWith('/public/')
  ) {
    return next();
  }

  if (req.path.endsWith('.html')) {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login.html');
    }
  }

  next();
});

// ----------------------
// Static files (uploads, etc.)
// ----------------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ----------------------
// Body & CORS
// ----------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allow both dev (localhost:4200) and prod (same-origin 10.0.0.217:3000)
const allowedOrigins = [
  'http://localhost:4200',
  'http://10.0.0.217:3000',
  'http://bethel-app',
  'http://bethel-app:3000',
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (e.g. curl, Postman) or from allowed list
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// ----------------------
// Register controllers (API routes)
// ----------------------

const api = express.Router();

registerAuthRoutes(api, db);
registerStudentRoutes(api, db, upload);
registerBuildingRoutes(api, db);
registerRoomRoutes(api, db);
registerBedRoutes(api, db);
registerBedAssignmentRoutes(api, db);
registerResidentialStructureRoutes(api, db);
registerWritingAssignmentRoutes(api, db);
registerEmployeeRoutes(api, db);

app.use('/api', api);
// ----------------------
// Angular dist (production build)
// ----------------------
// Path to Angular's production build output
const angularDistPath = path.join(__dirname, '../client/dist/client/browser');

// Serve static Angular files
app.use(express.static(angularDistPath));

// Catch-all: for any route NOT handled above (i.e., non-API routes),
// send back Angular's index.html so the SPA router can handle it.
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(angularDistPath, 'index.html'));
});

// ----------------------
// Start server
// ----------------------
app.listen(port, '0.0.0.0', () => {
  console.log(`App listening on port ${port}`);
});
