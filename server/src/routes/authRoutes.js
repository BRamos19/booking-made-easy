import { Router } from 'express';
import * as authService from '../services/authService.js';

const router = Router();

router.post('/register', (req, res) => {
  const { email, password, fullName } = req.body || {};
  res.status(201).json(authService.register({ email, password, fullName }));
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  res.json(authService.login({ email, password }));
});

export default router;
