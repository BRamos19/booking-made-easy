import { createContext, useContext, useMemo, useState } from 'react';

// Shared state for the booking journey. The signed-in session persists to
// localStorage; trip state (search, route, seats, lock, booking) lives in
// memory and is rebuilt if the user starts a new search.
const AppContext = createContext(null);

const SESSION_KEY = 'bme.session';

export function AppProvider({ children }) {
  const [session, setSessionState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
    } catch {
      return null;
    }
  });
  const [search, setSearch] = useState(null); // { originId, destinationId, travelDate }
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]); // seat objects
  const [lockExpiresAt, setLockExpiresAt] = useState(null);
  const [booking, setBooking] = useState(null); // created booking details
  const [emailPreview, setEmailPreview] = useState(null);

  const value = useMemo(() => ({
    session,
    setSession: (next) => {
      setSessionState(next);
      if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      else localStorage.removeItem(SESSION_KEY);
    },
    search,
    setSearch,
    selectedRoute,
    setSelectedRoute,
    selectedSeats,
    setSelectedSeats,
    lockExpiresAt,
    setLockExpiresAt,
    booking,
    setBooking,
    emailPreview,
    setEmailPreview,
    resetTrip: () => {
      setSelectedRoute(null);
      setSelectedSeats([]);
      setLockExpiresAt(null);
      setBooking(null);
      setEmailPreview(null);
    },
  }), [session, search, selectedRoute, selectedSeats, lockExpiresAt, booking, emailPreview]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
