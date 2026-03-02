import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ElectronAPI, LicenseStatus, LicenseTokenPayload } from '../../../src/shared/types';

const LICENSE_CACHE_KEY = 'vibecraft_license_cache_v1';

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

const buildStatus = (overrides: Partial<LicenseStatus> = {}): LicenseStatus => ({
  active: false,
  reason: 'inactive',
  trialEndsAt: '2026-01-01T00:00:00Z',
  subscriptionStatus: 'none',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  deviceCount: null,
  deviceLimit: null,
  plan: 'unknown',
  ...overrides,
});

const setCache = (status: LicenseStatus) => {
  localStorage.setItem(
    LICENSE_CACHE_KEY,
    JSON.stringify({
      token: 'cached-token',
      status,
      storedAt: Date.now() - 1000,
    })
  );
};

const baseElectronAPI = window.electronAPI;
const baseLocalStorage = window.localStorage;

beforeEach(() => {
  const storage = createMemoryStorage();
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  localStorage.removeItem(LICENSE_CACHE_KEY);
});

afterEach(() => {
  window.electronAPI = baseElectronAPI;
  Object.defineProperty(window, 'localStorage', { value: baseLocalStorage, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: baseLocalStorage, configurable: true });
  vi.restoreAllMocks();
});

describe('licenseStore offline cache', () => {
  test('derives status from signed token when cache is tampered', async () => {
    setCache(
      buildStatus({
        active: true,
        reason: 'subscription',
        trialEndsAt: '2026-03-01T00:00:00Z',
        subscriptionStatus: 'active',
        deviceCount: 2,
        deviceLimit: 3,
        plan: 'annual',
      })
    );

    const payload: LicenseTokenPayload = {
      iss: 'vibecraft-license',
      sub: 'device-public',
      iat: 0,
      exp: 999999,
      active: false,
      subscriptionStatus: 'none',
      trialEndsAt: '2026-01-01T00:00:00Z',
      reason: 'inactive',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };

    window.electronAPI = {
      ...(baseElectronAPI as ElectronAPI),
      licenseStatus: vi.fn(async () => ({ success: false, error: 'license_network_error' })),
      verifyLicenseToken: vi.fn(async () => ({
        success: true,
        valid: true,
        expired: false,
        payload,
      })),
      checkNetworkStatus: vi.fn(async () => ({ success: true, online: true })),
    };

    vi.resetModules();
    const { refreshLicenseStatus, getLicenseSnapshot } =
      await import('../../../src/renderer/state/licenseStore');

    await refreshLicenseStatus({ setLoading: false, surfaceErrors: false });

    const snapshot = getLicenseSnapshot();
    expect(snapshot.status).toBe('ready');
    expect(snapshot.license?.active).toBe(false);
    expect(snapshot.license?.reason).toBe('inactive');
    expect(snapshot.license?.trialEndsAt).toBe('2026-01-01T00:00:00Z');

    const cached = JSON.parse(localStorage.getItem(LICENSE_CACHE_KEY) ?? '{}');
    expect(cached.status?.active).toBe(false);
    expect(cached.status?.subscriptionStatus).toBe('none');
    expect(cached.status?.trialEndsAt).toBe('2026-01-01T00:00:00Z');
    expect(cached.status?.reason).toBe('inactive');

    expect(window.electronAPI.licenseStatus).toHaveBeenCalled();
    expect(window.electronAPI.verifyLicenseToken).toHaveBeenCalledWith('cached-token');
    expect(window.electronAPI.checkNetworkStatus).toHaveBeenCalled();
  });
});
