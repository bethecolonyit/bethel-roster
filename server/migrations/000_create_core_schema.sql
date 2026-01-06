/* 000_create_core_schema.sql
   Target: Microsoft SQL Server (MSSQL)
   Schema: app
   Purpose: Pre-baseline core tables to satisfy dependencies.
   Notes: No GO statements; idempotent; safe on existing deployments.
*/

IF SCHEMA_ID('app') IS NULL
BEGIN
  EXEC('CREATE SCHEMA app');
END;

-- buildings
IF OBJECT_ID('app.buildings', 'U') IS NULL
BEGIN
  CREATE TABLE app.buildings (
    id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_buildings PRIMARY KEY,
    buildingName NVARCHAR(150) NOT NULL CONSTRAINT UQ_buildings_buildingName UNIQUE
  );
END;

-- rooms
IF OBJECT_ID('app.rooms', 'U') IS NULL
BEGIN
  CREATE TABLE app.rooms (
    id         INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_rooms PRIMARY KEY,
    buildingId INT NOT NULL,
    roomNumber NVARCHAR(50) NOT NULL,
    roomType   NVARCHAR(20) NOT NULL,
    CONSTRAINT CK_rooms_roomType CHECK (roomType IN (N'student', N'staff', N'vsp', N'kitchen')),
    CONSTRAINT FK_rooms_buildings FOREIGN KEY (buildingId)
      REFERENCES app.buildings(id)
      ON DELETE CASCADE
      ON UPDATE CASCADE
  );
END;

-- beds
IF OBJECT_ID('app.beds', 'U') IS NULL
BEGIN
  CREATE TABLE app.beds (
    id        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_beds PRIMARY KEY,
    roomId    INT NOT NULL,
    bedLetter NCHAR(1) NOT NULL,
    CONSTRAINT CK_beds_bedLetter CHECK (bedLetter IN (N'A', N'B', N'C', N'D')),
    CONSTRAINT FK_beds_rooms FOREIGN KEY (roomId)
      REFERENCES app.rooms(id)
      ON DELETE CASCADE
      ON UPDATE CASCADE
  );
END;

-- students (aligned to your MSSQL app expectations: first/last NOT NULL)
IF OBJECT_ID('app.students', 'U') IS NULL
BEGIN
  CREATE TABLE app.students (
    id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_students PRIMARY KEY,
    firstName        NVARCHAR(100) NOT NULL,
    lastName         NVARCHAR(100) NOT NULL,
    idNumber         NVARCHAR(50)  NULL,
    counselor        NVARCHAR(150) NULL,
    program          NVARCHAR(100) NULL,
    dayin            DATE NULL,
    dayout           DATE NULL,
    isFelon          BIT NOT NULL CONSTRAINT DF_students_isFelon DEFAULT(0),
    onProbation      BIT NOT NULL CONSTRAINT DF_students_onProbation DEFAULT(0),
    usesNicotine     BIT NOT NULL CONSTRAINT DF_students_usesNicotine DEFAULT(0),
    hasDriverLicense BIT NOT NULL CONSTRAINT DF_students_hasDriverLicense DEFAULT(0),
    foodAllergies    BIT NOT NULL CONSTRAINT DF_students_foodAllergies DEFAULT(0),
    beeAllergies     BIT NOT NULL CONSTRAINT DF_students_beeAllergies DEFAULT(0)
  );
END;

-- users
IF OBJECT_ID('app.users', 'U') IS NULL
BEGIN
  CREATE TABLE app.users (
    id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
    email         NVARCHAR(255) NOT NULL CONSTRAINT UQ_users_email UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    role          NVARCHAR(50)  NOT NULL,
    created_at    DATETIME2(0)  NOT NULL CONSTRAINT DF_users_created_at DEFAULT (SYSUTCDATETIME())
  );
END;

-- bed_assignments
IF OBJECT_ID('app.bed_assignments', 'U') IS NULL
BEGIN
  CREATE TABLE app.bed_assignments (
    id         INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_bed_assignments PRIMARY KEY,
    bed_id     INT NOT NULL,
    student_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date   DATE NULL,
    CONSTRAINT FK_bed_assignments_beds FOREIGN KEY (bed_id)
      REFERENCES app.beds(id)
      ON DELETE NO ACTION
      ON UPDATE CASCADE,
    CONSTRAINT FK_bed_assignments_students FOREIGN KEY (student_id)
      REFERENCES app.students(id)
      ON DELETE CASCADE
      ON UPDATE CASCADE
  );
END;
