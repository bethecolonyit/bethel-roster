// controllers/timeOffController.js
const {
  ensureAuthenticated,
  ensureHR,
} = require('../middleware/auth');

/**
 * Time Off / Leave module routes.
 * Controllers are mounted behind "/api" already.
 *
 * IMPORTANT: This version uses DATE columns on app.time_off_requests:
 *   - startDate (DATE, NOT NULL)
 *   - endDate   (DATE, NOT NULL)
 *
 * It accepts incoming payloads that may still include startDateTime/endDateTime
 * and will coerce them to YYYY-MM-DD date-only strings.
 *
 * IMPORTANT DISPLAY NOTE:
 * SQL DATE types can serialize to JS Dates and shift a day when displayed in local time.
 * To prevent that, this controller returns startDate/endDate as VARCHAR(10) "YYYY-MM-DD".
 */
function registerTimeOffRoutes(app, db) {
  const { sql, query, getPool } = db;

  // -----------------------------
  // Helpers
  // -----------------------------
  function toInt(v) {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  function toHours(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100) / 100;
  }

  // IMPORTANT: This app uses sessions (req.session.userId / req.session.role), not req.user
  function isAdmin(req) {
    return Boolean(
      (req.session && req.session.role === 'admin') ||
      (req.session && req.session.role === 'hr')
    );
  }

  function sessionUserId(req) {
    const id = Number(req.session?.userId);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  /**
   * Coerce various date inputs into YYYY-MM-DD string.
   * Accepts:
   * - "2026-01-15"
   * - "2026-01-15T00:00:00"
   * - "2026-01-15T00:00:00.000Z"
   * Returns: "YYYY-MM-DD" or null
   */
  function toYmdDateOnly(v) {
    if (v === null || v === undefined) return null;

    if (v instanceof Date && !Number.isNaN(v.valueOf())) {
      // Convert Date to local YYYY-MM-DD
      const yyyy = v.getFullYear();
      const mm = String(v.getMonth() + 1).padStart(2, '0');
      const dd = String(v.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    const s = String(v).trim();
    if (!s) return null;

    // If it's an ISO datetime, keep only date part
    const ymd = s.length >= 10 ? s.slice(0, 10) : s;

    // Validate basic YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;

    // Lightweight sanity check
    const y = Number(ymd.slice(0, 4));
    const m = Number(ymd.slice(5, 7));
    const d = Number(ymd.slice(8, 10));
    if (y < 1900 || y > 2100) return null;
    if (m < 1 || m > 12) return null;
    if (d < 1 || d > 31) return null;

    return ymd;
  }

  async function getEmployeeIdForUser(userId) {
    const r = await query(
      `SELECT TOP 1 id FROM app.employees WHERE userId = @userId`,
      { userId: { type: sql.Int, value: userId } }
    );
    return r.recordset?.[0]?.id ?? null;
  }

  async function getLeaveTypeByCode(code) {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return null;

    const r = await query(
      `SELECT TOP 1 id, code, name
       FROM app.leave_types
       WHERE code = @code AND isActive = 1`,
      { code: { type: sql.NVarChar(20), value: c } }
    );
    return r.recordset?.[0] || null;
  }

  async function ensureBalanceRow(employeeId, leaveTypeId) {
    await query(
      `
      IF NOT EXISTS (
        SELECT 1 FROM app.employee_leave_balances
        WHERE employeeId = @employeeId AND leaveTypeId = @leaveTypeId
      )
      BEGIN
        INSERT INTO app.employee_leave_balances (employeeId, leaveTypeId, currentHours)
        VALUES (@employeeId, @leaveTypeId, 0);
      END
      `,
      {
        employeeId: { type: sql.Int, value: employeeId },
        leaveTypeId: { type: sql.Int, value: leaveTypeId },
      }
    );
  }

  // Tx-safe version for ensureBalanceRow
  async function ensureBalanceRowTx(tx, employeeId, leaveTypeId) {
    const req = new sql.Request(tx);
    await req
      .input('employeeId', sql.Int, employeeId)
      .input('leaveTypeId', sql.Int, leaveTypeId)
      .query(`
        IF NOT EXISTS (
          SELECT 1 FROM app.employee_leave_balances
          WHERE employeeId = @employeeId AND leaveTypeId = @leaveTypeId
        )
        BEGIN
          INSERT INTO app.employee_leave_balances (employeeId, leaveTypeId, currentHours)
          VALUES (@employeeId, @leaveTypeId, 0);
        END
      `);
  }

  // -----------------------------
  // LEAVE TYPES
  // -----------------------------
  app.get('/leave-types', ensureAuthenticated, async (req, res) => {
    try {
      const r = await query(
        `
        SELECT id, code, name, description, isActive
        FROM app.leave_types
        WHERE isActive = 1
        ORDER BY code ASC
        `
      );
      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error fetching leave types' });
    }
  });
  
// -----------------------------
// LEDGER (per employee)
// -----------------------------
app.get('/employees/:employeeId/time-off-ledger', ensureAuthenticated, async (req, res) => {
  const employeeId = toInt(req.params.employeeId);
  if (!employeeId) return res.status(400).json({ error: 'Invalid employeeId' });

  try {
    // Non-admin: only allow viewing their own ledger
    if (!isAdmin(req)) {
      const uid = sessionUserId(req);
      if (!uid) return res.status(401).json({ error: 'Not authenticated' });

      const myEmployeeId = await getEmployeeIdForUser(uid);
      if (!myEmployeeId) return res.status(403).json({ error: 'No employee record is linked to this user account' });
      if (employeeId !== myEmployeeId) return res.status(403).json({ error: 'Forbidden' });
    }

    const r = await query(
      `
      SELECT
        l.id,
        l.employeeId,
        lt.code AS leaveTypeCode,
        lt.name AS leaveTypeName,
        l.amountHours,
        l.source,
        l.sourceRequestId,

        -- return date-only string to avoid TZ shift
        CONVERT(varchar(10), l.effectiveDate, 23) AS effectiveDate,

        l.memo,
        l.createdByUserId,

        -- keep createdAt/updatedAt as-is (DATETIME2), but you can stringify if needed
        l.createdAt

      FROM app.time_off_ledger l
      INNER JOIN app.leave_types lt ON lt.id = l.leaveTypeId
      WHERE l.employeeId = @employeeId
      ORDER BY l.effectiveDate DESC, l.createdAt DESC;
      `,
      { employeeId: { type: sql.Int, value: employeeId } }
    );

    res.json(r.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching ledger entries' });
  }
});

  // -----------------------------
  // BALANCES
  // -----------------------------
  app.get('/employees/:employeeId/leave-balances', ensureAuthenticated, async (req, res) => {
    const employeeId = toInt(req.params.employeeId);
    if (!employeeId) return res.status(400).json({ error: 'Invalid employeeId' });

    try {
      // Non-admin: only allow viewing their own balances
      if (!isAdmin(req)) {
        const uid = sessionUserId(req);
        if (!uid) return res.status(401).json({ error: 'Not authenticated' });

        const myEmployeeId = await getEmployeeIdForUser(uid);
        if (!myEmployeeId) return res.status(403).json({ error: 'No employee record is linked to this user account' });
        if (employeeId !== myEmployeeId) return res.status(403).json({ error: 'Forbidden' });
      }

      // Ensure there is a balance row for every active leave type
      const lt = await query(`SELECT id FROM app.leave_types WHERE isActive = 1`);
      for (const row of lt.recordset) {
        await ensureBalanceRow(employeeId, row.id);
      }

      const r = await query(
        `
        SELECT
          b.employeeId,
          b.leaveTypeId,
          lt.code,
          lt.name,
          b.currentHours,
          b.updatedAt
        FROM app.employee_leave_balances b
        INNER JOIN app.leave_types lt ON lt.id = b.leaveTypeId
        WHERE b.employeeId = @employeeId
          AND lt.isActive = 1
        ORDER BY lt.code ASC
        `,
        { employeeId: { type: sql.Int, value: employeeId } }
      );

      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error fetching balances' });
    }
  });

  // -----------------------------
  // MY BALANCES (staff convenience)
  // -----------------------------
  app.get('/my/leave-balances', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const myEmployeeId = await getEmployeeIdForUser(userId);
      if (!myEmployeeId) {
        return res.status(403).json({ error: 'No employee record is linked to this user account' });
      }

      // Ensure rows exist for all active leave types
      const lt = await query(`SELECT id FROM app.leave_types WHERE isActive = 1`);
      for (const row of lt.recordset) {
        await ensureBalanceRow(myEmployeeId, row.id);
      }

      const r = await query(
        `
        SELECT
          b.employeeId,
          b.leaveTypeId,
          lt.code,
          lt.name,
          b.currentHours,
          b.updatedAt
        FROM app.employee_leave_balances b
        INNER JOIN app.leave_types lt ON lt.id = b.leaveTypeId
        WHERE b.employeeId = @employeeId
          AND lt.isActive = 1
        ORDER BY lt.code ASC
        `,
        { employeeId: { type: sql.Int, value: myEmployeeId } }
      );

      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error fetching balances' });
    }
  });

  /**
   * HR "set-to" balance
   */
  app.post('/employees/:employeeId/leave-balances/set', ensureHR, async (req, res) => {
    const employeeId = toInt(req.params.employeeId);
    const { leaveTypeCode, targetHours, memo } = req.body || {};

    if (!employeeId) return res.status(400).json({ error: 'Invalid employeeId' });

    const target = toHours(targetHours);
    if (target === null || target < 0) {
      return res.status(400).json({ error: 'targetHours must be a number >= 0' });
    }

    try {
      const lt = await getLeaveTypeByCode(leaveTypeCode);
      if (!lt) return res.status(400).json({ error: 'Invalid leaveTypeCode' });

      await ensureBalanceRow(employeeId, lt.id);

      const cur = await query(
        `
        SELECT currentHours
        FROM app.employee_leave_balances
        WHERE employeeId = @employeeId AND leaveTypeId = @leaveTypeId
        `,
        {
          employeeId: { type: sql.Int, value: employeeId },
          leaveTypeId: { type: sql.Int, value: lt.id },
        }
      );

      const current = Number(cur.recordset?.[0]?.currentHours || 0);
      const delta = Math.round((target - current) * 100) / 100;

      if (delta === 0) {
        return res.json({
          employeeId,
          leaveTypeId: lt.id,
          code: lt.code,
          currentHours: current,
          message: 'No change required',
        });
      }

      const led = await query(
        `
        INSERT INTO app.time_off_ledger
          (employeeId, leaveTypeId, amountHours, source, sourceRequestId, effectiveDate, memo, createdByUserId)
        OUTPUT INSERTED.*
        VALUES
          (@employeeId, @leaveTypeId, @amountHours, 'ManualAdjustment', NULL, CAST(GETDATE() AS DATE), @memo, @createdByUserId);
        `,
        {
          employeeId: { type: sql.Int, value: employeeId },
          leaveTypeId: { type: sql.Int, value: lt.id },
          amountHours: { type: sql.Decimal(7, 2), value: delta },
          memo: { type: sql.NVarChar(1000), value: memo ? String(memo) : null },
          createdByUserId: { type: sql.Int, value: sessionUserId(req) },
        }
      );

      await query(
        `
        UPDATE app.employee_leave_balances
        SET currentHours = currentHours + @delta,
            updatedAt = SYSDATETIME()
        WHERE employeeId = @employeeId AND leaveTypeId = @leaveTypeId;
        `,
        {
          delta: { type: sql.Decimal(7, 2), value: delta },
          employeeId: { type: sql.Int, value: employeeId },
          leaveTypeId: { type: sql.Int, value: lt.id },
        }
      );

      const out = await query(
        `
        SELECT b.employeeId, b.leaveTypeId, lt.code, lt.name, b.currentHours, b.updatedAt
        FROM app.employee_leave_balances b
        INNER JOIN app.leave_types lt ON lt.id = b.leaveTypeId
        WHERE b.employeeId = @employeeId AND b.leaveTypeId = @leaveTypeId
        `,
        {
          employeeId: { type: sql.Int, value: employeeId },
          leaveTypeId: { type: sql.Int, value: lt.id },
        }
      );

      res.json({ ledger: led.recordset[0], balance: out.recordset[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error setting balance' });
    }
  });

  // -----------------------------
  // REQUESTS
  // -----------------------------

  app.post('/time-off-requests', ensureAuthenticated, async (req, res) => {
    const { leaveTypeCode, startDateTime, endDateTime, requestedHours, notes } = req.body || {};

    const hrs = toHours(requestedHours);
    if (hrs === null || hrs <= 0) return res.status(400).json({ error: 'requestedHours must be > 0' });

    const startDate = toYmdDateOnly(startDateTime);
    const endDate = toYmdDateOnly(endDateTime);

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDateTime and endDateTime are required (YYYY-MM-DD recommended)' });
    }

    try {
      const lt = await getLeaveTypeByCode(leaveTypeCode);
      if (!lt) return res.status(400).json({ error: 'Invalid leaveTypeCode' });

      let employeeId = null;

      if (isAdmin(req)) {
        const requestedEmployeeId = toInt(req.body?.employeeId);
        if (requestedEmployeeId) {
          employeeId = requestedEmployeeId;
        } else {
          const uid = sessionUserId(req);
          if (!uid) return res.status(401).json({ error: 'Not authenticated' });

          employeeId = await getEmployeeIdForUser(uid);
          if (!employeeId) {
            return res.status(400).json({ error: 'employeeId is required (no employee record linked to this admin user)' });
          }
        }
      } else {
        const uid = sessionUserId(req);
        if (!uid) return res.status(401).json({ error: 'Not authenticated' });

        employeeId = await getEmployeeIdForUser(uid);
        if (!employeeId) return res.status(403).json({ error: 'No employee record is linked to this user account' });
      }

      const r = await query(
        `
        INSERT INTO app.time_off_requests
          (employeeId, leaveTypeId, startDate, endDate, requestedHours, status, requestedByUserId, notes)
        OUTPUT INSERTED.*
        VALUES
          (@employeeId, @leaveTypeId, @startDate, @endDate, @requestedHours, 'Pending', @requestedByUserId, @notes);
        `,
        {
          employeeId: { type: sql.Int, value: employeeId },
          leaveTypeId: { type: sql.Int, value: lt.id },
          startDate: { type: sql.Date, value: startDate },
          endDate: { type: sql.Date, value: endDate },
          requestedHours: { type: sql.Decimal(7, 2), value: hrs },
          requestedByUserId: { type: sql.Int, value: sessionUserId(req) },
          notes: { type: sql.NVarChar(1000), value: notes ? String(notes) : null },
        }
      );

      res.status(201).json(r.recordset[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error creating time off request' });
    }
  });

  // -----------------------------
  // MY REQUESTS (always the current user's requests)
  // -----------------------------
  app.get('/my/time-off-requests', ensureAuthenticated, async (req, res) => {
    try {
      const uid = sessionUserId(req);
      if (!uid) return res.status(401).json({ error: 'Not authenticated' });

      const myEmployeeId = await getEmployeeIdForUser(uid);
      if (!myEmployeeId) {
        return res.status(403).json({ error: 'No employee record is linked to this user account' });
      }

      const where = ['r.employeeId = @employeeId'];
      const params = {
        employeeId: { type: sql.Int, value: myEmployeeId },
      };

      if (typeof req.query.status === 'string' && req.query.status.trim()) {
        where.push('r.status = @status');
        params.status = { type: sql.NVarChar(20), value: req.query.status.trim() };
      }

      if (typeof req.query.leaveTypeCode === 'string' && req.query.leaveTypeCode.trim()) {
        where.push('lt.code = @leaveTypeCode');
        params.leaveTypeCode = {
          type: sql.NVarChar(20),
          value: req.query.leaveTypeCode.trim().toUpperCase(),
        };
      }

      if (typeof req.query.from === 'string' && req.query.from.trim()) {
        const fromYmd = toYmdDateOnly(req.query.from);
        if (fromYmd) {
          where.push('r.startDate >= @from');
          params.from = { type: sql.Date, value: fromYmd };
        }
      }

      if (typeof req.query.to === 'string' && req.query.to.trim()) {
        const toYmd = toYmdDateOnly(req.query.to);
        if (toYmd) {
          where.push('r.endDate <= @to');
          params.to = { type: sql.Date, value: toYmd };
        }
      }

      const whereSql = `WHERE ${where.join(' AND ')}`;

      const r = await query(
        `
        SELECT
          r.id,
          r.employeeId,
          e.firstName AS employeeFirstName,
          e.lastName  AS employeeLastName,
          lt.code     AS leaveTypeCode,
          lt.name     AS leaveTypeName,

          -- RETURN DATE-ONLY STRINGS TO PREVENT TZ SHIFT
          CONVERT(varchar(10), r.startDate, 23) AS startDate,
          CONVERT(varchar(10), r.endDate,   23) AS endDate,

          r.requestedHours,
          r.status,
          r.requestedByUserId,
          r.reviewedByUserId,
          r.reviewedAt,
          r.notes,
          r.createdAt,
          r.updatedAt
        FROM app.time_off_requests r
        INNER JOIN app.employees e ON e.id = r.employeeId
        INNER JOIN app.leave_types lt ON lt.id = r.leaveTypeId
        ${whereSql}
        ORDER BY r.createdAt DESC
        `,
        params
      );

      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error fetching my time off requests' });
    }
  });

  // -----------------------------
  // LIST REQUESTS
  // -----------------------------
  app.get('/time-off-requests', ensureAuthenticated, async (req, res) => {
    try {
      const where = [];
      const params = {};

      if (isAdmin(req)) {
        if (req.query.employeeId) {
          const empId = toInt(req.query.employeeId);
          if (empId) {
            where.push('r.employeeId = @employeeId');
            params.employeeId = { type: sql.Int, value: empId };
          }
        }
      } else {
        const uid = sessionUserId(req);
        if (!uid) return res.status(401).json({ error: 'Not authenticated' });

        const myEmployeeId = await getEmployeeIdForUser(uid);
        if (!myEmployeeId) {
          return res.status(403).json({ error: 'No employee record is linked to this user account' });
        }
        where.push('r.employeeId = @employeeId');
        params.employeeId = { type: sql.Int, value: myEmployeeId };
      }

      if (typeof req.query.status === 'string' && req.query.status.trim()) {
        where.push('r.status = @status');
        params.status = { type: sql.NVarChar(20), value: req.query.status.trim() };
      }

      if (typeof req.query.leaveTypeCode === 'string' && req.query.leaveTypeCode.trim()) {
        where.push('lt.code = @leaveTypeCode');
        params.leaveTypeCode = { type: sql.NVarChar(20), value: req.query.leaveTypeCode.trim().toUpperCase() };
      }

      if (typeof req.query.from === 'string' && req.query.from.trim()) {
        const fromYmd = toYmdDateOnly(req.query.from);
        if (fromYmd) {
          where.push('r.startDate >= @from');
          params.from = { type: sql.Date, value: fromYmd };
        }
      }

      if (typeof req.query.to === 'string' && req.query.to.trim()) {
        const toYmd = toYmdDateOnly(req.query.to);
        if (toYmd) {
          where.push('r.endDate <= @to');
          params.to = { type: sql.Date, value: toYmd };
        }
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const r = await query(
        `
        SELECT
          r.id,
          r.employeeId,
          e.firstName AS employeeFirstName,
          e.lastName  AS employeeLastName,
          lt.code     AS leaveTypeCode,
          lt.name     AS leaveTypeName,

          -- RETURN DATE-ONLY STRINGS TO PREVENT TZ SHIFT
          CONVERT(varchar(10), r.startDate, 23) AS startDate,
          CONVERT(varchar(10), r.endDate,   23) AS endDate,

          r.requestedHours,
          r.status,
          r.requestedByUserId,
          r.reviewedByUserId,
          r.reviewedAt,
          r.notes,
          r.createdAt,
          r.updatedAt
        FROM app.time_off_requests r
        INNER JOIN app.employees e ON e.id = r.employeeId
        INNER JOIN app.leave_types lt ON lt.id = r.leaveTypeId
        ${whereSql}
        ORDER BY r.createdAt DESC
        `,
        params
      );

      res.json(r.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error fetching time off requests' });
    }
  });

  // -----------------------------
  // APPROVE / DENY / CANCEL
  // -----------------------------
  app.post('/time-off-requests/:id/approve', ensureHR, async (req, res) => {
    const requestId = toInt(req.params.id);
    if (!requestId) return res.status(400).json({ error: 'Invalid request id' });

    const pool = await getPool();
    const tx = new sql.Transaction(pool);

    try {
      await tx.begin();

      const approveReq = new sql.Request(tx);
      const upd = await approveReq
        .input('id', sql.Int, requestId)
        .input('reviewedByUserId', sql.Int, sessionUserId(req))
        .query(`
          UPDATE app.time_off_requests
          SET status = 'Approved',
              reviewedByUserId = @reviewedByUserId,
              reviewedAt = SYSDATETIME()
          OUTPUT INSERTED.id, INSERTED.employeeId, INSERTED.leaveTypeId, INSERTED.requestedHours,
                 INSERTED.status, INSERTED.reviewedByUserId, INSERTED.reviewedAt
          WHERE id = @id AND status = 'Pending';
        `);

      if (!upd.recordset?.length) {
        await tx.rollback();
        return res.status(400).json({ error: 'Request not found or not in Pending status' });
      }

      const r0 = upd.recordset[0];
      const debit = -Math.abs(Number(r0.requestedHours));

      await ensureBalanceRowTx(tx, r0.employeeId, r0.leaveTypeId);

      const balCheck = new sql.Request(tx);
      const bal = await balCheck
        .input('employeeId', sql.Int, r0.employeeId)
        .input('leaveTypeId', sql.Int, r0.leaveTypeId)
        .query(`
          SELECT currentHours
          FROM app.employee_leave_balances
          WHERE employeeId = @employeeId AND leaveTypeId = @leaveTypeId;
        `);

      const currentHours = Number(bal.recordset?.[0]?.currentHours ?? 0);
      if (currentHours + debit < 0) {
        await tx.rollback();
        return res.status(400).json({ error: 'Insufficient balance to approve this request' });
      }

      const ledReq = new sql.Request(tx);
      const led = await ledReq
        .input('employeeId', sql.Int, r0.employeeId)
        .input('leaveTypeId', sql.Int, r0.leaveTypeId)
        .input('amountHours', sql.Decimal(7, 2), debit)
        .input('sourceRequestId', sql.Int, r0.id)
        .input('effectiveDate', sql.Date, new Date())
        .input('createdByUserId', sql.Int, sessionUserId(req))
        .query(`
          INSERT INTO app.time_off_ledger
            (employeeId, leaveTypeId, amountHours, source, sourceRequestId, effectiveDate, memo, createdByUserId)
          OUTPUT INSERTED.*
          VALUES
            (@employeeId, @leaveTypeId, @amountHours, 'ApprovedRequest', @sourceRequestId, @effectiveDate, NULL, @createdByUserId);
        `);

      const balReq = new sql.Request(tx);
      await balReq
        .input('employeeId', sql.Int, r0.employeeId)
        .input('leaveTypeId', sql.Int, r0.leaveTypeId)
        .input('delta', sql.Decimal(7, 2), debit)
        .query(`
          UPDATE app.employee_leave_balances
          SET currentHours = currentHours + @delta,
              updatedAt = SYSDATETIME()
          WHERE employeeId = @employeeId AND leaveTypeId = @leaveTypeId;
        `);

      await tx.commit();

      res.json({
        request: r0,
        ledger: led.recordset[0],
      });
    } catch (err) {
      console.error(err);
      try { await tx.rollback(); } catch (_) {}
      res.status(500).json({ error: 'Database error approving request' });
    }
  });

  app.post('/time-off-requests/:id/deny', ensureHR, async (req, res) => {
    const requestId = toInt(req.params.id);
    const { notes } = req.body || {};
    if (!requestId) return res.status(400).json({ error: 'Invalid request id' });

    try {
      const r = await query(
        `
        UPDATE app.time_off_requests
        SET status = 'Denied',
            reviewedByUserId = @reviewedByUserId,
            reviewedAt = SYSDATETIME(),
            notes = COALESCE(@notes, notes)
        OUTPUT INSERTED.*
        WHERE id = @id AND status = 'Pending';
        `,
        {
          id: { type: sql.Int, value: requestId },
          reviewedByUserId: { type: sql.Int, value: sessionUserId(req) },
          notes: { type: sql.NVarChar(1000), value: notes ? String(notes) : null },
        }
      );

      if (!r.recordset?.length) return res.status(400).json({ error: 'Request not found or not Pending' });
      res.json(r.recordset[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error denying request' });
    }
  });

  app.post('/time-off-requests/:id/cancel', ensureHR, async (req, res) => {
    const requestId = toInt(req.params.id);
    if (!requestId) return res.status(400).json({ error: 'Invalid request id' });

    const pool = await getPool();
    const tx = new sql.Transaction(pool);

    try {
      await tx.begin();

      const getReq = new sql.Request(tx);
      const r0 = await getReq
        .input('id', sql.Int, requestId)
        .query(`
          SELECT TOP 1 id, employeeId, leaveTypeId, requestedHours, status
          FROM app.time_off_requests
          WHERE id = @id;
        `);

      if (!r0.recordset?.length) {
        await tx.rollback();
        return res.status(404).json({ error: 'Request not found' });
      }

      const existing = r0.recordset[0];

      if (existing.status === 'Cancelled') {
        await tx.rollback();
        return res.status(400).json({ error: 'Request is already Cancelled' });
      }

      const updReq = new sql.Request(tx);
      const upd = await updReq
        .input('id', sql.Int, requestId)
        .input('reviewedByUserId', sql.Int, sessionUserId(req))
        .query(`
          UPDATE app.time_off_requests
          SET status = 'Cancelled',
              reviewedByUserId = COALESCE(reviewedByUserId, @reviewedByUserId),
              reviewedAt = COALESCE(reviewedAt, SYSDATETIME())
          OUTPUT INSERTED.*
          WHERE id = @id;
        `);

      const updated = upd.recordset[0];
      let reversal = null;

      if (existing.status === 'Approved') {
        const credit = Math.abs(Number(existing.requestedHours));

        const ledReq = new sql.Request(tx);
        const led = await ledReq
          .input('employeeId', sql.Int, existing.employeeId)
          .input('leaveTypeId', sql.Int, existing.leaveTypeId)
          .input('amountHours', sql.Decimal(7, 2), credit)
          .input('sourceRequestId', sql.Int, existing.id)
          .input('effectiveDate', sql.Date, new Date())
          .input('createdByUserId', sql.Int, sessionUserId(req))
          .query(`
            INSERT INTO app.time_off_ledger
              (employeeId, leaveTypeId, amountHours, source, sourceRequestId, effectiveDate, memo, createdByUserId)
            OUTPUT INSERTED.*
            VALUES
              (@employeeId, @leaveTypeId, @amountHours, 'RequestReversal', @sourceRequestId, @effectiveDate, NULL, @createdByUserId);
          `);

        reversal = led.recordset[0];

        await ensureBalanceRowTx(tx, existing.employeeId, existing.leaveTypeId);

        const balReq = new sql.Request(tx);
        await balReq
          .input('employeeId', sql.Int, existing.employeeId)
          .input('leaveTypeId', sql.Int, existing.leaveTypeId)
          .input('delta', sql.Decimal(7, 2), credit)
          .query(`
            UPDATE app.employee_leave_balances
            SET currentHours = currentHours + @delta,
                updatedAt = SYSDATETIME()
            WHERE employeeId = @employeeId AND leaveTypeId = @leaveTypeId;
          `);
      }

      await tx.commit();

      res.json({ request: updated, reversalLedger: reversal });
    } catch (err) {
      console.error(err);
      try { await tx.rollback(); } catch (_) {}
      res.status(500).json({ error: 'Database error cancelling request' });
    }
  });

  // STAFF CANCEL (Pending only, own requests)
  app.post('/time-off-requests/:id/cancel-self', ensureAuthenticated, async (req, res) => {
    const requestId = toInt(req.params.id);
    if (!requestId) return res.status(400).json({ error: 'Invalid request id' });

    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const myEmployeeId = await getEmployeeIdForUser(userId);
      if (!myEmployeeId) return res.status(403).json({ error: 'No employee record is linked to this user account' });

      const r = await query(
        `
        UPDATE app.time_off_requests
        SET status = 'Cancelled',
            reviewedByUserId = COALESCE(reviewedByUserId, @userId),
            reviewedAt = COALESCE(reviewedAt, SYSDATETIME()),
            updatedAt = SYSDATETIME()
        OUTPUT INSERTED.*
        WHERE id = @id
          AND employeeId = @employeeId
          AND status = 'Pending';
        `,
        {
          id: { type: sql.Int, value: requestId },
          employeeId: { type: sql.Int, value: myEmployeeId },
          userId: { type: sql.Int, value: userId },
        }
      );

      if (!r.recordset?.length) {
        return res.status(400).json({ error: 'Request not found, not Pending, or not yours' });
      }

      res.json(r.recordset[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error cancelling request' });
    }
  });

  // -----------------------------
  // LEDGER ADJUSTMENTS
  // -----------------------------
  app.post('/time-off-ledger/adjust', ensureHR, async (req, res) => {
    const { employeeId, leaveTypeCode, amountHours, source, effectiveDate, memo } = req.body || {};

    const empId = toInt(employeeId);
    if (!empId) return res.status(400).json({ error: 'employeeId is required' });

    const amt = toHours(amountHours);
    if (amt === null || amt === 0) return res.status(400).json({ error: 'amountHours must be non-zero' });

    const allowedSources = new Set(['ManualAdjustment', 'BankedHoliday', 'OvertimeBank', 'Accrual']);
    if (!allowedSources.has(String(source))) {
      return res
        .status(400)
        .json({ error: `source must be one of: ${Array.from(allowedSources).join(', ')}` });
    }

    try {
      const lt = await getLeaveTypeByCode(leaveTypeCode);
      if (!lt) return res.status(400).json({ error: 'Invalid leaveTypeCode' });

      const ins = await query(
        `
        INSERT INTO app.time_off_ledger
          (employeeId, leaveTypeId, amountHours, source, sourceRequestId, effectiveDate, memo, createdByUserId)
        OUTPUT INSERTED.*
        VALUES
          (@employeeId, @leaveTypeId, @amountHours, @source, NULL,
           COALESCE(@effectiveDate, CAST(GETDATE() AS DATE)),
           @memo, @createdByUserId);
        `,
        {
          employeeId: { type: sql.Int, value: empId },
          leaveTypeId: { type: sql.Int, value: lt.id },
          amountHours: { type: sql.Decimal(7, 2), value: amt },
          source: { type: sql.NVarChar(50), value: String(source) },
          effectiveDate: { type: sql.Date, value: effectiveDate ? String(effectiveDate).slice(0, 10) : null },
          memo: { type: sql.NVarChar(1000), value: memo ? String(memo) : null },
          createdByUserId: { type: sql.Int, value: sessionUserId(req) },
        }
      );

      await ensureBalanceRow(empId, lt.id);

      await query(
        `
        UPDATE app.employee_leave_balances
        SET currentHours = currentHours + @delta,
            updatedAt = SYSDATETIME()
        WHERE employeeId = @employeeId AND leaveTypeId = @leaveTypeId;
        `,
        {
          delta: { type: sql.Decimal(7, 2), value: amt },
          employeeId: { type: sql.Int, value: empId },
          leaveTypeId: { type: sql.Int, value: lt.id },
        }
      );

      res.status(201).json(ins.recordset[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error posting ledger adjustment' });
    }
  });
}

module.exports = registerTimeOffRoutes;
