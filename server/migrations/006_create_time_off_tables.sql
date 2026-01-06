/* 2025-12-29-create_time_off_tables.sql
   Target: Microsoft SQL Server (MSSQL)
   Schema: app

   Creates:
     - app.leave_types
     - app.time_off_requests
     - app.time_off_ledger
     - app.employee_leave_balances
*/

------------------------------------------------------------
-- 0) LEAVE TYPES (reference / lookup)
------------------------------------------------------------
IF OBJECT_ID('app.leave_types', 'U') IS NULL
BEGIN
    CREATE TABLE app.leave_types (
        id          INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_leave_types PRIMARY KEY,

        code        NVARCHAR(20) NOT NULL,
        name        NVARCHAR(100) NOT NULL,
        description NVARCHAR(500) NULL,

        isActive    BIT NOT NULL
            CONSTRAINT DF_leave_types_isActive DEFAULT (1),

        createdAt   DATETIME2(0) NOT NULL
            CONSTRAINT DF_leave_types_createdAt DEFAULT (SYSDATETIME())
    );

    CREATE UNIQUE INDEX ux_leave_types_code
        ON app.leave_types(code);
END;

IF NOT EXISTS (SELECT 1 FROM app.leave_types WHERE code = 'PTO')
BEGIN
    INSERT INTO app.leave_types (code, name, description)
    VALUES ('PTO', 'Paid Time Off', 'Standard paid time off');
END;

IF NOT EXISTS (SELECT 1 FROM app.leave_types WHERE code = 'SICK')
BEGIN
    INSERT INTO app.leave_types (code, name, description)
    VALUES ('SICK', 'Sick Leave', 'Paid sick leave');
END;

------------------------------------------------------------
-- 1) TIME OFF REQUESTS (workflow)
------------------------------------------------------------
IF OBJECT_ID('app.time_off_requests', 'U') IS NULL
BEGIN
    CREATE TABLE app.time_off_requests (
        id                INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_time_off_requests PRIMARY KEY,

        employeeId        INT NOT NULL,
        leaveTypeId       INT NOT NULL,

        startDateTime     DATETIME2(0) NOT NULL,
        endDateTime       DATETIME2(0) NOT NULL,
        requestedHours    DECIMAL(7,2) NOT NULL,

        status            NVARCHAR(20) NOT NULL
            CONSTRAINT DF_time_off_requests_status DEFAULT ('Pending'),

        requestedByUserId INT NULL,
        reviewedByUserId  INT NULL,
        reviewedAt        DATETIME2(0) NULL,

        notes             NVARCHAR(1000) NULL,

        createdAt         DATETIME2(0) NOT NULL
            CONSTRAINT DF_time_off_requests_createdAt DEFAULT (SYSDATETIME()),

        updatedAt         DATETIME2(0) NOT NULL
            CONSTRAINT DF_time_off_requests_updatedAt DEFAULT (SYSDATETIME()),

        CONSTRAINT CK_time_off_requests_status
            CHECK (status IN ('Pending', 'Approved', 'Denied', 'Cancelled')),

        CONSTRAINT CK_time_off_requests_hours_positive
            CHECK (requestedHours > 0),

        CONSTRAINT CK_time_off_requests_date_order
            CHECK (endDateTime > startDateTime),

        CONSTRAINT FK_time_off_requests_employees
            FOREIGN KEY (employeeId)
            REFERENCES app.employees(id)
            ON DELETE NO ACTION
            ON UPDATE CASCADE,

        CONSTRAINT FK_time_off_requests_leave_types
            FOREIGN KEY (leaveTypeId)
            REFERENCES app.leave_types(id)
            ON DELETE NO ACTION
            ON UPDATE CASCADE,

        -- Avoid cascade path issues from users
        CONSTRAINT FK_time_off_requests_requestedBy_users
            FOREIGN KEY (requestedByUserId)
            REFERENCES app.users(id)
            ON DELETE NO ACTION
            ON UPDATE NO ACTION,

        CONSTRAINT FK_time_off_requests_reviewedBy_users
            FOREIGN KEY (reviewedByUserId)
            REFERENCES app.users(id)
            ON DELETE NO ACTION
            ON UPDATE NO ACTION
    );
END;

