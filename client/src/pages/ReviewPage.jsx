import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import CountdownTimer from '../components/CountdownTimer.jsx';
import FareSummary, { calculateFare } from '../components/FareSummary.jsx';
import { useCountdown } from '../components/useCountdown.js';

export default function ReviewPage() {
  const {
    session, search, selectedRoute, selectedSeats,
    lockExpiresAt, setLockExpiresAt, setSelectedSeats, setBooking,
  } = useApp();
  const navigate = useNavigate();
  const [passengers, setPassengers] = useState(() =>
    (selectedSeats || []).map(() => ({ fullName: '', dateOfBirth: '' })),
  );
  const [contactEmail, setContactEmail] = useState(session?.email || '');
  const [contactPhone, setContactPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const secondsLeft = useCountdown(lockExpiresAt);

  const handleExpire = useCallback(() => {
    setSelectedSeats([]);
    setLockExpiresAt(null);
    navigate('/seats');
  }, [setSelectedSeats, setLockExpiresAt, navigate]);

  if (!selectedRoute || !search || selectedSeats.length === 0) {
    return (
      <main className="page">
        <p className="muted">Select seats first. <Link to="/seats">Back to seat selection</Link></p>
      </main>
    );
  }

  const fare = calculateFare(selectedRoute.baseFare, selectedSeats.length);
  const today = new Date().toISOString().slice(0, 10);

  function updatePassenger(index, field, value) {
    setPassengers((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function validate() {
    for (let i = 0; i < selectedSeats.length; i += 1) {
      if (!passengers[i]?.fullName.trim()) return `Enter a full name for seat ${selectedSeats[i].seatNumber}.`;
      if (!passengers[i]?.dateOfBirth) return `Enter a date of birth for seat ${selectedSeats[i].seatNumber}.`;
      if (passengers[i].dateOfBirth > today) return 'Date of birth cannot be in the future.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return 'Enter a valid contact email.';
    if (contactPhone.replace(/\D/g, '').length < 7) return 'Enter a valid contact phone number.';
    return '';
  }

  async function handleContinue() {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const booking = await api.createBooking({
        routeId: selectedRoute.routeId,
        travelDate: search.travelDate,
        sessionId: session.sessionId,
        userId: session.userId,
        contactEmail,
        contactPhone,
        passengers: selectedSeats.map((seat, index) => ({
          seatId: seat.seatId,
          fullName: passengers[index].fullName,
          dateOfBirth: passengers[index].dateOfBirth,
        })),
      });
      setBooking(booking);
      navigate('/payment');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Review your booking</h1>
        <p className="muted">
          {selectedRoute.trainNumber} {selectedRoute.trainName}
          {' · '}{selectedRoute.originCity} → {selectedRoute.destinationCity}
          {' · '}{search.travelDate}
        </p>
      </div>

      {secondsLeft !== null && secondsLeft < 120 && secondsLeft > 0 && (
        <div className="banner-warning">
          Less than 2 minutes left on your seat hold — complete your booking soon.
        </div>
      )}

      <div className="review-layout">
        <div className="review-forms">
          {selectedSeats.map((seat, index) => (
            <div className="card passenger-card" key={seat.seatId}>
              <h3>Passenger {index + 1} — Seat {seat.seatNumber}</h3>
              <div className="field-row">
                <label>
                  Full name
                  <input
                    type="text"
                    value={passengers[index]?.fullName || ''}
                    onChange={(e) => updatePassenger(index, 'fullName', e.target.value)}
                    placeholder="As shown on ID"
                  />
                </label>
                <label>
                  Date of birth
                  <input
                    type="date"
                    max={today}
                    value={passengers[index]?.dateOfBirth || ''}
                    onChange={(e) => updatePassenger(index, 'dateOfBirth', e.target.value)}
                  />
                </label>
              </div>
            </div>
          ))}

          <div className="card">
            <h3>Contact details (one per booking)</h3>
            <div className="field-row">
              <label>
                Contact email
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Contact phone
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="305-555-0100"
                />
              </label>
            </div>
          </div>
        </div>

        <aside className="review-side">
          <div className="card">
            {lockExpiresAt && <CountdownTimer expiresAt={lockExpiresAt} onExpire={handleExpire} />}
            <FareSummary {...fare} seatCount={selectedSeats.length} />
            {error && <p className="form-error">{error}</p>}
            <button type="button" className="btn-primary" onClick={handleContinue} disabled={busy}>
              {busy ? 'Saving…' : 'Continue to payment'}
            </button>
            <Link className="btn-link" to="/seats">Back to seats</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
