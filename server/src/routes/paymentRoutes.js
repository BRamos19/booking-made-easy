import { Router } from 'express';
import * as paymentService from '../services/paymentService.js';

const router = Router();

// Async handler: Express 4 does not forward rejected promises, so route
// errors are passed to next() explicitly.
router.post('/', async (req, res, next) => {
  try {
    const { bookingId, card } = req.body || {};
    res.json(await paymentService.processPayment({ bookingId, card }));
  } catch (err) {
    next(err);
  }
});

export default router;
