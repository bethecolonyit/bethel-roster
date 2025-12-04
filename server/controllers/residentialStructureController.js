// controllers/residentialStructureController.js
const { ensureAuthenticated } = require('../middleware/auth');
function registerResidentialStructureRoutes(app, db) {
  // GET /residential/structure
  app.get('/residential/structure', ensureAuthenticated, (req, res) => {
    try {
      const rows = db
        .prepare(`
          SELECT
            bl.id          AS buildingId,
            bl.buildingName,

            r.id           AS roomId,
            r.roomNumber,
            r.roomType,

            b.id           AS bedId,
            b.bedLetter,

            ba.id          AS assignmentId,
            ba.start_date  AS assignmentStartDate,
            ba.end_date    AS assignmentEndDate,

            s.id           AS studentId,
            s.firstName    AS studentFirstName,
            s.lastName     AS studentLastName,
            s.idNumber     AS studentCode
          FROM buildings bl
          LEFT JOIN rooms r
            ON r.buildingId = bl.id
          LEFT JOIN beds b
            ON b.roomId = r.id
          LEFT JOIN bed_assignments ba
            ON ba.bed_id = b.id AND ba.end_date IS NULL
          LEFT JOIN students s
            ON s.id = ba.student_id
          ORDER BY bl.buildingName, r.roomNumber, b.bedLetter;
        `)
        .all();

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

        let room = building.rooms.find(r => r.id === row.roomId);
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
        building.availableBeds =
          building.totalBeds - building.occupiedBeds;
      }

      res.json(Array.from(buildingsMap.values()));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch residential structure' });
    }
  });
}

module.exports = registerResidentialStructureRoutes;
