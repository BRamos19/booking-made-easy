import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function ResultsPage() {
  const { search, setSelectedRoute, setSelectedSeats } = useApp();
  const navigate = useNavigate();
  const [routes, setRoutes] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!search) return;
    api.searchTrains(search).then(setRoutes).catch((err) => setError(err.message));
  }, [search]);

  if (!search) {
    return (
      <main className="page">
        <p className="muted">Start with a search. <Link to="/search">Back to search</Link></p>
      </main>
    );
  }

  function selectRoute(route) {
    setSelectedRoute(route);
    setSelectedSeats([]);
    navigate('/seats');
  }

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Available trains</h1>
        <p className="muted">
          Travel date: <strong>{search.travelDate}</strong>
          {' · '}
          <Link to="/search">Change search</Link>
        </p>
      </div>
      {error && <p className="form-error">{error}</p>}
      {routes && routes.length === 0 && (
        <div className="card empty-state">
          <h2>No trains found</h2>
          <p className="muted">There are no trains between these stations. Try a different route.</p>
          <Link className="btn-primary btn-inline" to="/search">New search</Link>
        </div>
      )}
      {routes && routes.length > 0 && (
        <ul className="train-list">
          {routes.map((route) => (
            <li key={route.routeId} className="card train-card">
              <div className="train-main">
                <div className="train-title">
                  <strong>{route.trainNumber}</strong> {route.trainName}
                </div>
                <div className="train-times">
                  <span><strong>{route.departureTime}</strong> {route.originCode}</span>
                  <span className="train-arrow">→</span>
                  <span><strong>{route.arrivalTime}</strong> {route.destinationCode}</span>
                  <span className="muted">{formatDuration(route.durationMinutes)}</span>
                </div>
              </div>
              <div className="train-side">
                <div className="train-fare">${route.baseFare.toFixed(2)}</div>
                <div className={`muted ${route.seatsRemaining <= 6 ? 'seats-low' : ''}`}>
                  {route.seatsRemaining} seats left
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={route.seatsRemaining === 0}
                  onClick={() => selectRoute(route)}
                >
                  Select
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
