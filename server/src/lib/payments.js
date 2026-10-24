import { env } from '../config/env.js';
import { ApiError } from './errors.js';

// Payment-provider adapters.
// COD is genuinely functional. SSLCOMMERZ, bKash and Nagad are DISABLED
// integrations: their adapter boundary, configuration and validation exist,
// but initiate() refuses until real merchant credentials are configured, and
// webhook verification refuses unsigned/unconfigured callbacks. No provider
// endpoint, response, signature or sandbox behavior is invented here.
// An order is NEVER marked paid from a success URL — only from a verified
// server-side callback (or an authorized staff COD-collection confirmation).

export const PROVIDERS = {
  cod: { id: 'cod', name: 'Cash on Delivery', method: 'COD' },
  sslcommerz: { id: 'sslcommerz', name: 'SSLCOMMERZ', method: 'SSLCOMMERZ' },
  bkash: { id: 'bkash', name: 'bKash', method: 'BKASH' },
  nagad: { id: 'nagad', name: 'Nagad', method: 'NAGAD' },
};

export function providerConfigured(providerId) {
  if (providerId === 'cod') return true;
  if (providerId === 'sslcommerz') return Boolean(env.gateways.sslcommerz.storeId && env.gateways.sslcommerz.storePassword);
  if (providerId === 'bkash') return Boolean(env.gateways.bkash.appKey && env.gateways.bkash.appSecret && env.gateways.bkash.username && env.gateways.bkash.password);
  if (providerId === 'nagad') return Boolean(env.gateways.nagad.merchantId && env.gateways.nagad.privateKey);
  return false;
}

export function providerStatus() {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    name: p.name,
    method: p.method,
    configured: providerConfigured(p.id),
    enabled: p.id === 'cod' ? true : providerConfigured(p.id),
  }));
}

/**
 * Initiate a payment for an order. COD creates no redirect: the order is placed
 * unpaid and collection is confirmed later by authorized staff.
 * Gateway providers throw a 503 until credentials + implementation exist.
 */
export async function initiatePayment(providerId, order) {
  if (providerId === 'cod') {
    return { provider: 'cod', status: 'PENDING', redirectUrl: null };
  }
  if (!providerConfigured(providerId)) {
    throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED',
      `${PROVIDERS[providerId]?.name || providerId} is not configured. Configure merchant credentials (see docs/PAYMENTS_AND_EMAIL.md) before enabling it.`);
  }
  // Credentials present but the provider's official initiate flow is not yet
  // implemented for this provider. Refusing is safer than faking a redirect.
  throw new ApiError(503, 'PROVIDER_NOT_IMPLEMENTED',
    `${PROVIDERS[providerId].name} credentials are configured but the official initiate flow is not implemented yet.`);
}

/**
 * Verify a provider callback/webhook payload. Returns true ONLY when the
 * provider is configured AND the payload passes that provider's documented
 * verification (signature / server-side validation query). Any other outcome
 * is false — and the caller must not change payment state.
 * NOTE: signature verification bodies are provider-specific and are implemented
 * when credentials exist; until then this returns false by design.
 */
export async function verifyCallback(providerId, payload) {
  if (!providerConfigured(providerId)) return false;
  // TODO(provider): implement official verification (e.g. SSLCOMMERZ validation
  // API query, bKash tokenized status query, Nagad signature verification).
  return false;
}
