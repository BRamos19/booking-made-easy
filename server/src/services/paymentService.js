// Payment Processing.
// Receives card details, passes them to the gateway, and stores only the
// returned status and gateway reference — raw card data is never persisted.
import * as dal from '../dal/index.js';
import * as paymentGateway from './paymentGateway.js';
import * as bookingService from './bookingService.js';
import * as notificationService from './notificationService.js';
import { badRequest, notFound, conflict } from '../utils/httpError.js';

export async function processPayment({ bookingId, card }) {
  const booking = dal.getBookingById(Number(bookingId));
  if (!booking) throw notFound('Booking not found.');
  if (booking.status === 'confirmed') throw conflict('This booking is already paid.');

  if (!card || typeof card !== 'object') throw badRequest('Card details are required.');
  const cardNumber = String(card.number || '').replace(/[\s-]/g, '');
  if (!/^\d{16}$/.test(cardNumber)) throw badRequest('Card number must be 16 digits.');
  if (!card.name || !String(card.name).trim()) throw badRequest('Cardholder name is required.');
  if (!/^\d{2}\/\d{2}$/.test(String(card.expiry || ''))) throw badRequest('Expiry must be in MM/YY format.');
  if (!/^\d{3,4}$/.test(String(card.cvv || ''))) throw badRequest('CVV must be 3 or 4 digits.');

  const { intentId } = await paymentGateway.createPaymentIntent({
    amountCents: Math.round(booking.total * 100),
    currency: 'usd',
  });
  const result = await paymentGateway.confirmPayment({ intentId, card });

  dal.createPayment({
    bookingId: booking.bookingId,
    amount: booking.total,
    status: result.status,
    gatewayReference: result.gatewayReference,
  });

  if (result.status !== 'succeeded') {
    // Booking stays pending; the user can retry while the seat lock holds.
    return {
      status: result.status,
      message: result.message || 'Payment was not completed.',
      bookingReference: booking.bookingReference,
    };
  }

  // Success: confirm the booking and convert seat locks into permanent
  // assignments (the passenger rows already exist; deleting the locks makes
  // the confirmed booking the source of occupancy).
  dal.transaction(() => {
    const passengers = dal.listPassengersForBooking(booking.bookingId);
    const bookedByOthers = new Set(
      dal.getBookedSeatIds({ routeId: booking.routeId, travelDate: booking.travelDate }),
    );
    if (passengers.some((p) => bookedByOthers.has(p.seatId))) {
      throw conflict('One or more seats were sold while payment was processing.');
    }
    dal.updateBookingStatus({ bookingId: booking.bookingId, status: 'confirmed' });
    dal.deleteLocksForSeats({
      routeId: booking.routeId,
      travelDate: booking.travelDate,
      seatIds: passengers.map((p) => p.seatId),
    });
  });

  const details = bookingService.getBookingDetails(booking.bookingReference);
  const emailPreview = notificationService.notifyBookingConfirmed(details);

  return {
    status: 'succeeded',
    bookingReference: booking.bookingReference,
    emailPreview,
  };
}
