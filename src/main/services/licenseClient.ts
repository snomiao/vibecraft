import { machineId } from 'node-machine-id';
import type {
  LicenseCheckoutPlan,
  LicenseStatusResponse,
  LicenseSubscriptionStatus,
  LicensePairingStart,
} from '../../shared/types';

type RegisterDeviceResponse = {
  devicePublicId: string;
  trialEndsAt: string;
  subscriptionStatus: LicenseSubscriptionStatus;
  active: boolean;
  licenseToken?: string;
};

type CheckoutConfirmResponse = {
  active: boolean;
  subscriptionStatus: LicenseSubscriptionStatus;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
};

type CheckoutTokenResponse = {
  token: string;
  expiresAt: string;
};

type PairingClaimResponse = {
  active: boolean;
  subscriptionStatus: LicenseSubscriptionStatus;
};

type BillingPortalResponse = {
  url: string;
};

export type LicenseClient = {
  registerDevice: () => Promise<RegisterDeviceResponse>;
  getStatus: () => Promise<LicenseStatusResponse>;
  confirmCheckout: (sessionId: string) => Promise<CheckoutConfirmResponse>;
  createCheckoutToken: () => Promise<CheckoutTokenResponse>;
  createBillingPortal: () => Promise<BillingPortalResponse>;
  startPairing: () => Promise<LicensePairingStart>;
  claimPairing: (code: string) => Promise<PairingClaimResponse>;
  getPricingUrl: () => string | null;
};

type LicenseClientOptions = {
  baseUrl: string;
  pricingUrl?: string | null;
  fetcher?: typeof fetch;
  deviceIdProvider?: () => Promise<string>;
  appVersion?: string;
  platform?: string;
};

export const resolveBaseUrl = (): string => {
  const explicit = resolveHttpUrlCandidate(process.env.VIBECRAFT_LICENSE_API_URL);
  if (explicit) return explicit;
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:8787';
  }
  return '';
};

export const resolvePricingUrl = (): string | null => {
  const explicit = resolveHttpUrlCandidate(process.env.VIBECRAFT_PRICING_URL);
  if (explicit) return explicit;
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:5173/checkout';
  }
  return null;
};

const resolveHttpUrlCandidate = (value: string | undefined): string | null => {
  if (!value) return null;
  const candidates = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return candidate;
      }
    } catch {
      // ignore invalid candidate
    }
  }
  return null;
};

const buildRequestUrl = (baseUrl: string, path: string): string => {
  if (!baseUrl) {
    throw new Error('license_api_not_configured');
  }
  return new URL(path, baseUrl).toString();
};

const buildPayloadError = (status: number): string => `http_${status}`;

const requestJson = async <T>(
  baseUrl: string,
  fetcher: typeof fetch,
  path: string,
  payload?: Record<string, unknown>
): Promise<T> => {
  const url = buildRequestUrl(baseUrl, path);
  let response: Response;
  try {
    response = await fetcher(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
  } catch {
    throw new Error('license_network_error');
  }
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const errorCode =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : buildPayloadError(response.status);
    throw new Error(errorCode);
  }
  return data as T;
};

export const buildCheckoutUrl = (pricingUrl: string, token: string, plan?: LicenseCheckoutPlan): string => {
  try {
    const url = new URL(pricingUrl);
    if (plan) {
      url.searchParams.set('plan', plan);
    }
    url.searchParams.set('token', token);
    return url.toString();
  } catch {
    throw new Error('invalid_pricing_url');
  }
};

export const parseCheckoutSessionId = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'vibecraft:') return null;
    if (url.hostname !== 'checkout' || url.pathname !== '/success') return null;
    const sessionId = url.searchParams.get('session_id') ?? url.searchParams.get('sessionId');
    if (!sessionId) return null;
    return sessionId;
  } catch {
    return null;
  }
};

export const createLicenseClient = (options: LicenseClientOptions): LicenseClient => {
  const {
    baseUrl,
    pricingUrl = null,
    fetcher = fetch,
    deviceIdProvider = async () => machineId(true),
    appVersion = 'unknown',
    platform = process.platform,
  } = options;
  let cachedDeviceId: string | null = null;

  const resolveDeviceId = async (): Promise<string> => {
    if (cachedDeviceId) return cachedDeviceId;
    const resolved = await deviceIdProvider();
    const trimmed = resolved.trim();
    if (!trimmed) {
      throw new Error('device_id_unavailable');
    }
    cachedDeviceId = trimmed;
    return trimmed;
  };

  return {
    async registerDevice() {
      const deviceId = await resolveDeviceId();
      return requestJson<RegisterDeviceResponse>(baseUrl, fetcher, '/v1/devices/register', {
        deviceId,
        appVersion,
        platform,
      });
    },
    async getStatus() {
      const deviceId = await resolveDeviceId();
      return requestJson<LicenseStatusResponse>(baseUrl, fetcher, '/v1/license/status', { deviceId });
    },
    async confirmCheckout(sessionId: string) {
      const deviceId = await resolveDeviceId();
      return requestJson<CheckoutConfirmResponse>(baseUrl, fetcher, '/v1/checkout/confirm', {
        deviceId,
        sessionId,
      });
    },
    async createCheckoutToken() {
      const deviceId = await resolveDeviceId();
      return requestJson<CheckoutTokenResponse>(baseUrl, fetcher, '/v1/checkout/token', { deviceId });
    },
    async createBillingPortal() {
      const deviceId = await resolveDeviceId();
      return requestJson<BillingPortalResponse>(baseUrl, fetcher, '/v1/billing/portal', { deviceId });
    },
    async startPairing() {
      const deviceId = await resolveDeviceId();
      return requestJson<LicensePairingStart>(baseUrl, fetcher, '/v1/pairing/start', { deviceId });
    },
    async claimPairing(code: string) {
      const deviceId = await resolveDeviceId();
      return requestJson<PairingClaimResponse>(baseUrl, fetcher, '/v1/pairing/claim', {
        deviceId,
        code,
      });
    },
    getPricingUrl() {
      return pricingUrl;
    },
  };
};
