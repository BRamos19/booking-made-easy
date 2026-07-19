import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import CountdownTimer from '../components/CountdownTimer.jsx';

const MAX_SEATS = 6;
const SEAT_CAP_MESSAGE = 'A maximum of 6 seats may be booked per transaction.';

export default function SeatSelectionPage() {
  const {
    session, search, selectedRoute,
    selectedSeats, setSelectedSeats,
    lockExpiresAt, setLockExpiresAt,
  } = useApp();
  const navigate = useNavigate();
  const [seatMap, setSeatMap] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadSeatMap = useCallback(() => {
    if (!selectedRoute || !search) return;
    api.getSeatMap({
      routeId: selectedRoute.routeId,
      travelDate: search.travelDate,
      sessionId: session.sessionId,
    })
      .then(setSeatMap)
      .catch((err) => setError(err.message));
  }, [selectedRoute, search, session]);

  useEffect(() => {
    loadSeatMap();
  }, [loadSeatMap]);

  const handleExpire = useCallback(() => {
    setSelectedSeats([]);
    setLockExpiresAt(null);
    setMessage('Your seat hold expired. Please select seats again.');
    loadSeatMap();
  }, [setSelectedSeats, setLockExpiresAt, loadSeatMap]);

  if (!selectedRoute || !search) {
    return (
      <main className="page">
        <p className="muted">Pick a train first. <Link to="/search">Back to search</Link></p>
      </main>
    );
  }

  const selectedIds = new Set(selectedSeats.map((seat) => seat.seatId));

  async function syncLocks(nextSeats) {
    try {
      if (nextSeats.length === 0) {
        await api.releaseLocks({ sessionId: session.sessionId });
        setLockExpiresAt(null);
      } else {
        const result = await api.lockSeats({
          routeId: selectedRoute.routeId,
          travelDate: search.travelDate,
          seatIds: nextSeats.map((seat) => seat.seatId),
          sessionId: session.sessionId,
        });
        setLockExpiresAt(result.expiresAt);
      }
      setSelectedSeats(nextSeats);
    } catch (err) {
      if (err.status === 409) {
        setMessage('Someone else just took that seat. The map has been refreshed.');
        loadSeatMap();
      } else {
        setError(err.message);
      }
    }
  }

  function toggleSeat(seat) {
    setMessage('');
    setError('');
    if (seat.status === 'occupied') return;
    if (selectedIds.has(seat.seatId)) {
      syncLocks(selectedSeats.filter((s) => s.seatId !== seat.seatId));
      return;
    }
    if (selectedSeats.length >= MAX_SEATS) {
      setMessage(SEAT_CAP_MESSAGE);
      return;
    }
    syncLocks([...selectedSeats, seat]);
  }

  // Group seats into rows for the grid.
  const rows = [];
  if (seatMap) {
    const byRow = new Map();
    for (const seat of seatMap.seats) {
      if (!byRow.has(seat.seatRow)) byRow.set(seat.seatRow, []);
      byRow.get(seat.seatRow).push(seat);
    }
    for (const [rowNumber, seats] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
      rows.push({ rowNumber, seats });
    }
  }

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Choose your seats</h1>
        <p className="muted">
          {selectedRoute.trainNumber} {selectedRoute.trainName}
          {' · '}{selectedRoute.originCity} → {selectedRoute.destinationCity}
          {' · '}{search.travelDate}
        </p>
      </div>

      <div className="seat-layout">
        <div className="card seat-map-card">
          <div className="seat-legend">
            <span><i className="seat-chip available" /> Available</span>
            <span><i className="seat-chip occupied" /> Occupied</span>
            <span><i className="seat-chip selected" /> Selected</span>
          </div>
          {!seatMap && !error && <p className="muted">Loading seat map…</p>}
          {seatMap && (
            <div className="seat-grid">
              {rows.map((row) => (
                <div key={row.rowNumber} className="seat-row">
                  <span className="seat-row-label">{row.rowNumber}</span>
                  {row.seats.map((seat, index) => (
                    <span key={seat.seatId} className="seat-slot">
                      {index === 2 && <span className="seat-aisle" />}
                      <button
                        type="button"
                        className={`seat ${selectedIds.has(seat.seatId) ? 'selected' : seat.status}`}
                        disabled={seat.status === 'occupied'}
                        onClick={() => toggleSeat(seat)}
                        title={`Seat ${seat.seatNumber}`}
                      >
                        {seat.seatColumn}
                      </button>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="card seat-side">
          <h3>Your selection</h3>
          <p className="seat-counter">
            <strong>{selectedSeats.length}</strong> of {MAX_SEATS} seats selected
          </p>
          {selectedSeats.length > 0 && (
            <p className="muted">
              Seats: {selectedSeats.map((seat) => seat.seatNumber).join(', ')}
            </p>
          )}
          {lockExpiresAt && <CountdownTimer expiresAt={lockExpiresAt} onExpire={handleExpire} />}
          {message && <p className="form-error">{message}</p>}
          {error && <p className="form-error">{error}</p>}
          <button
            type="button"
            className="btn-primary"
            disabled={selectedSeats.length === 0}
            onClick={() => navigate('/review')}
          >
            Continue
          </button>
          <Link className="btn-link" to="/results">Back to results</Link>
        </aside>
      </div>
    </main>
  );
}
