/* 2026-01-05-time_off_requests-datetime-to-date-v2.sql
   Target: Microsoft SQL Server (MSSQL)
   Schema: app
   Purpose: Convert time_off_requests start/end from DATETIME2 to DATE (date-only), including dependent objects.
   Handles:
     - CK_time_off_requests_date_order (check constraint)
     - idx_time_off_requests_start_end (index)
   Avoids GO; uses dynamic SQL where needed for Node-based migration runners.
*/

BEGIN TRY
  BEGIN TRAN;

  --------------------------------------------------------------------
  -- 0) Drop dependent objects that reference the old columns
  --------------------------------------------------------------------

  -- Drop check constraint if it exists
  IF EXISTS (
    SELECT 1
    FROM sys.check_constraints cc
    WHERE cc.name = 'CK_time_off_requests_date_order'
      AND cc.parent_object_id = OBJECT_ID('app.time_off_requests')
  )
  BEGIN
    EXEC('ALTER TABLE app.time_off_requests DROP CONSTRAINT CK_time_off_requests_date_order;');
  END

  -- Drop index if it exists
  IF EXISTS (
    SELECT 1
    FROM sys.indexes i
    WHERE i.name = 'idx_time_off_requests_start_end'
      AND i.object_id = OBJECT_ID('app.time_off_requests')
  )
  BEGIN
    EXEC('DROP INDEX idx_time_off_requests_start_end ON app.time_off_requests;');
  END

  --------------------------------------------------------------------
  -- 1) Add new DATE columns (nullable temporarily)
  --------------------------------------------------------------------
  IF COL_LENGTH('app.time_off_requests', 'startDate') IS NULL
    EXEC('ALTER TABLE app.time_off_requests ADD startDate DATE NULL;');

  IF COL_LENGTH('app.time_off_requests', 'endDate') IS NULL
    EXEC('ALTER TABLE app.time_off_requests ADD endDate DATE NULL;');

  --------------------------------------------------------------------
  -- 2) Backfill from existing DATETIME2 columns (if they exist)
  --------------------------------------------------------------------
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

  --------------------------------------------------------------------
  -- 3) Enforce NOT NULL after backfill (fail with clear message if not)
  --------------------------------------------------------------------
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
    DECLARE @msg NVARCHAR(200) =
      CONCAT('Cannot enforce NOT NULL: startDate NULLs=', @nullStart, ', endDate NULLs=', @nullEnd);
    RAISERROR(@msg, 16, 1);
  END

  EXEC('ALTER TABLE app.time_off_requests ALTER COLUMN startDate DATE NOT NULL;');
  EXEC('ALTER TABLE app.time_off_requests ALTER COLUMN endDate   DATE NOT NULL;');

  --------------------------------------------------------------------
  -- 4) Drop old DATETIME2 columns (if present)
  --------------------------------------------------------------------
  IF COL_LENGTH('app.time_off_requests', 'startDateTime') IS NOT NULL
    EXEC('ALTER TABLE app.time_off_requests DROP COLUMN startDateTime;');

  IF COL_LENGTH('app.time_off_requests', 'endDateTime') IS NOT NULL
    EXEC('ALTER TABLE app.time_off_requests DROP COLUMN endDateTime;');

  --------------------------------------------------------------------
  -- 5) Recreate check constraint on new DATE columns
  --    (Equivalent business rule: startDate <= endDate)
  --------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints cc
    WHERE cc.name = 'CK_time_off_requests_date_order'
      AND cc.parent_object_id = OBJECT_ID('app.time_off_requests')
  )
  BEGIN
    EXEC('
      ALTER TABLE app.time_off_requests
      ADD CONSTRAINT CK_time_off_requests_date_order
      CHECK (startDate <= endDate);
    ');
  END

  --------------------------------------------------------------------
  -- 6) Recreate index on new DATE columns
  --------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes i
    WHERE i.name = 'idx_time_off_requests_start_end'
      AND i.object_id = OBJECT_ID('app.time_off_requests')
  )
  BEGIN
    EXEC('
      CREATE INDEX idx_time_off_requests_start_end
      ON app.time_off_requests(startDate, endDate);
    ');
  END

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
