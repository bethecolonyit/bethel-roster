/* 2026-01-05-create_pastors_and_link_students.sql
   Target: Microsoft SQL Server (MSSQL)
   Schema: app
*/

-- 1) Pastors table
IF OBJECT_ID('app.pastors', 'U') IS NULL
BEGIN
    CREATE TABLE app.pastors (
        id        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_pastors PRIMARY KEY,
        fullName  NVARCHAR(150) NOT NULL,
        isActive  BIT NOT NULL CONSTRAINT DF_pastors_isActive DEFAULT (1),
        sortOrder INT NOT NULL CONSTRAINT DF_pastors_sortOrder DEFAULT (0),
        createdAt DATETIME2(0) NOT NULL CONSTRAINT DF_pastors_createdAt DEFAULT (SYSUTCDATETIME()),
        updatedAt DATETIME2(0) NULL
    );

    CREATE UNIQUE INDEX UX_pastors_fullName ON app.pastors(fullName);
    CREATE INDEX IX_pastors_isActive_sort ON app.pastors(isActive, sortOrder, fullName);
END;


-- 2) Add pastorId to students (nullable for staged rollout)
IF COL_LENGTH('app.students', 'pastorId') IS NULL
BEGIN
    ALTER TABLE app.students
      ADD pastorId INT NULL;
END;

-- 3) Foreign key (NO ACTION so deleting a pastor doesn't delete students)
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_students_pastors'
)
BEGIN
    ALTER TABLE app.students
      ADD CONSTRAINT FK_students_pastors
      FOREIGN KEY (pastorId)
      REFERENCES app.pastors(id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION;
END;
