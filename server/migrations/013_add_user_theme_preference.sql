IF COL_LENGTH('app.users', 'themePreference') IS NULL
BEGIN
  EXEC(N'ALTER TABLE app.users ADD themePreference NVARCHAR(10) NULL;');
END;

IF COL_LENGTH('app.users', 'themePreference') IS NOT NULL
BEGIN
  EXEC(N'UPDATE app.users SET themePreference = N''light'' WHERE themePreference IS NULL;');
END;
