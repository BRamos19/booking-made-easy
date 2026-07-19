# Booking Made Easy

A web-based train reservation prototype for **Freedom Travels Inc.**, built for
CEN4021 (Software Engineering II) at FIU. It demonstrates one complete user
journey end to end: **login → search → select train → select seats → passenger
details → payment → confirmation**.

Payments and emails are mocked — nothing real is charged or sent.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite, React Router, plain CSS |
| Backend | Node.js + Express (ES modules) |
| Database | SQLite via `better-sqlite3` (DAL abstracted so it could be swapped for PostgreSQL) |
| Auth | bcrypt password hashing |
| Payments | Mock gateway module shaped like Stripe (no external calls) |

## Architecture

Three layers; route handlers never touch the database — they call services,
and services call the data access layer.

```
┌─────────────────────────────────────────────────────────────┐
│  client/            React UI Components                     │
│  Login · Search · Results · Seats · Review · Pay · Confirm  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP /api (Vite proxy in dev)
┌──────────────────────────▼──────────────────────────────────┐
│  server/src/routes/     API / Service Layer (Express)       │
├─────────────────────────────────────────────────────────────┤
│  server/src/services/   Functional Components               │
│    authService · searchService · bookingService             │
│    paymentService · notificationService                     │
│    paymentGateway (mock) · emailClient (console only)       │
├─────────────────────────────────────────────────────────────┤
│  server/src/dal/        Database Access Layer               │
│    all SQL; maps snake_case rows <-> camelCase objects      │
├─────────────────────────────────────────────────────────────┤
│  server/db.sqlite       SQLite (schema + seed in src/db/)   │
└─────────────────────────────────────────────────────────────┘
```

Naming convention: database tables/columns are `snake_case`; JavaScript is
`camelCase`/`PascalCase`. The DAL is the only place that maps between the two.

## Setup

Requires Node 18+ (developed on Node 22).

```bash
git clone https://github.com/BRamos19/booking-made-easy.git
cd booking-made-easy
npm install
npm run seed     # creates and populates server/db.sqlite
npm run dev      # starts API on :3001 and client on :5173
```

Open http://localhost:5173.

## Demo credentials

- **User:** `demo@freedomtravels.com` / `Demo1234` (or register a new account)

## Test cards (mock gateway)

| Card number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| any other 16-digit number | Success |

Every gateway call logs `[PAYMENT GATEWAY - TEST MODE]` to the server console;
confirmation emails are logged with `[EMAIL - NOT SENT]` and shown as a
preview panel on the confirmation screen.

## The user journey implemented

1. **Login / Register** — bcrypt-hashed accounts, inline validation.
2. **Search** — origin/destination dropdowns + date picker; rejects same
   origin/destination and past dates.
3. **Results** — trains with times, duration, base fare, and live seats
   remaining; empty state when no route matches.
4. **Seat selection** — interactive 10×4 seat map (A–D). Seats lock
   server-side for **exactly 10 minutes** with a visible countdown; max **6
   seats** per transaction; racing sessions get a 409 and a refreshed map.
5. **Review** — full name + date of birth **per seat**, contact email/phone
   **once per booking**, itemized fare, warning banner under 2 minutes.
6. **Payment** — mock card form with processing state and decline retry. Fare
   is itemized as subtotal (base fare × seats), taxes (7%), fees ($2.50/seat),
   total. Raw card data is never stored — only gateway status + reference.
7. **Confirmation** — prominent booking reference, passenger/seat table,
   itemized receipt, and the confirmation email preview.

## Testing

- Manual test matrix: [docs/test-cases.md](docs/test-cases.md)
- API smoke test (server must be running and seeded):
  `node server/scripts/smoke-test.js` — 26 assertions over the happy path and
  the graded error cases.

## Deferred (and why)

Kept out of scope to favor a working, demonstrable journey on the deadline:

- **Real payment/email providers** — mocked behind Stripe-shaped and
  send-shaped interfaces so real ones can drop in without touching services.
- **JWT/session middleware** — login issues a session id used for seat
  locking; per-request auth enforcement is not needed to demo the journey.
- **Booking management** (view/cancel past bookings), seat class/pricing
  tiers, and multi-leg journeys — separate journeys, not the graded one.
- **PostgreSQL** — the DAL isolates all SQL to one module for a later swap.
- **Automated UI tests** — covered by the manual matrix plus the API smoke
  test given the timeline.
