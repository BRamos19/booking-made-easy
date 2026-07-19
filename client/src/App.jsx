import { Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from './AppContext.jsx';
import Header from './components/Header.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import ResultsPage from './pages/ResultsPage.jsx';
import SeatSelectionPage from './pages/SeatSelectionPage.jsx';
import ReviewPage from './pages/ReviewPage.jsx';
import PaymentPage from './pages/PaymentPage.jsx';
import ConfirmationPage from './pages/ConfirmationPage.jsx';

function RequireAuth({ children }) {
  const { session } = useApp();
  if (!session) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { session } = useApp();
  return (
    <div className="app-shell">
      <Header />
      <Routes>
        <Route path="/" element={session ? <Navigate to="/search" replace /> : <LoginPage />} />
        <Route path="/search" element={<RequireAuth><SearchPage /></RequireAuth>} />
        <Route path="/results" element={<RequireAuth><ResultsPage /></RequireAuth>} />
        <Route path="/seats" element={<RequireAuth><SeatSelectionPage /></RequireAuth>} />
        <Route path="/review" element={<RequireAuth><ReviewPage /></RequireAuth>} />
        <Route path="/payment" element={<RequireAuth><PaymentPage /></RequireAuth>} />
        <Route path="/confirmation/:reference" element={<RequireAuth><ConfirmationPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="site-footer">
        Booking Made Easy — CEN4021 prototype for Freedom Travels Inc. · Test mode, no real payments.
      </footer>
    </div>
  );
}
