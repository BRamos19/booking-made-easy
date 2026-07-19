import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import CountdownTimer from '../components/CountdownTimer.jsx';
import FareSummary from '../components/FareSummary.jsx';

function formatCardNumber(value) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export default function PaymentPage() {
  const {
    booking, setEmailPreview,
    lockExpiresAt, setLockExpiresAt, setSelectedSeats,
  } = useApp();
  const navigate = useNavigate();
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleExpire = useCallback(() => {
    // Booking exists but is unpaid; the hold is gone, so seats must be
    // reselected if payment did not complete in time.
    setSelectedSeats([]);
    setLockExpiresAt(null);
    setError('Your seat hold expired before payment completed. Please reselect seats.');
  }, [setSelectedSeats, setLockExpiresAt]);

  if (!booking) {
    return (
      <main className="page">
        <p className="muted">No booking in progress. <Link to="/search">Start a search</Link></p>
      </main>
    );
  }

  function validate() {
    if (card.number.replace(/\D/g, '').length !== 16) return 'Card number must be 16 digits.';
    if (!card.name.trim()) return 'Enter the cardholder name.';
    if (!/^\d{2}\/\d{2}$/.test(card.expiry)) return 'Expiry must be MM/YY.';
    const month = Number(card.expiry.slice(0, 2));
    if (month < 1 || month > 12) return 'Expiry month must be between 01 and 12.';
    if (!/^\d{3,4}$/.test(card.cvv)) return 'CVV must be 3 or 4 digits.';
    return '';
  }

  async function handlePay() {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError('');
    setProcessing(true);
    try {
      const result = await api.payBooking({
        bookingId: booking.bookingId,
        card: { ...card, number: card.number.replace(/\s/g, '') },
      });
      if (result.status === 'succeeded') {
        setEmailPreview(result.emailPreview);
        navigate(`/confirmation/${result.bookingReference}`);
      } else {
        setError(`${result.message} You have not been charged — please try another card.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Payment</h1>
        <p className="muted">Booking {booking.bookingReference} · {booking.travelDate}</p>
      </div>

      <div className="review-layout">
        <div className="card payment-card">
          <h3>Card details</h3>
          <p className="muted test-cards">
            Test mode — use 4242 4242 4242 4242 (success) or 4000 0000 0000 0002 (declined).
          </p>
          <label>
            Card number
            <input
              type="text"
              inputMode="numeric"
              value={card.number}
              onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
              placeholder="1234 5678 9012 3456"
            />
          </label>
          <label>
            Cardholder name
            <input
              type="text"
              value={card.name}
              onChange={(e) => setCard({ ...card, name: e.target.value })}
              placeholder="Name on card"
            />
          </label>
          <div className="field-row">
            <label>
              Expiry (MM/YY)
              <input
                type="text"
                inputMode="numeric"
                value={card.expiry}
                onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                placeholder="12/28"
              />
            </label>
            <label>
              CVV
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={card.cvv}
                onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })}
                placeholder="123"
              />
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="button" className="btn-primary" onClick={handlePay} disabled={processing}>
            {processing ? 'Processing payment…' : `Pay $${booking.total.toFixed(2)} now`}
          </button>
        </div>

        <aside className="review-side">
          <div className="card">
            {lockExpiresAt && <CountdownTimer expiresAt={lockExpiresAt} onExpire={handleExpire} />}
            <h3>Order summary</h3>
            <p className="muted">
              {booking.route.trainNumber} {booking.route.trainName}<br />
              {booking.route.originCity} → {booking.route.destinationCity}<br />
              {booking.travelDate} · {booking.passengers.length} passenger{booking.passengers.length > 1 ? 's' : ''}
            </p>
            <FareSummary
              subtotal={booking.subtotal}
              taxes={booking.taxes}
              fees={booking.fees}
              total={booking.total}
              seatCount={booking.passengers.length}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
