/*
  Add supporting index for student demerit aggregation
  Target: Microsoft SQL Server (MSSQL)
  Schema: app
*/

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_writing_assignments_studentId'
      AND object_id = OBJECT_ID('app.writing_assignments')
)
BEGIN
    CREATE INDEX IX_writing_assignments_studentId
        ON app.writing_assignments (studentId)
        INCLUDE (demerits);
END;
