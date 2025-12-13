// controllers/residentialStructureController.js (MSSQL)
const { ensureAuthenticated } = require('../middleware/auth');

function registerResidentialStructureRoutes(app, db) {
  const { query } = db;

  // GET /residential/structure
  app.get('/residential/structure', ensureAuthenticated, async (req, res) => {
    try {
      const r = await query(`
        SELECT
          bl.id          AS buildingId,
          bl.buildingName,

          rm.id          AS roomId,
          rm.roomNumber,
          rm.roomType,

          bd.id          AS bedId,
          bd.bedLetter,

          ba.id          AS assignmentId,
          ba.start_date  AS assignmentStartDate,
          ba.end_date    AS assignmentEndDate,

          s.id           AS studentId,
          s.firstName    AS studentFirstName,
          s.lastName     AS studentLastName,
          s.idNumber     AS studentCode
        FROM app.buildings bl
        LEFT JOIN app.rooms rm
          ON rm.buildingId = bl.id
        LEFT JOIN app.beds bd
          ON bd.roomId = rm.id
        LEFT JOIN app.bed_assignments ba
          ON ba.bed_id = bd.id AND ba.end_date IS NULL
        LEFT JOIN app.students s
          ON s.id = ba.student_id
        ORDER BY bl.buildingName, rm.roomNumber, bd.bedLetter;
      `);

      const rows = r.recordset;
      const buildingsMap = new Map();

      for (const row of rows) {
        let building = buildingsMap.get(row.buildingId);
        if (!building) {
          building = {
            id: row.buildingId,
            buildingName: row.buildingName,
            rooms: [],
            totalBeds: 0,
            occupiedBeds: 0,
            availableBeds: 0,
          };
          buildingsMap.set(row.buildingId, building);
        }

        if (!row.roomId) continue;

        let room = building.rooms.find(rr => rr.id === row.roomId);
        if (!room) {
          room = {
            id: row.roomId,
            roomNumber: row.roomNumber,
            roomType: row.roomType,
            beds: [],
            totalBeds: 0,
            occupiedBeds: 0,
            availableBeds: 0,
          };
          building.rooms.push(room);
        }

        if (!row.bedId) continue;

        const hasAssignment = !!row.assignmentId;

        const bed = {
          id: row.bedId,
          bedLetter: row.bedLetter,
          occupancy: hasAssignment
            ? {
                assignmentId: row.assignmentId,
                startDate: row.assignmentStartDate,
                student: row.studentId
                  ? {
                      id: row.studentId,
                      firstName: row.studentFirstName,
                      lastName: row.studentLastName,
                      studentId: row.studentCode,
                    }
                  : null,
              }
            : null,
        };

        room.beds.push(bed);

        room.totalBeds += 1;
        building.totalBeds += 1;

        if (hasAssignment) {
          room.occupiedBeds += 1;
          building.occupiedBeds += 1;
        }
      }

      for (const building of buildingsMap.values()) {
        for (const room of building.rooms) {
          room.availableBeds = room.totalBeds - room.occupiedBeds;
        }
        building.availableBeds = building.totalBeds - building.occupiedBeds;
      }

      res.json(Array.from(buildingsMap.values()));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch residential structure' });
    }
  });
}

module.exports = registerResidentialStructureRoutes;
