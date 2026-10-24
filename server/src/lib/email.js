import { env } from '../config/env.js';
import { logger } from './logger.js';

// Email provider boundary.
// - No provider API key configured -> emails are LOGGED ONLY (development behavior),
//   and sendMail returns { sent: false, reason: 'email_not_configured' }.
// - Order creation never blocks on email: callers fire-and-forget and log failures.
// - To enable real sending, configure EMAIL_PROVIDER_API_KEY and implement the
//   provider's send call here (SMTP or a transactional API) — see docs/PAYMENTS_AND_EMAIL.md.
export async function sendMail({ to, subject, html, text }) {
  if (!env.emailApiKey) {
    logger.info({ to, subject }, 'email skipped: provider not configured (logged only)');
    return { sent: false, reason: 'email_not_configured' };
  }
  // Provider integration point — intentionally not faked. When a provider is
  // chosen, implement its API call here and return { sent: true, id }.
  logger.warn({ to, subject }, 'email provider key present but no provider implementation wired');
  return { sent: false, reason: 'email_provider_not_implemented' };
}

export const orderConfirmationMail = (order) => ({
  to: order.guestEmail || '',
  subject: `Your NOVARA order ${order.orderNumber} is confirmed`,
  text: `Thank you for shopping with NOVARA Commerce. Your order ${order.orderNumber} totals ${order.grandTotal} poisha (BDT). Payment method: ${order.paymentMethod}.`,
});
