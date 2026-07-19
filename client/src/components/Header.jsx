import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';

export default function Header() {
  const { session, setSession, resetTrip } = useApp();
  const navigate = useNavigate();

  function signOut() {
    setSession(null);
    resetTrip();
    navigate('/');
  }

  return (
    <header className="site-header">
      <div className="brand" onClick={() => navigate(session ? '/search' : '/')} role="button" tabIndex={0}>
        <span className="brand-mark">🚆</span>
        <span>
          <strong>Booking Made Easy</strong>
          <small>Freedom Travels Inc.</small>
        </span>
      </div>
      {session && (
        <div className="header-user">
          <span>Hi, {session.fullName.split(' ')[0]}</span>
          <button type="button" className="btn-link" onClick={signOut}>Sign out</button>
        </div>
      )}
    </header>
  );
}
