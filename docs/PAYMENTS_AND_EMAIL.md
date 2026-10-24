# Payments & Email — integration status

## Cash on Delivery (working)

- Configurable via StoreSetting `cod`: `{ enabled, minOrder, maxOrder, districts }`.
- Orders start `PENDING / UNPAID`. Collection is confirmed only by staff with
  `orders:write` via `POST /api/v1/payments/orders/:id/cod-collect`, which
  sets `paymentStatus = PAID`, stamps `codCollectedAt`, writes a payment
  event, and audit-logs the action.
- Reconciliation: `GET /api/v1/payments/reconciliation/cod` (staff) lists
  collected vs pending amounts.
- Failed delivery / cancellation / return release the stock reservation and
  never mark payment received.

## SSLCOMMERZ / bKash / Nagad (disabled — honest status)

What exists: the adapter boundary (`server/src/lib/payments.js`), provider
status endpoint (`GET /api/v1/payments/providers`), configuration via
environment variables (see `.env.example`), and webhook routes that refuse
unverified or unconfigured callbacks without changing any payment state.

What does NOT exist: merchant credentials, initiate/redirect flows,
server-side validation queries, signature verification, refund flows, and
sandbox verification. **No provider endpoint, response, signature, or
sandbox behavior has been invented.** Checkout refuses unconfigured
providers with HTTP 503 before an order is created.

To enable a provider (required, in order):

1. Obtain real merchant credentials from the provider and set them in the
   server environment (never in the client or in git).
2. Implement `initiatePayment` for that provider using its **official
   documentation** (initiate → redirect/checkout handoff → server-side
   validation → verified callback → idempotent status update).
3. Implement `verifyCallback` for that provider (signature check and/or
   server-side status query). A callback that fails verification must change
   nothing.
4. Run the provider's documented sandbox verification tests and record the
   results before marking the provider enabled in production.

Until all four steps are done, the provider must remain disabled.

## Email (boundary only)

`server/src/lib/email.js` exposes `sendMail()`. With no
`EMAIL_PROVIDER_API_KEY`, emails are **logged only** and order creation never
blocks on email. With a key present but no provider implementation wired,
`sendMail` returns `{ sent: false, reason: 'email_provider_not_implemented' }`.

To enable: choose a provider (SMTP or a transactional API), implement its
send call in `email.js`, set `EMAIL_PROVIDER_API_KEY` and `EMAIL_FROM`, and
verify delivery to a test inbox. Account verification, password recovery,
and order notifications all flow through this boundary.

## SMS / OTP (optional, unconfigured)

No SMS provider is wired. Order-update SMS and OTP workflows are documented
as future work; no phone-based verification is claimed today.
