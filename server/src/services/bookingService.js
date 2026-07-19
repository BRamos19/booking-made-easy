// Seat Selection & Booking
import crypto from 'node:crypto';
import * as dal from '../dal/index.js';
import { validateTravelDate } from './searchService.js';
import { badRequest, notFound, conflict } from '../utils/httpError.js';

export const MAX_SEATS_PER_TRANSACTION = 6;
export const SEAT_CAP_MESSAGE = 'A maximum of 6 seats may be booked per transaction.';
const LOCK_MINUTES = 10;

const TAX_RATE = 0.07;
const BOOKING_FEE_CENTS_PER_SEAT = 250;

// Computed in whole cents so subtotal + taxes + fees always equals total.
export function calculateFare({ baseFare, seatCount }) {
  const subtotalCents = Math.round(baseFare * 100) * seatCount;
  const taxesCents = Math.round(subtotalCents * TAX_RATE);
  const feesCents = BOOKING_FEE_CENTS_PER_SEAT * seatCount;
  return {
    subtotal: subtotalCents / 100,
    taxes: taxesCents / 100,
    fees: feesCents / 100,
    total: (subtotalCents + taxesCents + feesCents) / 100,
  };
}

export function getSeatMap({ routeId, travelDate, sessionId }) {
  const route = dal.getRouteById(Number(routeId));
  if (!route) throw notFound('Route not found.');
  validateTravelDate(travelDate);

  const nowIso = new Date().toISOString();
  dal.deleteExpiredLocks(nowIso);

  const bookedSeatIds = new Set(dal.getBookedSeatIds({ routeId: route.routeId, travelDate }));
  const locks = dal.getActiveLocks({ routeId: route.routeId, travelDate, nowIso });
  const lockBySeatId = new Map(locks.map((lock) => [lock.seatId, lock]));

  const seats = dal.listSeatsForRoute(route.routeId).map((seat) => {
    let status = 'available';
    if (bookedSeatIds.has(seat.seatId)) {
      status = 'occupied';
    } else {
      const lock = lockBySeatId.get(seat.seatId);
      if (lock) status = lock.sessionId === sessionId ? 'selected' : 'occupied';
    }
    return { ...seat, status };
  });

  return { route, travelDate, seats };
}

export function lockSeats({ routeId, travelDate, seatIds, sessionId }) {
  const route = dal.getRouteById(Number(routeId));
  if (!route) throw notFound('Route not found.');
  validateTravelDate(travelDate);
  if (!sessionId || typeof sessionId !== 'string') {
    throw badRequest('sessionId is required.');
  }
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    throw badRequest('At least 1 seat must be selected.');
  }
  if (seatIds.length > MAX_SEATS_PER_TRANSACTION) {
    throw badRequest(SEAT_CAP_MESSAGE);
  }
  const uniqueSeatIds = [...new Set(seatIds.map(Number))];
  if (uniqueSeatIds.length !== seatIds.length || uniqueSeatIds.some((id) => !Number.isInteger(id))) {
    throw badRequest('seatIds must be a list of unique seat ids.');
  }
  const routeSeatIds = new Set(dal.listSeatsForRoute(route.routeId).map((seat) => seat.seatId));
  if (uniqueSeatIds.some((id) => !routeSeatIds.has(id))) {
    throw badRequest('One or more seats do not belong to this route.');
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000).toISOString();

  // Atomic check-and-lock: better-sqlite3 transactions are synchronous, so
  // two racing sessions serialize here and the loser gets a 409.
  dal.transaction(() => {
    dal.deleteExpiredLocks(nowIso);

    const bookedSeatIds = new Set(dal.getBookedSeatIds({ routeId: route.routeId, travelDate }));
    const activeLocks = dal.getActiveLocks({ routeId: route.routeId, travelDate, nowIso });
    const foreignLocked = new Set(
      activeLocks.filter((lock) => lock.sessionId !== sessionId).map((lock) => lock.seatId),
    );
    const taken = uniqueSeatIds.filter((id) => bookedSeatIds.has(id) || foreignLocked.has(id));
    if (taken.length > 0) {
      throw conflict('One or more selected seats are no longer available.');
    }

    // Re-locking replaces this session's previous selection and restarts
    // the 10-minute window.
    dal.deleteLocksBySession(sessionId);
    for (const seatId of uniqueSeatIds) {
      dal.createLock({
        seatId,
        routeId: route.routeId,
        travelDate,
        sessionId,
        lockedAt: nowIso,
        expiresAt,
      });
    }
  });

  return { seatIds: uniqueSeatIds, lockedAt: nowIso, expiresAt };
}

