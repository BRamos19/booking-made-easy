// Database Access Layer.
// The only module that talks to SQLite and the only place snake_case column
// names appear. Everything above this layer (services, routes) works with
// camelCase objects, so swapping SQLite for PostgreSQL means rewriting this
// file only.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirName = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(dirName, '..', '..', 'db.sqlite');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function applySchema() {
  const schema = fs.readFileSync(path.join(dirName, '..', 'db', 'schema.sql'), 'utf8');
  db.exec(schema);
}

// Runs fn atomically; better-sqlite3 transactions are synchronous.
export function transaction(fn) {
  return db.transaction(fn)();
}

// ------------------------------------------------- seed-only helpers
// Used by the seed script to build reference data; not called by services.

export function rawRun(sql) {
  db.prepare(sql).run();
}

export function seedStation({ cityName, stationCode }) {
  return db
    .prepare('INSERT INTO stations (city_name, station_code) VALUES (?, ?)')
    .run(cityName, stationCode).lastInsertRowid;
}

export function seedTrain({ trainNumber, trainName }) {
  return db
    .prepare('INSERT INTO trains (train_number, train_name) VALUES (?, ?)')
    .run(trainNumber, trainName).lastInsertRowid;
}

export function seedRoute({
  trainId, originStationId, destinationStationId,
  departureTime, arrivalTime, durationMinutes, baseFare,
}) {
  return db.prepare(`
    INSERT INTO routes (
      train_id, origin_station_id, destination_station_id,
      departure_time, arrival_time, duration_minutes, base_fare
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    trainId, originStationId, destinationStationId,
    departureTime, arrivalTime, durationMinutes, baseFare,
  ).lastInsertRowid;
}

export function seedSeat({ routeId, seatNumber, seatRow, seatColumn }) {
  return db
    .prepare('INSERT INTO seats (route_id, seat_number, seat_row, seat_column) VALUES (?, ?, ?, ?)')
    .run(routeId, seatNumber, seatRow, seatColumn).lastInsertRowid;
}

// ---------------------------------------------------------------- users

export function createUser({ email, passwordHash, fullName }) {
  const result = db
    .prepare('INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)')
    .run(email, passwordHash, fullName);
  return getUserById(result.lastInsertRowid);
}

export function getUserById(userId) {
  const row = db
    .prepare('SELECT user_id, email, password_hash, full_name, created_at FROM users WHERE user_id = ?')
    .get(userId);
  return row ? mapUser(row) : null;
}

export function getUserByEmail(email) {
  const row = db
    .prepare('SELECT user_id, email, password_hash, full_name, created_at FROM users WHERE email = ?')
    .get(email);
  return row ? mapUser(row) : null;
}

function mapUser(row) {
  return {
    userId: row.user_id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    createdAt: row.created_at,
  };
}

// ------------------------------------------------------------- stations

export function listStations() {
  return db
    .prepare('SELECT station_id, city_name, station_code FROM stations ORDER BY city_name')
    .all()
    .map((row) => ({
      stationId: row.station_id,
      cityName: row.city_name,
      stationCode: row.station_code,
    }));
}

// --------------------------------------------------------------- routes

const routeSelect = `
  SELECT
    r.route_id, r.train_id, r.origin_station_id, r.destination_station_id,
    r.departure_time, r.arrival_time, r.duration_minutes, r.base_fare,
    t.train_number, t.train_name,
    os.city_name AS origin_city, os.station_code AS origin_code,
    ds.city_name AS destination_city, ds.station_code AS destination_code
  FROM routes r
  JOIN trains t ON t.train_id = r.train_id
  JOIN stations os ON os.station_id = r.origin_station_id
  JOIN stations ds ON ds.station_id = r.destination_station_id
`;

function mapRoute(row) {
  return {
    routeId: row.route_id,
    trainId: row.train_id,
    trainNumber: row.train_number,
    trainName: row.train_name,
    originStationId: row.origin_station_id,
    originCity: row.origin_city,
    originCode: row.origin_code,
    destinationStationId: row.destination_station_id,
    destinationCity: row.destination_city,
    destinationCode: row.destination_code,
    departureTime: row.departure_time,
    arrivalTime: row.arrival_time,
    durationMinutes: row.duration_minutes,
    baseFare: row.base_fare,
  };
}

export function findRoutes({ originStationId, destinationStationId }) {
  return db
    .prepare(`${routeSelect} WHERE r.origin_station_id = ? AND r.destination_station_id = ? ORDER BY r.departure_time`)
    .all(originStationId, destinationStationId)
    .map(mapRoute);
}

export function getRouteById(routeId) {
  const row = db.prepare(`${routeSelect} WHERE r.route_id = ?`).get(routeId);
  return row ? mapRoute(row) : null;
}

// ---------------------------------------------------------------- seats

export function listSeatsForRoute(routeId) {
  return db
    .prepare('SELECT seat_id, route_id, seat_number, seat_row, seat_column FROM seats WHERE route_id = ? ORDER BY seat_row, seat_column')
    .all(routeId)
    .map((row) => ({
      seatId: row.seat_id,
      routeId: row.route_id,
      seatNumber: row.seat_number,
      seatRow: row.seat_row,
      seatColumn: row.seat_column,
    }));
}

// Seats permanently assigned for a route + date (passengers of confirmed bookings).
export function getBookedSeatIds({ routeId, travelDate }) {
  return db
    .prepare(`
      SELECT p.seat_id FROM passengers p
      JOIN bookings b ON b.booking_id = p.booking_id
      WHERE b.route_id = ? AND b.travel_date = ? AND b.status = 'confirmed'
    `)
    .all(routeId, travelDate)
    .map((row) => row.seat_id);
}

// ----------------------------------------------------------- seat locks

export function deleteExpiredLocks(nowIso) {
  db.prepare('DELETE FROM seat_locks WHERE expires_at <= ?').run(nowIso);
}

export function getActiveLocks({ routeId, travelDate, nowIso }) {
  return db
    .prepare('SELECT seat_id, session_id, expires_at FROM seat_locks WHERE route_id = ? AND travel_date = ? AND expires_at > ?')
    .all(routeId, travelDate, nowIso)
    .map((row) => ({ seatId: row.seat_id, sessionId: row.session_id, expiresAt: row.expires_at }));
}

export function createLock({ seatId, routeId, travelDate, sessionId, lockedAt, expiresAt }) {
  db.prepare(`
    INSERT INTO seat_locks (seat_id, route_id, travel_date, session_id, locked_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(seatId, routeId, travelDate, sessionId, lockedAt, expiresAt);
}

export function getLocksBySession({ sessionId, nowIso }) {
  return db
    .prepare('SELECT lock_id, seat_id, route_id, travel_date, expires_at FROM seat_locks WHERE session_id = ? AND expires_at > ?')
    .all(sessionId, nowIso)
    .map((row) => ({
      lockId: row.lock_id,
      seatId: row.seat_id,
      routeId: row.route_id,
      travelDate: row.travel_date,
      expiresAt: row.expires_at,
    }));
}

export function deleteLocksBySession(sessionId) {
  db.prepare('DELETE FROM seat_locks WHERE session_id = ?').run(sessionId);
}

// ------------------------------------------------------------- bookings

export function createBooking({
  bookingReference, userId, routeId, travelDate,
  contactEmail, contactPhone, subtotal, taxes, fees, total, status,
}) {
  const result = db.prepare(`
    INSERT INTO bookings (
      booking_reference, user_id, route_id, travel_date,
      contact_email, contact_phone, subtotal, taxes, fees, total, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bookingReference, userId, routeId, travelDate,
    contactEmail, contactPhone, subtotal, taxes, fees, total, status,
  );
  return getBookingById(result.lastInsertRowid);
}

const bookingSelect = `
  SELECT booking_id, booking_reference, user_id, route_id, travel_date,
         contact_email, contact_phone, subtotal, taxes, fees, total, status, created_at
  FROM bookings
`;

function mapBooking(row) {
  return {
    bookingId: row.booking_id,
    bookingReference: row.booking_reference,
    userId: row.user_id,
    routeId: row.route_id,
    travelDate: row.travel_date,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    subtotal: row.subtotal,
    taxes: row.taxes,
    fees: row.fees,
    total: row.total,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function getBookingById(bookingId) {
  const row = db.prepare(`${bookingSelect} WHERE booking_id = ?`).get(bookingId);
  return row ? mapBooking(row) : null;
}

export function getBookingByReference(bookingReference) {
  const row = db.prepare(`${bookingSelect} WHERE booking_reference = ?`).get(bookingReference);
  return row ? mapBooking(row) : null;
}

export function updateBookingStatus({ bookingId, status }) {
  db.prepare('UPDATE bookings SET status = ? WHERE booking_id = ?').run(status, bookingId);
}

// ----------------------------------------------------------- passengers

export function createPassenger({ bookingId, seatId, fullName, dateOfBirth }) {
  db.prepare('INSERT INTO passengers (booking_id, seat_id, full_name, date_of_birth) VALUES (?, ?, ?, ?)')
    .run(bookingId, seatId, fullName, dateOfBirth);
}

export function listPassengersForBooking(bookingId) {
  return db
    .prepare(`
      SELECT p.passenger_id, p.booking_id, p.seat_id, p.full_name, p.date_of_birth, s.seat_number
      FROM passengers p
      JOIN seats s ON s.seat_id = p.seat_id
      WHERE p.booking_id = ?
      ORDER BY s.seat_row, s.seat_column
    `)
    .all(bookingId)
    .map((row) => ({
      passengerId: row.passenger_id,
      bookingId: row.booking_id,
      seatId: row.seat_id,
      fullName: row.full_name,
      dateOfBirth: row.date_of_birth,
      seatNumber: row.seat_number,
    }));
}

// ------------------------------------------------------------- payments

export function createPayment({ bookingId, amount, status, gatewayReference }) {
  const result = db
    .prepare('INSERT INTO payments (booking_id, amount, status, gateway_reference) VALUES (?, ?, ?, ?)')
    .run(bookingId, amount, status, gatewayReference);
  return result.lastInsertRowid;
}
