import { useSyncExternalStore } from 'react';
import type {
  LicenseAccessReason,
  LicenseStatus,
  LicenseStatusResponse,
  LicenseSubscriptionStatus,
  LicenseTokenPayload,
} from '../../shared/types';

type SubscriptionVia = 'checkout' | 'pairing';

type LicenseSnapshot = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  license: LicenseStatus | null;
  error?: string;
  updatedAt?: number;
};

type Listener = () => void;

const listeners = new Set<Listener>();

const LICENSE_CACHE_KEY = 'vibecraft_license_cache_v1';

type LicenseCache = {
  token: string;
  status: LicenseStatus;
  storedAt: number;
};

let snapshot: LicenseSnapshot = {
  status: 'idle',
  license: null,
};

const resolveLicenseCheckEnabled = (): boolean => {
  if (typeof window === 'undefined' || !window.electronAPI) return true;
  return window.electronAPI.isLicenseCheckEnabled;
};

const resolveLicenseDebugState = (): 'trial' | 'expired' | 'subscribed' | undefined => {
  if (typeof window === 'undefined' || !window.electronAPI) return undefined;
  return window.electronAPI.licenseDebugState;
};

const createDebugLicense = (debugState: 'trial' | 'expired' | 'subscribed'): LicenseStatus => {
  switch (debugState) {
    case 'trial':
      return {
        active: true,
        reason: 'trial',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        subscriptionStatus: 'none',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        deviceCount: null,
        deviceLimit: null,
        plan: 'unknown',
      };
    case 'expired':
      return {
        active: false,
        reason: 'inactive',
        trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        subscriptionStatus: 'none',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        deviceCount: null,
        deviceLimit: null,
        plan: 'unknown',
      };
    case 'subscribed':
      return {
        active: true,
        reason: 'subscription',
        trialEndsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        subscriptionStatus: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        deviceCount: 1,
        deviceLimit: 3,
        plan: 'annual',
      };
  }
};

const createBypassLicense = (): LicenseStatus => {
  const trialEndsAt = new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString();
  return {
    active: true,
    reason: 'subscription',
    trialEndsAt,
    subscriptionStatus: 'active',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    deviceCount: null,
    deviceLimit: null,
    plan: 'unknown',
  };
};

const applyBypassLicense = (): void => {
  const debugState = resolveLicenseDebugState();
  const license = debugState ? createDebugLicense(debugState) : createBypassLicense();
  setSnapshot({
    status: 'ready',
    license,
    error: undefined,
    updatedAt: Date.now(),
  });
};

const notify = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

const setSnapshot = (next: LicenseSnapshot): void => {
  snapshot = next;
  notify();
};

const isSubscriptionActive = (status: LicenseSubscriptionStatus) =>
  status === 'trialing' || status === 'active';

let pendingActivationVia: SubscriptionVia | null = null;

export const setPendingActivationVia = (via: SubscriptionVia): void => {
  pendingActivationVia = via;
};

const trackActivationIfNeeded = (prevLicense: LicenseStatus | null, nextLicense: LicenseStatus): void => {
  const wasActiveSubscription = prevLicense?.reason === 'subscription' && prevLicense.active;
  const isActiveSubscription = nextLicense.reason === 'subscription' && nextLicense.active;

  if (!wasActiveSubscription && isActiveSubscription) {
    const nextPlan = nextLicense.plan;
    const nextSubscriptionStatus = nextLicense.subscriptionStatus;
    if (pendingActivationVia) {
      const via = pendingActivationVia;
      pendingActivationVia = null;
      void import('../utils/paywallAnalytics').then(
        ({ trackPaywallCheckoutCompleted, trackSubscriptionActivated }) => {
          trackSubscriptionActivated({ plan: nextPlan, via });
          if (via === 'checkout' && (nextPlan === 'monthly' || nextPlan === 'annual')) {
            trackPaywallCheckoutCompleted({
              plan: nextPlan,
              subscriptionStatus: nextSubscriptionStatus,
            });
          }
        }
      );
    } else {
      void import('../utils/paywallAnalytics').then(({ trackSubscriptionObserved }) => {
        trackSubscriptionObserved({
          plan: nextPlan,
          subscriptionStatus: nextSubscriptionStatus,
        });
      });
    }
  }
};