------------------------------------------------------------
-- 2) TIME OFF LEDGER (source of truth)
------------------------------------------------------------
IF OBJECT_ID('app.time_off_ledger', 'U') IS NULL
BEGIN
    CREATE TABLE app.time_off_ledger (
        id                INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_time_off_ledger PRIMARY KEY,

        employeeId        INT NOT NULL,
        leaveTypeId       INT NOT NULL,

        amountHours       DECIMAL(7,2) NOT NULL,
        source            NVARCHAR(50) NOT NULL,

        sourceRequestId   INT NULL,
        effectiveDate     DATE NOT NULL,

        memo              NVARCHAR(1000) NULL,

        createdAt         DATETIME2(0) NOT NULL
            CONSTRAINT DF_time_off_ledger_createdAt DEFAULT (SYSDATETIME()),

        createdByUserId   INT NULL,

        CONSTRAINT CK_time_off_ledger_amount_nonzero
            CHECK (amountHours <> 0),

        CONSTRAINT CK_time_off_ledger_source
            CHECK (source IN (
                'OpeningBalance',
                'ManualAdjustment',
                'Accrual',
                'BankedHoliday',
                'OvertimeBank',
                'ApprovedRequest',
                'RequestReversal'
            )),

        CONSTRAINT FK_time_off_ledger_employees
            FOREIGN KEY (employeeId)
            REFERENCES app.employees(id)
            ON DELETE NO ACTION
            ON UPDATE CASCADE,

        CONSTRAINT FK_time_off_ledger_leave_types
            FOREIGN KEY (leaveTypeId)
            REFERENCES app.leave_types(id)
            ON DELETE NO ACTION
            ON UPDATE CASCADE,

        -- IMPORTANT: NO cascading here to avoid cascade-path errors
        -- Also protects ledger history from request deletion.
        CONSTRAINT FK_time_off_ledger_requests
            FOREIGN KEY (sourceRequestId)
            REFERENCES app.time_off_requests(id)
            ON DELETE NO ACTION
            ON UPDATE NO ACTION,

        -- Avoid cascade path issues from users
        CONSTRAINT FK_time_off_ledger_createdBy_users
            FOREIGN KEY (createdByUserId)
            REFERENCES app.users(id)
            ON DELETE NO ACTION
            ON UPDATE NO ACTION
    );
END;

------------------------------------------------------------
-- 3) EMPLOYEE LEAVE BALANCES (cache)
------------------------------------------------------------
IF OBJECT_ID('app.employee_leave_balances', 'U') IS NULL
BEGIN
    CREATE TABLE app.employee_leave_balances (
        employeeId    INT NOT NULL,
        leaveTypeId   INT NOT NULL,

        currentHours  DECIMAL(7,2) NOT NULL
            CONSTRAINT DF_employee_leave_balances_currentHours DEFAULT (0),

        updatedAt     DATETIME2(0) NOT NULL
            CONSTRAINT DF_employee_leave_balances_updatedAt DEFAULT (SYSDATETIME()),

        asOfLedgerId  INT NULL,

        CONSTRAINT PK_employee_leave_balances
            PRIMARY KEY (employeeId, leaveTypeId),

        CONSTRAINT FK_employee_leave_balances_employees
            FOREIGN KEY (employeeId)
            REFERENCES app.employees(id)
            ON DELETE NO ACTION
            ON UPDATE CASCADE,

        CONSTRAINT FK_employee_leave_balances_leave_types
            FOREIGN KEY (leaveTypeId)
            REFERENCES app.leave_types(id)
            ON DELETE NO ACTION
            ON UPDATE CASCADE
    );
END;

------------------------------------------------------------
-- INDEXES
------------------------------------------------------------

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'idx_time_off_requests_employee_status'
      AND object_id = OBJECT_ID('app.time_off_requests')
)
BEGIN
    CREATE INDEX idx_time_off_requests_employee_status
    ON app.time_off_requests(employeeId, status);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'idx_time_off_requests_start_end'
      AND object_id = OBJECT_ID('app.time_off_requests')
)
BEGIN
    CREATE INDEX idx_time_off_requests_start_end
    ON app.time_off_requests(startDateTime, endDateTime);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'idx_time_off_ledger_employee_type'
      AND object_id = OBJECT_ID('app.time_off_ledger')
)
BEGIN
    CREATE INDEX idx_time_off_ledger_employee_type
    ON app.time_off_ledger(employeeId, leaveTypeId);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'idx_time_off_ledger_effectiveDate'
      AND object_id = OBJECT_ID('app.time_off_ledger')
)
BEGIN
    CREATE INDEX idx_time_off_ledger_effectiveDate
    ON app.time_off_ledger(effectiveDate);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'ux_time_off_ledger_approved_request_once'
      AND object_id = OBJECT_ID('app.time_off_ledger')
)
BEGIN
    CREATE UNIQUE INDEX ux_time_off_ledger_approved_request_once
    ON app.time_off_ledger(sourceRequestId)
    WHERE source = 'ApprovedRequest' AND sourceRequestId IS NOT NULL;
END;
