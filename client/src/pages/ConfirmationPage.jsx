import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import FareSummary from '../components/FareSummary.jsx';

export default function ConfirmationPage() {
  const { reference } = useParams();
  const { emailPreview } = useApp();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [showEmail, setShowEmail] = useState(false);

  useEffect(() => {
    api.getBooking(reference).then(setBooking).catch((err) => setError(err.message));
  }, [reference]);

  if (error) {
    return (
      <main className="page">
        <p className="form-error">{error}</p>
        <Link to="/search">Back to search</Link>
      </main>
    );
  }
  if (!booking) {
    return <main className="page"><p className="muted">Loading confirmation…</p></main>;
  }

  return (
    <main className="page page-narrow">
      <div className="card confirmation-card">
        <div className="confirmation-head">
          <span className="confirmation-check">✓</span>
          <h1>Booking confirmed</h1>
          <p className="muted">Keep your reference handy — you'll need it at the station.</p>
          <div className="booking-reference">{booking.bookingReference}</div>
          <span className={`status-pill status-${booking.status}`}>{booking.status}</span>
        </div>

        <h3>Journey</h3>
        <p className="muted">
          {booking.route.trainNumber} {booking.route.trainName}<br />
          {booking.route.originCity} ({booking.route.originCode}) → {booking.route.destinationCity} ({booking.route.destinationCode})<br />
          {booking.travelDate} · Departs {booking.route.departureTime} · Arrives {booking.route.arrivalTime}
        </p>

        <h3>Passengers</h3>
        <table className="passenger-table">
          <thead>
            <tr><th>Passenger</th><th>Date of birth</th><th>Seat</th></tr>
          </thead>
          <tbody>
            {booking.passengers.map((p) => (
              <tr key={p.passengerId}>
                <td>{p.fullName}</td>
                <td>{p.dateOfBirth}</td>
                <td><strong>{p.seatNumber}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>

        <FareSummary
          subtotal={booking.subtotal}
          taxes={booking.taxes}
          fees={booking.fees}
          total={booking.total}
          seatCount={booking.passengers.length}
        />

        {emailPreview && (
          <div className="email-preview">
            <button type="button" className="btn-link" onClick={() => setShowEmail(!showEmail)}>
              {showEmail ? '▾ Hide' : '▸ Show'} confirmation email preview
            </button>
            {showEmail && <pre className="email-body">{emailPreview}</pre>}
          </div>
        )}

        <Link className="btn-primary btn-inline" to="/search">Book another trip</Link>
      </div>
    </main>
  );
}