const deriveReason = (
  active: boolean,
  subscriptionStatus: LicenseSubscriptionStatus
): LicenseAccessReason => {
  if (active) {
    return isSubscriptionActive(subscriptionStatus) ? 'subscription' : 'trial';
  }
  return 'inactive';
};

const normalizeStatus = (
  payload: Partial<LicenseStatusResponse> & {
    active: boolean;
    trialEndsAt: string;
    subscriptionStatus: LicenseSubscriptionStatus;
  }
): LicenseStatus => {
  return {
    active: payload.active,
    trialEndsAt: payload.trialEndsAt,
    subscriptionStatus: payload.subscriptionStatus,
    currentPeriodEnd: payload.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: payload.cancelAtPeriodEnd ?? false,
    deviceCount: payload.deviceCount ?? null,
    deviceLimit: payload.deviceLimit ?? null,
    reason: payload.reason ?? deriveReason(payload.active, payload.subscriptionStatus),
    plan: payload.plan ?? 'unknown',
  };
};

const hasLicenseFields = (payload: Partial<LicenseStatusResponse>): payload is LicenseStatusResponse => {
  return (
    typeof payload.active === 'boolean' &&
    typeof payload.trialEndsAt === 'string' &&
    typeof payload.subscriptionStatus === 'string'
  );
};

const isCacheStatusConsistent = (status: LicenseStatus, payload: LicenseTokenPayload): boolean => {
  if (status.active !== payload.active) return false;
  if (status.subscriptionStatus !== payload.subscriptionStatus) return false;
  if (status.trialEndsAt !== payload.trialEndsAt) return false;
  if (payload.reason && status.reason !== payload.reason) return false;
  return true;
};

const buildStatusFromToken = (payload: LicenseTokenPayload, cacheStatus?: LicenseStatus): LicenseStatus => {
  return normalizeStatus({
    active: payload.active,
    trialEndsAt: payload.trialEndsAt,
    subscriptionStatus: payload.subscriptionStatus,
    reason: payload.reason,
    currentPeriodEnd: payload.currentPeriodEnd ?? cacheStatus?.currentPeriodEnd,
    cancelAtPeriodEnd: payload.cancelAtPeriodEnd ?? cacheStatus?.cancelAtPeriodEnd,
    deviceCount: cacheStatus?.deviceCount,
    deviceLimit: cacheStatus?.deviceLimit,
    plan: cacheStatus?.plan,
  });
};

