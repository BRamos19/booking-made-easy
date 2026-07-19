import { Router } from 'express';
import * as bookingService from '../services/bookingService.js';

const router = Router();

router.post('/', (req, res) => {
  const {
    routeId, travelDate, sessionId, passengers, contactEmail, contactPhone, userId,
  } = req.body || {};
  res.status(201).json(bookingService.createBooking({
    routeId, travelDate, sessionId, passengers, contactEmail, contactPhone, userId,
  }));
});

router.get('/:reference', (req, res) => {
  res.json(bookingService.getBookingDetails(req.params.reference));
});

export default router;
