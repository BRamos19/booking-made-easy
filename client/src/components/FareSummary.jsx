// Itemized fare panel, always in the order subtotal / taxes / fees / total.
export default function FareSummary({ subtotal, taxes, fees, total, seatCount }) {
  return (
    <div className="fare-summary">
      <h3>Fare summary (USD)</h3>
      <dl>
        <div className="fare-line">
          <dt>Subtotal{seatCount ? ` (${seatCount} seat${seatCount > 1 ? 's' : ''})` : ''}</dt>
          <dd>${subtotal.toFixed(2)}</dd>
        </div>
        <div className="fare-line">
          <dt>Taxes (7%)</dt>
          <dd>${taxes.toFixed(2)}</dd>
        </div>
        <div className="fare-line">
          <dt>Booking fees ($2.50/seat)</dt>
          <dd>${fees.toFixed(2)}</dd>
        </div>
        <div className="fare-line fare-total">
          <dt>Total</dt>
          <dd>${total.toFixed(2)}</dd>
        </div>
      </dl>
    </div>
  );
}

// Client-side mirror of the server fare formula, used for display before a
// booking exists. The server's numbers are authoritative.
export function calculateFare(baseFare, seatCount) {
  const subtotalCents = Math.round(baseFare * 100) * seatCount;
  const taxesCents = Math.round(subtotalCents * 0.07);
  const feesCents = 250 * seatCount;
  return {
    subtotal: subtotalCents / 100,
    taxes: taxesCents / 100,
    fees: feesCents / 100,
    total: (subtotalCents + taxesCents + feesCents) / 100,
  };
}
