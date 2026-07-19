import { useEffect, useState } from 'react';

// Seconds remaining until expiresAt (ISO string), ticking every second.
// Returns null when there is no deadline.
export function useCountdown(expiresAt) {
  const [secondsLeft, setSecondsLeft] = useState(() => remaining(expiresAt));

  useEffect(() => {
    setSecondsLeft(remaining(expiresAt));
    if (!expiresAt) return undefined;
    const interval = setInterval(() => {
      setSecondsLeft(remaining(expiresAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return secondsLeft;
}

function remaining(expiresAt) {
  if (!expiresAt) return null;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}
