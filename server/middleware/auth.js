// middleware/auth.js

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
  if (req.session && (req.session.role === 'admin' || req.session.role === 'office')) {
    return next();
  }
  return res.status(403).json({ error: 'Admin only' });
}

module.exports = {
  ensureAuthenticated,
  ensureAdmin,
  ensureOffice,
};
