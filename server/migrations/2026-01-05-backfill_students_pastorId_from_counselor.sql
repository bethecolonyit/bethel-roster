/* 2026-01-05-backfill_students_pastorId_from_counselor.sql
   Target: Microsoft SQL Server (MSSQL)
   Schema: app

   Runs ONLY:
   4) Add FK app.students.pastorId -> app.pastors.id (if missing)
   5) Insert missing pastors from distinct students.counselor (trimmed)
   6) Backfill students.pastorId by matching counselor -> pastors.fullName (trimmed)

   Assumes:
   - app.pastors exists and has columns: id, fullName (at minimum)
   - app.students has columns: pastorId, counselor
*/

SET NOCOUNT ON;

BEGIN TRY
  BEGIN TRAN;

  ---------------------------------------------------------------------------
  -- 4) Ensure FK students.pastorId -> pastors.id exists
  ---------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_students_pastors'
      AND parent_object_id = OBJECT_ID('app.students')
  )
  BEGIN
    ALTER TABLE app.students WITH CHECK
      ADD CONSTRAINT FK_students_pastors
      FOREIGN KEY (pastorId) REFERENCES app.pastors(id)
      ON DELETE SET NULL
      ON UPDATE NO ACTION;

    ALTER TABLE app.students CHECK CONSTRAINT FK_students_pastors;
  END

  ---------------------------------------------------------------------------
  -- 5) Insert missing pastors from students.counselor (trimmed)
  --    Only inserts non-empty counselor strings that don't already exist.
  ---------------------------------------------------------------------------
  INSERT INTO app.pastors (fullName, isActive, sortOrder)
  SELECT DISTINCT
    LTRIM(RTRIM(s.counselor)) AS fullName,
    1 AS isActive,
    1000 AS sortOrder
  FROM app.students s
  WHERE s.counselor IS NOT NULL
    AND LTRIM(RTRIM(s.counselor)) <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM app.pastors p
      WHERE p.fullName = LTRIM(RTRIM(s.counselor))
    );

  ---------------------------------------------------------------------------
  -- 6) Backfill students.pastorId by matching counselor -> pastors.fullName
  ---------------------------------------------------------------------------
  UPDATE s
  SET s.pastorId = p.id
  FROM app.students s
  JOIN app.pastors p
    ON p.fullName = LTRIM(RTRIM(s.counselor))
  WHERE s.counselor IS NOT NULL
    AND LTRIM(RTRIM(s.counselor)) <> ''
    AND (s.pastorId IS NULL OR s.pastorId = 0);

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;

  DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
  DECLARE @ErrLine INT = ERROR_LINE();
  DECLARE @ErrNum INT = ERROR_NUMBER();

  RAISERROR('Migration failed (Error %d at line %d): %s', 16, 1, @ErrNum, @ErrLine, @ErrMsg);
END CATCH;
