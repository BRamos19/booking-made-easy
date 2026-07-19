// API smoke test. Run with the server started and the database seeded:
//   node server/scripts/smoke-test.js
// Exercises the happy path plus the graded error cases. Exits 1 on failure.
const BASE = process.env.API_URL || 'http://localhost:3001';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

function futureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

const travelDate = futureDate(7);

console.log(`Smoke test against ${BASE}, travel date ${travelDate}\n`);

// --- auth
let r = await call('POST', '/api/auth/login', { email: 'demo@freedomtravels.com', password: 'Demo1234' });
check('demo login succeeds', r.status === 200 && r.data.sessionId, JSON.stringify(r.data));
const session = r.data;

r = await call('POST', '/api/auth/login', { email: 'demo@freedomtravels.com', password: 'wrong' });
check('bad password rejected with 401', r.status === 401);

r = await call('POST', '/api/auth/register', { email: 'nope', password: 'x', fullName: '' });
check('invalid registration rejected with 400', r.status === 400);

// --- search
r = await call('GET', `/api/trains/search?originId=1&destinationId=4&travelDate=${travelDate}`);
check('Miami->Orlando search returns results', r.status === 200 && r.data.length > 0);
check('results include seatsRemaining', typeof r.data[0]?.seatsRemaining === 'number');
const route = r.data.find((route) => route.baseFare === 49) || r.data[0];

r = await call('GET', `/api/trains/search?originId=1&destinationId=1&travelDate=${travelDate}`);
check('same origin/destination rejected with 400', r.status === 400);

r = await call('GET', '/api/trains/search?originId=1&destinationId=4&travelDate=2020-01-01');
check('past date rejected with 400', r.status === 400);

// --- seat map
r = await call('GET', `/api/routes/${route.routeId}/seats?travelDate=${travelDate}&sessionId=${session.sessionId}`);
check('seat map returns 40 seats', r.data.seats?.length === 40);
const occupiedCount = r.data.seats.filter((seat) => seat.status === 'occupied').length;
check('seat map shows pre-occupied seats', occupiedCount >= 1, `occupied=${occupiedCount}`);
const available = r.data.seats.filter((seat) => seat.status === 'available');

// --- locking rules
r = await call('POST', '/api/seats/lock', {
  routeId: route.routeId, travelDate, sessionId: session.sessionId,
  seatIds: available.slice(0, 7).map((seat) => seat.seatId),
});
check('7-seat lock rejected with 400', r.status === 400);
check('cap message is exact', r.data.error === 'A maximum of 6 seats may be booked per transaction.', r.data.error);

const chosen = available.slice(0, 3);
r = await call('POST', '/api/seats/lock', {
  routeId: route.routeId, travelDate, sessionId: session.sessionId,
  seatIds: chosen.map((seat) => seat.seatId),
});
check('3-seat lock succeeds with expiry', r.status === 200 && r.data.expiresAt, JSON.stringify(r.data));
const lockWindowMinutes = (new Date(r.data.expiresAt) - new Date(r.data.lockedAt)) / 60000;
check('lock window is exactly 10 minutes', lockWindowMinutes === 10, `${lockWindowMinutes}min`);

r = await call('POST', '/api/seats/lock', {
  routeId: route.routeId, travelDate, sessionId: 'rival-session',
  seatIds: [chosen[0].seatId],
});
check('rival session gets 409 for locked seat', r.status === 409);

// --- booking
const passengers = chosen.map((seat, index) => ({
  seatId: seat.seatId,
  fullName: `Smoke Passenger ${index + 1}`,
  dateOfBirth: '1990-05-15',
}));

r = await call('POST', '/api/bookings', {
  routeId: route.routeId, travelDate, sessionId: session.sessionId, userId: session.userId,
  contactEmail: 'not-an-email', contactPhone: '305-555-0100', passengers,
});
check('booking with bad contact email rejected with 400', r.status === 400);

r = await call('POST', '/api/bookings', {
  routeId: route.routeId, travelDate, sessionId: session.sessionId, userId: session.userId,
  contactEmail: 'smoke@example.com', contactPhone: '305-555-0100', passengers,
});
check('booking created as pending', r.status === 201 && r.data.status === 'pending', JSON.stringify(r.data));
const booking = r.data;

const expectedSubtotal = Math.round(route.baseFare * 100) * 3 / 100;
const expectedTaxes = Math.round(expectedSubtotal * 100 * 0.07) / 100;
const expectedFees = 7.5;
check('subtotal = base fare x 3', booking.subtotal === expectedSubtotal, `${booking.subtotal}`);
check('taxes = 7% of subtotal', booking.taxes === expectedTaxes, `${booking.taxes}`);
check('fees = $2.50 per seat', booking.fees === expectedFees, `${booking.fees}`);
check('total = subtotal + taxes + fees',
  booking.total === Math.round((expectedSubtotal + expectedTaxes + expectedFees) * 100) / 100,
  `${booking.total}`);

// --- payment
r = await call('POST', '/api/payments', {
  bookingId: booking.bookingId,
  card: { number: '4000000000000002', name: 'Smoke Tester', expiry: '12/28', cvv: '123' },
});
check('decline card is declined', r.data.status === 'declined', JSON.stringify(r.data));

r = await call('GET', `/api/bookings/${booking.bookingReference}`);
check('booking still pending after decline', r.data.status === 'pending');

r = await call('POST', '/api/payments', {
  bookingId: booking.bookingId,
  card: { number: '4242424242424242', name: 'Smoke Tester', expiry: '12/28', cvv: '123' },
});
check('success card succeeds', r.data.status === 'succeeded', JSON.stringify(r.data));
check('payment returns email preview', typeof r.data.emailPreview === 'string' && r.data.emailPreview.includes(booking.bookingReference));

r = await call('GET', `/api/bookings/${booking.bookingReference}`);
check('booking confirmed after payment', r.data.status === 'confirmed');
check('booking lookup includes passengers', r.data.passengers?.length === 3);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
