import { Router } from 'express';
import * as searchService from '../services/searchService.js';

const router = Router();

router.get('/search', (req, res) => {
  const { originId, destinationId, travelDate } = req.query;
  res.json(searchService.searchTrains({ originId, destinationId, travelDate }));
});

export default router;
