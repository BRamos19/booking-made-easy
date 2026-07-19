// Seeds the database with demo data. Safe to re-run: it wipes and rebuilds.
import bcrypt from 'bcrypt';
import * as dal from '../dal/index.js';

const SEAT_ROWS = 10;
const SEAT_COLUMNS = ['A', 'B', 'C', 'D'];
const OCCUPIED_SEATS_PER_ROUTE = 8;
const OCCUPANCY_DAYS = 30;

// Deterministic PRNG so re-seeding picks the same "occupied" seats per route.
function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const stations = [
  { cityName: 'Miami', stationCode: 'MIA' },
  { cityName: 'Fort Lauderdale', stationCode: 'FTL' },
  { cityName: 'West Palm Beach', stationCode: 'WPB' },
  { cityName: 'Orlando', stationCode: 'ORL' },
  { cityName: 'Tampa', stationCode: 'TPA' },
  { cityName: 'Jacksonville', stationCode: 'JAX' },
  { cityName: 'Tallahassee', stationCode: 'TLH' },
  { cityName: 'Pensacola', stationCode: 'PNS' },
];

const trains = [
  { trainNumber: 'FT 101', trainName: 'Sunshine Express' },
  { trainNumber: 'FT 205', trainName: 'Gulf Coast Flyer' },
  { trainNumber: 'FT 310', trainName: 'Everglades Runner' },
  { trainNumber: 'FT 412', trainName: 'Atlantic Breeze' },
  { trainNumber: 'FT 520', trainName: 'Panhandle Star' },
  { trainNumber: 'FT 633', trainName: 'Citrus Limited' },
];

// [trainIdx, originCode, destCode, departure, arrival, fare]
const routeDefs = [
  [0, 'MIA', 'ORL', '07:15', '10:45', 59],
  [0, 'ORL', 'MIA', '12:30', '16:00', 59],
  [1, 'MIA', 'TPA', '08:00', '12:20', 65],
  [1, 'TPA', 'MIA', '14:10', '18:30', 65],
  [2, 'MIA', 'FTL', '06:45', '07:25', 29],
  [2, 'FTL', 'WPB', '07:50', '08:40', 32],
  [3, 'MIA', 'ORL', '13:05', '16:40', 49],
  [3, 'ORL', 'JAX', '17:20', '19:35', 45],
  [4, 'JAX', 'TLH', '09:10', '11:55', 55],
  [4, 'TLH', 'PNS', '12:40', '15:30', 62],
  [5, 'ORL', 'TPA', '10:00', '11:35', 39],
  [5, 'TPA', 'ORL', '13:15', '14:50', 39],
  [3, 'WPB', 'ORL', '09:30', '12:15', 52],
  [4, 'MIA', 'JAX', '05:50', '11:40', 149],
];

function minutesBetween(dep, arr) {
  const [dh, dm] = dep.split(':').map(Number);
  const [ah, am] = arr.split(':').map(Number);
  return ah * 60 + am - (dh * 60 + dm);
}

function isoDatePlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function seed() {
  dal.applySchema();
  dal.transaction(() => {
    // Wipe in FK-safe order.
    for (const table of ['payments', 'passengers', 'bookings', 'seat_locks', 'seats', 'routes', 'trains', 'stations', 'users']) {
      dal.rawRun(`DELETE FROM ${table}`);
      dal.rawRun(`DELETE FROM sqlite_sequence WHERE name = '${table}'`);
    }
  });

  const demoUser = dal.createUser({
    email: 'demo@freedomtravels.com',
    passwordHash: bcrypt.hashSync('Demo1234', 10),
    fullName: 'Demo Traveler',
  });
  // Owns the seeded "already sold" seats so the seat map shows occupancy.
  const systemUser = dal.createUser({
    email: 'system@freedomtravels.com',
    passwordHash: bcrypt.hashSync('not-a-login-account', 10),
    fullName: 'Freedom Travels System',
  });

  const stationIdByCode = {};
  for (const station of stations) {
    stationIdByCode[station.stationCode] = dal.seedStation(station);
  }

  const trainIds = trains.map((train) => dal.seedTrain(train));

  let routeCount = 0;
  let occupancyBookings = 0;
  for (const [trainIdx, originCode, destCode, departureTime, arrivalTime, baseFare] of routeDefs) {
    const routeId = dal.seedRoute({
      trainId: trainIds[trainIdx],
      originStationId: stationIdByCode[originCode],
      destinationStationId: stationIdByCode[destCode],
      departureTime,
      arrivalTime,
      durationMinutes: minutesBetween(departureTime, arrivalTime),
      baseFare,
    });
    routeCount += 1;

    const seatIds = [];
    for (let row = 1; row <= SEAT_ROWS; row += 1) {
      for (const column of SEAT_COLUMNS) {
        seatIds.push(dal.seedSeat({
          routeId,
          seatNumber: `${row}${column}`,
          seatRow: row,
          seatColumn: column,
        }));
      }
    }

    // Pre-occupy ~8 deterministic seats for each of the next OCCUPANCY_DAYS
    // travel dates via confirmed system bookings, so any near-future search
    // shows a partially sold seat map.
    const random = mulberry32(routeId * 7919);
    const occupied = [...seatIds].sort(() => random() - 0.5).slice(0, OCCUPIED_SEATS_PER_ROUTE);
    dal.transaction(() => {
      for (let day = 0; day < OCCUPANCY_DAYS; day += 1) {
        const travelDate = isoDatePlusDays(day);
        const subtotal = baseFare * occupied.length;
        const taxes = Math.round(subtotal * 7) / 100;
        const fees = 2.5 * occupied.length;
        const booking = dal.createBooking({
          bookingReference: `FT-SEED-${routeId}-${day}`,
          userId: systemUser.userId,
          routeId,
          travelDate,
          contactEmail: 'system@freedomtravels.com',
          contactPhone: '000-000-0000',
          subtotal,
          taxes,
          fees,
          total: subtotal + taxes + fees,
          status: 'confirmed',
        });
        occupancyBookings += 1;
        occupied.forEach((seatId, index) => {
          dal.createPassenger({
            bookingId: booking.bookingId,
            seatId,
            fullName: `Seed Passenger ${index + 1}`,
            dateOfBirth: '1990-01-01',
          });
        });
      }
    });
  }

  console.log('Seed complete:');
  console.log(`  stations: ${stations.length}, trains: ${trains.length}, routes: ${routeCount}`);
  console.log(`  seats per route: ${SEAT_ROWS * SEAT_COLUMNS.length}`);
  console.log(`  occupancy bookings: ${occupancyBookings} (${OCCUPIED_SEATS_PER_ROUTE} seats x ${OCCUPANCY_DAYS} days per route)`);
  console.log(`  demo user: ${demoUser.email} / Demo1234`);
}

seed();
