// Payment Gateway Integration (mocked).
// Interface is shaped like Stripe so a real gateway can be dropped in later.
// No card data ever leaves this process and none is persisted.
import crypto from 'node:crypto';

const SIMULATED_LATENCY_MS = 800;
const SUCCESS_CARD = '4242424242424242';
const DECLINE_CARD = '4000000000000002';

function delay(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

export async function createPaymentIntent({ amountCents, currency }) {
  const intentId = `pi_test_${crypto.randomBytes(8).toString('hex')}`;
  console.log(`[PAYMENT GATEWAY - TEST MODE] createPaymentIntent ${intentId} for ${amountCents} ${currency}`);
  await delay(SIMULATED_LATENCY_MS / 2);
  return { intentId, clientSecret: `${intentId}_secret_${crypto.randomBytes(6).toString('hex')}` };
}

export async function confirmPayment({ intentId, card }) {
  const cardNumber = String(card?.number || '').replace(/[\s-]/g, '');
  console.log(`[PAYMENT GATEWAY - TEST MODE] confirmPayment ${intentId} with card ending ${cardNumber.slice(-4)}`);
  await delay(SIMULATED_LATENCY_MS);

  if (!/^\d{16}$/.test(cardNumber)) {
    return { status: 'failed', gatewayReference: null, message: 'Invalid card number.' };
  }
  if (cardNumber === DECLINE_CARD) {
    console.log(`[PAYMENT GATEWAY - TEST MODE] ${intentId} DECLINED`);
    return { status: 'declined', gatewayReference: `ch_test_${crypto.randomBytes(8).toString('hex')}`, message: 'Your card was declined.' };
  }
  // 4242 4242 4242 4242 and any other 16-digit number succeed in test mode.
  if (cardNumber !== SUCCESS_CARD) {
    console.log(`[PAYMENT GATEWAY - TEST MODE] ${intentId} non-standard test card, approving`);
  }
  console.log(`[PAYMENT GATEWAY - TEST MODE] ${intentId} SUCCEEDED`);
  return { status: 'succeeded', gatewayReference: `ch_test_${crypto.randomBytes(8).toString('hex')}`, message: 'Payment approved.' };
}
