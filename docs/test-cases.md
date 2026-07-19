# Booking Made Easy — Test Cases

Manual test matrix for the prototype. API error paths are also covered by the
automated smoke test: `node server/scripts/smoke-test.js` (server must be
running and seeded).

Legend: **Pre** = precondition, **Steps** = actions, **Expected** = expected result.

## 1. Authentication

| # | Case | Steps | Expected |
|---|------|-------|----------|
| A1 | Valid login | Sign in as `demo@freedomtravels.com` / `Demo1234` | Redirect to Search; header greets user |
| A2 | Wrong password | Sign in with wrong password | Inline error "Invalid email or password.", stay on page |
| A3 | Malformed email | Enter `not-an-email` | Inline error before any request is sent |
| A4 | Short password (register) | Register with 5-char password | Inline error "Password must be at least 8 characters." |
| A5 | Duplicate registration | Register with the demo email | 409 error "An account with this email already exists." |

## 2. Search

| # | Case | Steps | Expected |
|---|------|-------|----------|
| S1 | Valid search | Miami → Orlando, future date | Results list with train number, name, times, duration, fare, seats remaining |
| S2 | Same origin/destination | Miami → Miami | Inline error "Origin and destination must be different." |
| S3 | Past date | Any route, yesterday | Inline error "Travel date cannot be in the past." (date picker also blocks past dates) |
| S4 | No matching route | Pensacola → Fort Lauderdale | Empty state with "No trains found" |

## 3. Seat selection & locking

| # | Case | Steps | Expected |
|---|------|-------|----------|
| L1 | Occupied seats visible | Open any seat map | ~8 seats shown grey/occupied (seeded) |
| L2 | Select seats | Click 3 available seats | Seats turn accent color; counter shows 3 of 6; countdown starts near 10:00 |
| L3 | Seat cap | Try to select a 7th seat | Blocked with "A maximum of 6 seats may be booked per transaction." |
| L4 | Deselect | Click a selected seat | Seat returns to available; counter decrements |
| L5 | Race for a seat | Second browser (other session) locks the same seat | Second session gets 409; map refreshes with message |
| L6 | Lock expiry | Wait 10 minutes after selecting | Selection cleared, message asks to reselect; seat freed for others |
| L7 | Continue disabled | 0 seats selected | Continue button disabled |

## 4. Review (passenger details)

| # | Case | Steps | Expected |
|---|------|-------|----------|
| R1 | Per-seat passenger fields | Select 3 seats, continue | Exactly 3 passenger blocks (name + DOB each), contact email/phone appear once |
| R2 | Missing passenger name | Leave a name blank, continue | Inline error naming the seat |
| R3 | Future DOB | Enter tomorrow as DOB | Inline error "Date of birth cannot be in the future." |
| R4 | Invalid contact phone | Enter `123` | Inline error for phone |
| R5 | Fare itemization | 3 seats at $49 | Subtotal $147.00, Taxes (7%) $10.29, Fees $7.50, Total $164.79 — in that order |
| R6 | Warning banner | Under 2 minutes on lock | Amber banner "Less than 2 minutes left…" |

## 5. Payment

| # | Case | Steps | Expected |
|---|------|-------|----------|
| P1 | Declined card | Pay with `4000 0000 0000 0002` | "Your card was declined." — user stays on page, booking stays `pending`, retry allowed |
| P2 | Successful card | Pay with `4242 4242 4242 4242` | Processing state ~1s, then redirect to Confirmation |
| P3 | Any other 16-digit card | Pay with `1111 2222 3333 4444` | Succeeds (test mode) |
| P4 | Invalid card number | 12 digits | Inline error before any request |
| P5 | Card data never stored | Inspect `payments` table after paying | Only amount, status, gateway_reference stored — no card fields anywhere in DB |
| P6 | Server logs | Watch server console during payment | `[PAYMENT GATEWAY - TEST MODE]` lines for intent + confirmation |

## 6. Confirmation & persistence

| # | Case | Steps | Expected |
|---|------|-------|----------|
| C1 | Confirmation screen | Complete a paid booking | Booking reference prominent, passenger/seat table, itemized receipt, collapsible email preview |
| C2 | Email log | Watch server console | Full confirmation body prefixed `[EMAIL - NOT SENT]` |
| C3 | DB status | `SELECT status FROM bookings WHERE booking_reference='…'` | `confirmed` |
| C4 | Seats become occupied | Re-open the same route/date seat map | Paid seats now shown occupied for other sessions |
| C5 | Booking lookup | `GET /api/bookings/:reference` | Booking JSON with passengers and route |

## 7. API validation (smoke test coverage)

`server/scripts/smoke-test.js` asserts: login, search, invalid search params
(400), seat map occupancy, 7-seat lock rejection (400 + exact cap message),
3-seat lock, cross-session race (409), booking with bad contact (400),
booking creation with exact fare itemization, declined payment keeps status
`pending`, successful payment flips to `confirmed` and returns the email
preview, and the reference lookup.
