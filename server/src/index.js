import express from 'express';
import * as dal from './dal/index.js';
import * as bookingService from './services/bookingService.js';
import authRoutes from './routes/authRoutes.js';
import stationRoutes from './routes/stationRoutes.js';
import trainRoutes from './routes/trainRoutes.js';
import seatRoutes from './routes/seatRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

const PORT = process.env.PORT || 3001;

dal.applySchema();

const app = express();
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/trains', trainRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/api/routes/:routeId/seats', (req, res) => {
  res.json(bookingService.getSeatMap({
    routeId: req.params.routeId,
    travelDate: req.query.travelDate,
    sessionId: req.query.sessionId,
  }));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Central error handler: HttpError -> its status, anything else -> 500.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: err.status ? err.message : 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Booking Made Easy API listening on http://localhost:${PORT}`);
});
