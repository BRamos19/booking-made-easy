// Email / Notification Service (logs, does not send).
// Composes the confirmation body, prints it prefixed [EMAIL - NOT SENT], and
// returns it so the frontend can show an email preview on the confirmation
// screen.
export function sendBookingConfirmation(booking) {
  const seatLines = booking.passengers
    .map((p) => `  - ${p.fullName} — Seat ${p.seatNumber}`)
    .join('\n');

  const body = [
    `To: ${booking.contactEmail}`,
    'From: reservations@freedomtravels.com',
    `Subject: Booking Confirmed — ${booking.bookingReference}`,
    '',
    `Dear traveler,`,
    '',
    `Your booking with Freedom Travels is confirmed!`,
    '',
    `Booking reference: ${booking.bookingReference}`,
    `Train: ${booking.route.trainNumber} ${booking.route.trainName}`,
    `Journey: ${booking.route.originCity} (${booking.route.originCode}) → ${booking.route.destinationCity} (${booking.route.destinationCode})`,
    `Travel date: ${booking.travelDate}`,
    `Departure: ${booking.route.departureTime}   Arrival: ${booking.route.arrivalTime}`,
    '',
    'Passengers:',
    seatLines,
    '',
    'Receipt (USD):',
    `  Subtotal: $${booking.subtotal.toFixed(2)}`,
    `  Taxes (7%): $${booking.taxes.toFixed(2)}`,
    `  Booking fees: $${booking.fees.toFixed(2)}`,
    `  Total: $${booking.total.toFixed(2)}`,
    '',
    'Thank you for choosing Freedom Travels!',
  ].join('\n');

  console.log('[EMAIL - NOT SENT]\n' + body.split('\n').map((line) => `  ${line}`).join('\n'));
  return body;
}
