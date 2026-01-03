// middleware/auth.js

function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated' });
}
function ensureOffice(req, res, next) {
  if (req.session && (req.session.role === 'admin' || req.session.role === 'office')) {
    return next();
  }
  return res.status(403).json({ error: 'Admin or Office only' });
}
function ensureHR(req, res, next) {
  if (req.session && (req.session.role === 'admin' || req.session.role === 'hr')) {
    return next();
  }
  return res.status(403).json({ error: 'Admin or HR only' });
}
function ensureCounselingCoordinator(req, res, next) {
  if (req.session && (req.session.role === 'admin' || req.session.role === 'counseling_coordinator' || req.session.role === 'counselor')) {
    return next();
  }
  return res.status(403).json({ error: 'Admin or Counseling Coordinator only' });
}

function ensureAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin only' });
}

function ensureCounselor(req, res, next) {
  if (req.session && (req.session.role === 'admin' || req.session.role === 'counselor')) {
    return next();
  }
  return res.status(403).json({ error: 'Admin only' });
}
function ensureAnyRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.session || !req.session.role) {
      return res.status(401).send('Not authenticated');
    }

    if (!allowedRoles.includes(req.session.role)) {
      return res.status(403).send('Forbidden');
    }

    next();
  };
}

module.exports = {
  ensureAuthenticated,
  ensureAdmin,
  ensureOffice,
  ensureCounselor,
  ensureHR,
  ensureCounselingCoordinator,
  ensureAnyRole,
};
