// index.js
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const session = require('express-session');

const db = require('./database/db'); // <--- new db module
const registerAuthRoutes = require('./controllers/authController');
const registerStudentRoutes = require('./controllers/studentController');
const registerBuildingRoutes = require('./controllers/buildingsController');
const registerRoomRoutes = require('./controllers/roomsController');
const registerBedRoutes = require('./controllers/bedsController');
const registerBedAssignmentRoutes = require('./controllers/bedAssignmentsController');
const registerResidentialStructureRoutes = require('./controllers/residentialStructureController');

const app = express();
const port = 3000;

// Multer storage for images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/images');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

// Session
app.use(
  session({
    secret: 'JesusLoves',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 }, // 2 hours
  })
);

// HTML access guard (login redirect)
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

// Static files
app.use(express.static('public'));

// Body & CORS
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  cors({
    origin: 'http://localhost:4200',
    credentials: true,
  })
);

// Register controllers
registerAuthRoutes(app, db);
registerStudentRoutes(app, db, upload);
registerBuildingRoutes(app, db);
registerRoomRoutes(app, db);
registerBedRoutes(app, db);
registerBedAssignmentRoutes(app, db);
registerResidentialStructureRoutes(app, db);

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
