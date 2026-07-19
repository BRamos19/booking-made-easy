// User Authentication & Account Management
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import * as dal from '../dal/index.js';
import { badRequest, unauthorized, conflict } from '../utils/httpError.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;

export function register({ email, password, fullName }) {
  if (!email || !EMAIL_PATTERN.test(email)) {
    throw badRequest('A valid email address is required.');
  }
  if (!password || password.length < 8) {
    throw badRequest('Password must be at least 8 characters.');
  }
  if (!fullName || !fullName.trim()) {
    throw badRequest('Full name is required.');
  }
  if (dal.getUserByEmail(email.toLowerCase())) {
    throw conflict('An account with this email already exists.');
  }
  const user = dal.createUser({
    email: email.toLowerCase(),
    passwordHash: bcrypt.hashSync(password, SALT_ROUNDS),
    fullName: fullName.trim(),
  });
  return toSession(user);
}

export function login({ email, password }) {
  if (!email || !password) {
    throw badRequest('Email and password are required.');
  }
  const user = dal.getUserByEmail(String(email).toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    throw unauthorized('Invalid email or password.');
  }
  return toSession(user);
}

// A sessionId identifies this browsing session for seat locking. The
// prototype keeps no server-side session table; the id keys seat_locks rows.
function toSession(user) {
  return {
    userId: user.userId,
    fullName: user.fullName,
    sessionId: crypto.randomUUID(),
  };
}
