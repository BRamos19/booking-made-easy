import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';

export default function SearchPage() {
  const { search, setSearch, resetTrip } = useApp();
  const navigate = useNavigate();
  const [stations, setStations] = useState([]);
  const [originId, setOriginId] = useState(search?.originId || '');
  const [destinationId, setDestinationId] = useState(search?.destinationId || '');
  const [travelDate, setTravelDate] = useState(search?.travelDate || '');
  const [error, setError] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api.listStations().then(setStations).catch((err) => setError(err.message));
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    if (!originId || !destinationId || !travelDate) {
      setError('Choose an origin, a destination, and a travel date.');
      return;
    }
    if (originId === destinationId) {
      setError('Origin and destination must be different.');
      return;
    }
    if (travelDate < today) {
      setError('Travel date cannot be in the past.');
      return;
    }
    setError('');
    resetTrip();
    setSearch({ originId, destinationId, travelDate });
    navigate('/results');
  }

  return (
    <main className="page page-narrow">
      <div className="card">
        <h1>Find your train</h1>
        <p className="muted">Search Freedom Travels routes across Florida.</p>
        <form onSubmit={handleSubmit} noValidate>
          <label>
            From
            <select value={originId} onChange={(e) => setOriginId(e.target.value)}>
              <option value="">Select origin station</option>
              {stations.map((s) => (
                <option key={s.stationId} value={String(s.stationId)}>
                  {s.cityName} ({s.stationCode})
                </option>
              ))}
            </select>
          </label>
          <label>
            To
            <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
              <option value="">Select destination station</option>
              {stations.map((s) => (
                <option key={s.stationId} value={String(s.stationId)}>
                  {s.cityName} ({s.stationCode})
                </option>
              ))}
            </select>
          </label>
          <label>
            Travel date
            <input
              type="date"
              value={travelDate}
              min={today}
              onChange={(e) => setTravelDate(e.target.value)}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-primary">Search trains</button>
        </form>
      </div>
    </main>
  );
}
