-- OPTIONAL SEED EXAMPLE (edit names)
IF NOT EXISTS (SELECT 1 FROM app.pastors)
BEGIN
    INSERT INTO app.pastors (fullName, isActive, sortOrder)
    VALUES
      (N'Pastor Alphin', 1, 10),
      (N'Pastor Benfield', 1, 20),
      (N'Pastor Frye', 1, 30),
      (N'Pastor Starnes', 1, 40);
END;
