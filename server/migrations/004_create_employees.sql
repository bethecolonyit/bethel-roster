/* 2025-12-13-create_employees.sql
   Target: Microsoft SQL Server (MSSQL)
   Schema: app
*/

IF OBJECT_ID('app.employees', 'U') IS NULL
BEGIN
    CREATE TABLE app.employees (
        id        INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_employees PRIMARY KEY,

        -- Nullable so we can keep employee records even if a user account is deleted
        userId    INT NULL,

        firstName NVARCHAR(100) NOT NULL,
        lastName  NVARCHAR(100) NOT NULL,

        hireDate  DATE NOT NULL,

        CONSTRAINT FK_employees_users
            FOREIGN KEY (userId)
            REFERENCES app.users(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE
    );
END;

--------------------------------------------------------------------------------
-- Indexes (idempotent)
--------------------------------------------------------------------------------

-- Helpful for joins from employees -> users
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_employees_userId'
      AND object_id = OBJECT_ID('app.employees')
)
BEGIN
    CREATE INDEX idx_employees_userId
    ON app.employees(userId);
END;

-- Enforce 1 employee per user (while still allowing multiple NULL userId rows)
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'ux_employees_userId'
      AND object_id = OBJECT_ID('app.employees')
)
BEGIN
    CREATE UNIQUE INDEX ux_employees_userId
    ON app.employees(userId)
    WHERE userId IS NOT NULL;
END;
