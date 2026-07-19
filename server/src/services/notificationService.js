// Notification & Confirmation
import * as emailClient from './emailClient.js';

// Composes and "sends" the confirmation email for a confirmed booking.
// Returns the email body so the API can hand it to the frontend preview.
export function notifyBookingConfirmed(bookingDetails) {
  return emailClient.sendBookingConfirmation(bookingDetails);
}