const readLicenseCache = (): LicenseCache | null => {
  try {
    const raw = localStorage.getItem(LICENSE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LicenseCache;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.token !== 'string' || typeof parsed.storedAt !== 'number') return null;
    if (!parsed.status || typeof parsed.status !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeLicenseCache = (token: string, status: LicenseStatus): void => {
  const cache: LicenseCache = {
    token,
    status,
    storedAt: Date.now(),
  };
  localStorage.setItem(LICENSE_CACHE_KEY, JSON.stringify(cache));
};

const clearLicenseCache = (): void => {
  localStorage.removeItem(LICENSE_CACHE_KEY);
};

const isBackendUnavailableError = (error?: string): boolean => {
  if (!error) return false;
  if (error === 'license_network_error' || error === 'license_api_not_configured') return true;
  return error.startsWith('http_5');
};

const attemptGraceAccess = async (error?: string): Promise<string | null> => {
  if (!isBackendUnavailableError(error)) return error ?? 'license_status_failed';

  const network = await window.electronAPI.checkNetworkStatus();
  if (!network.success || !network.online) {
    return 'license_offline';
  }

  const cache = readLicenseCache();
  if (!cache) return error ?? 'license_status_failed';

  const verification = await window.electronAPI.verifyLicenseToken(cache.token);
  if (!verification.success || !verification.valid) {
    clearLicenseCache();
    return 'license_token_invalid';
  }

  if (!verification.payload) {
    clearLicenseCache();
    return 'license_token_invalid';
  }

  const cacheMatches = isCacheStatusConsistent(cache.status, verification.payload);
  const licenseStatus = buildStatusFromToken(verification.payload, cacheMatches ? cache.status : undefined);

  if (!cacheMatches) {
    writeLicenseCache(cache.token, licenseStatus);
  }

  setSnapshot({
    status: 'ready',
    license: licenseStatus,
    error: undefined,
    updatedAt: cacheMatches ? cache.storedAt : Date.now(),
  });
  return null;
};

const fetchLicenseStatus = async (options?: {
  setLoading?: boolean;
  surfaceErrors?: boolean;
}): Promise<boolean> => {
  // In debug mode, don't poll - keep the debug state
  const debugState = resolveLicenseDebugState();
  if (debugState) {
    return true;
  }

  if (!resolveLicenseCheckEnabled()) {
    applyBypassLicense();
    return true;
  }
  const { setLoading = false, surfaceErrors = true } = options ?? {};
  if (setLoading) {
    setSnapshot({ ...snapshot, status: 'loading', error: undefined });
  }

  const statusResult = await window.electronAPI.licenseStatus();
  if (!statusResult.success || !hasLicenseFields(statusResult)) {
    const error = await attemptGraceAccess(statusResult.error);
    if (error && surfaceErrors) {
      setSnapshot({
        ...snapshot,
        status: 'error',
        error,
      });
    }
    return false;
  }

  const prevLicense = snapshot.license;
  const normalized = normalizeStatus(statusResult);
  if (statusResult.licenseToken) {
    writeLicenseCache(statusResult.licenseToken, normalized);
  }

  trackActivationIfNeeded(prevLicense, normalized);
  setSnapshot({
    status: 'ready',
    license: normalized,
    error: undefined,
    updatedAt: Date.now(),
  });
  return true;
};

export const getLicenseSnapshot = (): LicenseSnapshot => snapshot;

export const subscribeLicense = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const applyLicenseUpdate = (status: LicenseStatusResponse): void => {
  // In debug mode, ignore external updates to preserve debug state
  const debugState = resolveLicenseDebugState();
  if (debugState) {
    return;
  }

  const prevLicense = snapshot.license;
  const normalized = normalizeStatus(status);
  if (status.licenseToken) {
    writeLicenseCache(status.licenseToken, normalized);
  }
  trackActivationIfNeeded(prevLicense, normalized);
  setSnapshot({
    status: 'ready',
    license: normalized,
    error: undefined,
    updatedAt: Date.now(),
  });
};

export const setLicenseError = (error: string): void => {
  setSnapshot({
    ...snapshot,
    status: 'error',
    error,
  });
};

export const initializeLicense = async (): Promise<void> => {
  const debugState = resolveLicenseDebugState();

  if (!resolveLicenseCheckEnabled() && !debugState) {
    applyBypassLicense();
    return;
  }
  if (snapshot.status === 'loading' || snapshot.status === 'ready') return;
  setSnapshot({ ...snapshot, status: 'loading', error: undefined });

  // Always register device (needed for checkout to work), but in debug mode
  // we'll override the returned license status for UI testing
  const registerResult = await window.electronAPI.licenseRegisterDevice();
  if (!registerResult.success || !hasLicenseFields(registerResult)) {
    const error = await attemptGraceAccess(registerResult.error);
    if (error) {
      setSnapshot({
        status: 'error',
        license: snapshot.license,
        error,
      });
    }
    return;
  }

  const normalized = normalizeStatus(registerResult);
  if (registerResult.licenseToken) {
    writeLicenseCache(registerResult.licenseToken, normalized);
  }

  // In debug mode, override the license status for UI testing
  // (device is still registered so checkout will work)
  const finalLicense = debugState ? createDebugLicense(debugState) : normalized;

  setSnapshot({
    license: finalLicense,
    status: 'ready',
    error: undefined,
    updatedAt: Date.now(),
  });
};

export const refreshLicenseStatus = async (options?: {
  setLoading?: boolean;
  surfaceErrors?: boolean;
}): Promise<void> => {
  await fetchLicenseStatus({
    setLoading: options?.setLoading ?? true,
    surfaceErrors: options?.surfaceErrors ?? true,
  });
};

let pollingActive = false;

export const pollLicenseStatus = async (options?: {
  durationMs?: number;
  intervalMs?: number;
}): Promise<void> => {
  if (pollingActive) return;
  pollingActive = true;
  const durationMs = options?.durationMs ?? 2 * 60 * 1000;
  const intervalMs = options?.intervalMs ?? 4000;
  const deadline = Date.now() + durationMs;

  try {
    while (Date.now() < deadline) {
      await fetchLicenseStatus({ setLoading: false, surfaceErrors: false });
      if (snapshot.license?.active && snapshot.license.reason === 'subscription') {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  } finally {
    pollingActive = false;
  }
};

export const useLicenseState = (): LicenseSnapshot =>
  useSyncExternalStore(subscribeLicense, getLicenseSnapshot, getLicenseSnapshot);
