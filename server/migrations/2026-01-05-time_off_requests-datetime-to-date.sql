/* 2026-01-05-time_off_requests-datetime-to-date.sql
   Target: Microsoft SQL Server (MSSQL)
   Schema: app
   Purpose: Convert time_off_requests start/end from DATETIME2 to DATE (date-only) to remove TZ drift.

   IMPORTANT:
   - This script avoids GO and uses dynamic SQL where needed,
     so it works with Node-based migrators that send the entire file as one batch.
*/

BEGIN TRY
  BEGIN TRAN;

  -- 1) Add new DATE columns (nullable temporarily)
  IF COL_LENGTH('app.time_off_requests', 'startDate') IS NULL
    EXEC('ALTER TABLE app.time_off_requests ADD startDate DATE NULL;');

  IF COL_LENGTH('app.time_off_requests', 'endDate') IS NULL
    EXEC('ALTER TABLE app.time_off_requests ADD endDate DATE NULL;');

  -- 2) Backfill from existing DATETIME2 columns (dynamic SQL so new columns are visible)
  IF COL_LENGTH('app.time_off_requests', 'startDateTime') IS NOT NULL
     AND COL_LENGTH('app.time_off_requests', 'endDateTime') IS NOT NULL
  BEGIN
    EXEC('
      UPDATE r
      SET
        startDate = COALESCE(startDate, CAST(r.startDateTime AS DATE)),
        endDate   = COALESCE(endDate,   CAST(r.endDateTime   AS DATE))
      FROM app.time_off_requests r;
    ');
  END

  -- 3) Enforce NOT NULL if there are no nulls after backfill
  -- (If you want hard failure when nulls exist, keep this as-is.)
  DECLARE @nullStart INT = 0, @nullEnd INT = 0;

  EXEC sp_executesql N'
    SELECT
      @nullStart = SUM(CASE WHEN startDate IS NULL THEN 1 ELSE 0 END),
      @nullEnd   = SUM(CASE WHEN endDate   IS NULL THEN 1 ELSE 0 END)
    FROM app.time_off_requests;
  ',
  N'@nullStart INT OUTPUT, @nullEnd INT OUTPUT',
  @nullStart=@nullStart OUTPUT, @nullEnd=@nullEnd OUTPUT;

  IF @nullStart > 0 OR @nullEnd > 0
  BEGIN
    -- Roll back with a helpful error message
    DECLARE @msg NVARCHAR(200) =
      CONCAT('Cannot enforce NOT NULL: startDate NULLs=', @nullStart, ', endDate NULLs=', @nullEnd);
    RAISERROR(@msg, 16, 1);
  END

  EXEC('ALTER TABLE app.time_off_requests ALTER COLUMN startDate DATE NOT NULL;');
  EXEC('ALTER TABLE app.time_off_requests ALTER COLUMN endDate   DATE NOT NULL;');

  -- 4) (Optional) Add indexes for common filters
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_time_off_requests_employee_startDate'
      AND object_id = OBJECT_ID('app.time_off_requests')
  )
  BEGIN
    EXEC('CREATE INDEX IX_time_off_requests_employee_startDate ON app.time_off_requests(employeeId, startDate);');
  END

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_time_off_requests_employee_endDate'
      AND object_id = OBJECT_ID('app.time_off_requests')
  )
  BEGIN
    EXEC('CREATE INDEX IX_time_off_requests_employee_endDate ON app.time_off_requests(employeeId, endDate);');
  END

  -- 5) Drop old DATETIME2 columns (dynamic SQL)
  IF COL_LENGTH('app.time_off_requests', 'startDateTime') IS NOT NULL
    EXEC('ALTER TABLE app.time_off_requests DROP COLUMN startDateTime;');

  IF COL_LENGTH('app.time_off_requests', 'endDateTime') IS NOT NULL
    EXEC('ALTER TABLE app.time_off_requests DROP COLUMN endDateTime;');

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
