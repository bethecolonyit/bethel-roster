/* 2025-12-14-fix_bed_assignments_student_fk_cascade.sql
   Target: Microsoft SQL Server (MSSQL)
   Schema: app
   Purpose:
     Change FK from app.bed_assignments(student_id) -> app.students(id)
     to ON DELETE CASCADE / ON UPDATE CASCADE
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRAN;

    ------------------------------------------------------------------------
    -- Validate objects exist
    ------------------------------------------------------------------------
    IF OBJECT_ID('app.bed_assignments', 'U') IS NULL
        THROW 50001, 'Table app.bed_assignments does not exist.', 1;

    IF OBJECT_ID('app.students', 'U') IS NULL
        THROW 50002, 'Table app.students does not exist.', 1;

    IF COL_LENGTH('app.bed_assignments', 'student_id') IS NULL
        THROW 50003, 'Column app.bed_assignments.student_id does not exist.', 1;

    ------------------------------------------------------------------------
    -- Drop existing FK(s) from bed_assignments.student_id to students.id
    -- (Handles unknown FK names / prior naming differences)
    ------------------------------------------------------------------------
    DECLARE @DropSql NVARCHAR(MAX) = N'';

    SELECT @DropSql = @DropSql +
        N'ALTER TABLE app.bed_assignments DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';' + CHAR(10)
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc
        ON fk.object_id = fkc.constraint_object_id
    INNER JOIN sys.tables t_child
        ON fkc.parent_object_id = t_child.object_id
    INNER JOIN sys.schemas s_child
        ON t_child.schema_id = s_child.schema_id
    INNER JOIN sys.columns c_child
        ON c_child.object_id = t_child.object_id
       AND c_child.column_id = fkc.parent_column_id
    INNER JOIN sys.tables t_parent
        ON fkc.referenced_object_id = t_parent.object_id
    INNER JOIN sys.schemas s_parent
        ON t_parent.schema_id = s_parent.schema_id
    INNER JOIN sys.columns c_parent
        ON c_parent.object_id = t_parent.object_id
       AND c_parent.column_id = fkc.referenced_column_id
    WHERE s_child.name = 'app'
      AND t_child.name = 'bed_assignments'
      AND c_child.name = 'student_id'
      AND s_parent.name = 'app'
      AND t_parent.name = 'students'
      AND c_parent.name = 'id';

    IF (@DropSql <> N'')
    BEGIN
        EXEC sp_executesql @DropSql;
    END

    ------------------------------------------------------------------------
    -- Create FK with ON DELETE CASCADE / ON UPDATE CASCADE (idempotent)
    ------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_bed_assignments_students'
          AND parent_object_id = OBJECT_ID('app.bed_assignments')
    )
    BEGIN
        ALTER TABLE app.bed_assignments WITH CHECK
        ADD CONSTRAINT FK_bed_assignments_students
            FOREIGN KEY (student_id)
            REFERENCES app.students(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE;

        -- Ensure the FK is trusted
        ALTER TABLE app.bed_assignments CHECK CONSTRAINT FK_bed_assignments_students;
    END

    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;

    DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @num INT = ERROR_NUMBER();
    DECLARE @state INT = ERROR_STATE();
    THROW 51000, @msg, 1;
END CATCH;
