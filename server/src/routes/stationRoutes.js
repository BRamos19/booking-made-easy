import { Router } from 'express';
import * as searchService from '../services/searchService.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(searchService.listStations());
});

export default router;
