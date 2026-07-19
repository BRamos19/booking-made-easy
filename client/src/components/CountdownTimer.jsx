import { useEffect, useRef } from 'react';
import { useCountdown } from './useCountdown.js';

// Visible seat-lock countdown shown on the seat selection, review, and
// payment screens. Turns amber under 2 minutes and fires onExpire once at 0.
export default function CountdownTimer({ expiresAt, onExpire }) {
  const secondsLeft = useCountdown(expiresAt);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
  }, [expiresAt]);

  useEffect(() => {
    if (secondsLeft === 0 && !expiredRef.current && expiresAt) {
      expiredRef.current = true;
      if (onExpire) onExpire();
    }
  }, [secondsLeft, expiresAt, onExpire]);

  if (secondsLeft === null) return null;

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  const warning = secondsLeft < 120;

  return (
    <div className={`countdown ${warning ? 'countdown-warning' : ''}`} title="Time remaining on your seat hold">
      <span className="countdown-label">Seats held for</span>
      <span className="countdown-time">{minutes}:{seconds}</span>
    </div>
  );
}
