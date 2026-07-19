// Train Search & Discovery
import * as dal from '../dal/index.js';
import { badRequest } from '../utils/httpError.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function listStations() {
  return dal.listStations();
}

export function searchTrains({ originId, destinationId, travelDate }) {
  const originStationId = Number(originId);
  const destinationStationId = Number(destinationId);
  if (!Number.isInteger(originStationId) || !Number.isInteger(destinationStationId)) {
    throw badRequest('originId and destinationId are required.');
  }
  if (originStationId === destinationStationId) {
    throw badRequest('Origin and destination must be different.');
  }
  validateTravelDate(travelDate);

  const nowIso = new Date().toISOString();
  dal.deleteExpiredLocks(nowIso);

  return dal.findRoutes({ originStationId, destinationStationId }).map((route) => {
    const totalSeats = dal.listSeatsForRoute(route.routeId).length;
    const bookedCount = dal.getBookedSeatIds({ routeId: route.routeId, travelDate }).length;
    const lockedCount = dal.getActiveLocks({ routeId: route.routeId, travelDate, nowIso }).length;
    return { ...route, seatsRemaining: totalSeats - bookedCount - lockedCount };
  });
}

export function validateTravelDate(travelDate) {
  if (!travelDate || !DATE_PATTERN.test(travelDate) || Number.isNaN(Date.parse(travelDate))) {
    throw badRequest('travelDate must be a valid date in YYYY-MM-DD format.');
  }
  const today = new Date().toISOString().slice(0, 10);
  if (travelDate < today) {
    throw badRequest('Travel date cannot be in the past.');
  }
}
