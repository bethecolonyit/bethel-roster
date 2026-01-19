/*
  2026-01-19-add-ged-and-tutoring-to-students.sql
  Target: Microsoft SQL Server (MSSQL)
  Schema: app
  Table: students

  Adds:
    - enrolledInGed (BIT, NOT NULL, DEFAULT 0)
    - tutoring      (BIT, NOT NULL, DEFAULT 0)
*/

-- enrolledInGed
IF COL_LENGTH('app.students', 'enrolledInGed') IS NULL
BEGIN
    ALTER TABLE app.students
    ADD enrolledInGed BIT NOT NULL
        CONSTRAINT DF_students_enrolledInGed DEFAULT (0);
END


-- tutoring
IF COL_LENGTH('app.students', 'tutoring') IS NULL
BEGIN
    ALTER TABLE app.students
    ADD tutoring BIT NOT NULL
        CONSTRAINT DF_students_tutoring DEFAULT (0);
END;
