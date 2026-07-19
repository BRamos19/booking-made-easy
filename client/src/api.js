// Thin fetch wrapper: JSON in/out, throws Error(message) on { error } responses.
async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  register: (body) => request('/api/auth/register', { method: 'POST', body }),
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  listStations: () => request('/api/stations'),
  searchTrains: ({ originId, destinationId, travelDate }) =>
    request(`/api/trains/search?originId=${originId}&destinationId=${destinationId}&travelDate=${travelDate}`),
  getSeatMap: ({ routeId, travelDate, sessionId }) =>
    request(`/api/routes/${routeId}/seats?travelDate=${travelDate}&sessionId=${encodeURIComponent(sessionId)}`),
  lockSeats: (body) => request('/api/seats/lock', { method: 'POST', body }),
  releaseLocks: (body) => request('/api/seats/lock', { method: 'DELETE', body }),
  createBooking: (body) => request('/api/bookings', { method: 'POST', body }),
  payBooking: (body) => request('/api/payments', { method: 'POST', body }),
  getBooking: (reference) => request(`/api/bookings/${encodeURIComponent(reference)}`),
};
