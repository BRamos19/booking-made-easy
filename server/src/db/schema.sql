PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  user_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stations (
  station_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  city_name     TEXT NOT NULL,
  station_code  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS trains (
  train_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  train_number  TEXT NOT NULL UNIQUE,
  train_name    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS routes (
  route_id                INTEGER PRIMARY KEY AUTOINCREMENT,
  train_id                INTEGER NOT NULL REFERENCES trains(train_id),
  origin_station_id       INTEGER NOT NULL REFERENCES stations(station_id),
  destination_station_id  INTEGER NOT NULL REFERENCES stations(station_id),
  departure_time          TEXT NOT NULL,
  arrival_time            TEXT NOT NULL,
  duration_minutes        INTEGER NOT NULL,
  base_fare               REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS seats (
  seat_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id     INTEGER NOT NULL REFERENCES routes(route_id),
  seat_number  TEXT NOT NULL,
  seat_row     INTEGER NOT NULL,
  seat_column  TEXT NOT NULL,
  UNIQUE (route_id, seat_number)
);

CREATE TABLE IF NOT EXISTS seat_locks (
  lock_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  seat_id      INTEGER NOT NULL REFERENCES seats(seat_id),
  route_id     INTEGER NOT NULL REFERENCES routes(route_id),
  travel_date  TEXT NOT NULL,
  session_id   TEXT NOT NULL,
  locked_at    TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  UNIQUE (seat_id, travel_date)
);

CREATE TABLE IF NOT EXISTS bookings (
  booking_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_reference  TEXT NOT NULL UNIQUE,
  user_id            INTEGER NOT NULL REFERENCES users(user_id),
  route_id           INTEGER NOT NULL REFERENCES routes(route_id),
  travel_date        TEXT NOT NULL,
  contact_email      TEXT NOT NULL,
  contact_phone      TEXT NOT NULL,
  subtotal           REAL NOT NULL,
  taxes              REAL NOT NULL,
  fees               REAL NOT NULL,
  total              REAL NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS passengers (
  passenger_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id     INTEGER NOT NULL REFERENCES bookings(booking_id),
  seat_id        INTEGER NOT NULL REFERENCES seats(seat_id),
  full_name      TEXT NOT NULL,
  date_of_birth  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id         INTEGER NOT NULL REFERENCES bookings(booking_id),
  amount             REAL NOT NULL,
  status             TEXT NOT NULL,
  gateway_reference  TEXT,
  processed_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_routes_search
  ON routes (origin_station_id, destination_station_id);
CREATE INDEX IF NOT EXISTS idx_seat_locks_session ON seat_locks (session_id);
CREATE INDEX IF NOT EXISTS idx_passengers_booking ON passengers (booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_route_date ON bookings (route_id, travel_date);
