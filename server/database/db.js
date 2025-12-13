// server/database/db.js  (MSSQL version)
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise;

function getPool() {
  if (!poolPromise) poolPromise = sql.connect(config);
  return poolPromise;
}

async function query(text, params = {}) {
  const pool = await getPool();
  const req = pool.request();

  for (const [name, p] of Object.entries(params)) {
    // support { paramName: { type, value } } or { paramName: value }
    if (p && typeof p === 'object' && 'type' in p && 'value' in p) {
      req.input(name, p.type, p.value);
    } else {
      req.input(name, p);
    }
  }

  return req.query(text);
}

module.exports = { sql, getPool, query };