export function releaseLocks({ sessionId }) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw badRequest('sessionId is required.');
  }
  dal.deleteLocksBySession(sessionId);
}

export function createBooking({
  routeId, travelDate, sessionId, passengers, contactEmail, contactPhone, userId,
}) {
  const route = dal.getRouteById(Number(routeId));
  if (!route) throw notFound('Route not found.');
  validateTravelDate(travelDate);
  if (!Number.isInteger(Number(userId))) throw badRequest('userId is required.');
  if (!dal.getUserById(Number(userId))) throw badRequest('Unknown user.');
  if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw badRequest('A valid contact email is required.');
  }
  if (!contactPhone || String(contactPhone).replace(/\D/g, '').length < 7) {
    throw badRequest('A valid contact phone number is required.');
  }
  if (!Array.isArray(passengers) || passengers.length === 0) {
    throw badRequest('At least 1 passenger is required.');
  }
  if (passengers.length > MAX_SEATS_PER_TRANSACTION) {
    throw badRequest(SEAT_CAP_MESSAGE);
  }
  for (const passenger of passengers) {
    if (!passenger || !passenger.fullName || !passenger.fullName.trim()) {
      throw badRequest('Each passenger requires a full name.');
    }
    if (!passenger.dateOfBirth || Number.isNaN(Date.parse(passenger.dateOfBirth))) {
      throw badRequest('Each passenger requires a valid date of birth.');
    }
    if (!Number.isInteger(Number(passenger.seatId))) {
      throw badRequest('Each passenger requires a seatId.');
    }
  }

  const nowIso = new Date().toISOString();
  const heldSeatIds = new Set(
    dal.getLocksBySession({ sessionId, nowIso })
      .filter((lock) => lock.routeId === route.routeId && lock.travelDate === travelDate)
      .map((lock) => lock.seatId),
  );
  const passengerSeatIds = passengers.map((p) => Number(p.seatId));
  if (new Set(passengerSeatIds).size !== passengerSeatIds.length) {
    throw badRequest('Each passenger must have a distinct seat.');
  }
  if (passengerSeatIds.some((seatId) => !heldSeatIds.has(seatId))) {
    throw conflict('Your seat lock has expired or does not cover these seats. Please reselect seats.');
  }

  const fare = calculateFare({ baseFare: route.baseFare, seatCount: passengers.length });

  const booking = dal.transaction(() => {
    const created = dal.createBooking({
      bookingReference: generateBookingReference(),
      userId: Number(userId),
      routeId: route.routeId,
      travelDate,
      contactEmail,
      contactPhone: String(contactPhone),
      ...fare,
      status: 'pending',
    });
    for (const passenger of passengers) {
      dal.createPassenger({
        bookingId: created.bookingId,
        seatId: Number(passenger.seatId),
        fullName: passenger.fullName.trim(),
        dateOfBirth: passenger.dateOfBirth,
      });
    }
    return created;
  });

  return getBookingDetails(booking.bookingReference);
}

export function getBookingDetails(bookingReference) {
  const booking = dal.getBookingByReference(bookingReference);
  if (!booking) throw notFound('Booking not found.');
  return {
    ...booking,
    route: dal.getRouteById(booking.routeId),
    passengers: dal.listPassengersForBooking(booking.bookingId),
  };
}

function generateBookingReference() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let reference;
  do {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += alphabet[crypto.randomInt(alphabet.length)];
    }
    reference = `FT-${code}`;
  } while (dal.getBookingByReference(reference));
  return reference;
}
