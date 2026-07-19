import { Router } from 'express';
import * as bookingService from '../services/bookingService.js';

const router = Router();

// GET /api/routes/:routeId/seats?travelDate= is mounted from index.js;
// this router handles /api/seats/*.
router.post('/lock', (req, res) => {
  const { routeId, travelDate, seatIds, sessionId } = req.body || {};
  res.json(bookingService.lockSeats({ routeId, travelDate, seatIds, sessionId }));
});

router.delete('/lock', (req, res) => {
  const { sessionId } = req.body || {};
  bookingService.releaseLocks({ sessionId });
  res.json({ released: true });
});

export default router;
