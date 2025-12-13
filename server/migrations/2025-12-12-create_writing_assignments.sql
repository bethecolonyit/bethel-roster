/* 2025-12-12-create_writing_assignments.sql
   Target: Microsoft SQL Server (MSSQL)
   Schema: app
*/

IF OBJECT_ID('app.writing_assignments', 'U') IS NULL
BEGIN
    CREATE TABLE app.writing_assignments (
        id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_writing_assignments PRIMARY KEY,

        userId      INT NOT NULL,
        studentId   INT NOT NULL,

        dateIssued  DATETIME2(0) NOT NULL,
        dateDue     DATETIME2(0) NOT NULL,

        infraction  NVARCHAR(MAX) NULL,
        scripture   NVARCHAR(MAX) NULL,
        demerits    INT NOT NULL CONSTRAINT DF_writing_assignments_demerits DEFAULT (0),

        isComplete  BIT NOT NULL CONSTRAINT DF_writing_assignments_isComplete DEFAULT (0),

        CONSTRAINT FK_writing_assignments_users
            FOREIGN KEY (userId) REFERENCES app.users(id)
            ON DELETE NO ACTION
            ON UPDATE CASCADE,

        CONSTRAINT FK_writing_assignments_students
            FOREIGN KEY (studentId) REFERENCES app.students(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
    );
END;

--------------------------------------------------------------------------------
-- Indexes (idempotent)
--------------------------------------------------------------------------------

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_writing_assignments_studentId'
      AND object_id = OBJECT_ID('app.writing_assignments')
)
BEGIN
    CREATE INDEX idx_writing_assignments_studentId
    ON app.writing_assignments(studentId);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_writing_assignments_userId'
      AND object_id = OBJECT_ID('app.writing_assignments')
)
BEGIN
    CREATE INDEX idx_writing_assignments_userId
    ON app.writing_assignments(userId);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_writing_assignments_studentId_isComplete'
      AND object_id = OBJECT_ID('app.writing_assignments')
)
BEGIN
    CREATE INDEX idx_writing_assignments_studentId_isComplete
    ON app.writing_assignments(studentId, isComplete);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_writing_assignments_dateDue'
      AND object_id = OBJECT_ID('app.writing_assignments')
)
BEGIN
    CREATE INDEX idx_writing_assignments_dateDue
    ON app.writing_assignments(dateDue);
END;
