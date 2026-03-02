import { describe, expect, test, vi } from 'vitest';
import {
  buildCheckoutUrl,
  createLicenseClient,
  parseCheckoutSessionId,
  resolveBaseUrl,
  resolvePricingUrl,
} from '../../../src/main/services/licenseClient';

const createResponse = (status: number, body: Record<string, unknown>) => {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
};

describe('licenseClient', () => {
  test('registers device with app metadata', async () => {
    const fetcher = vi.fn(async () =>
      createResponse(200, {
        devicePublicId: 'device-public',
        trialEndsAt: '2026-02-01T00:00:00Z',
        subscriptionStatus: 'none',
        active: true,
      })
    );
    const client = createLicenseClient({
      baseUrl: 'https://license.test',
      fetcher,
      deviceIdProvider: async () => 'device-123',
      appVersion: '0.4.0',
      platform: 'darwin',
    });

    await client.registerDevice();

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://license.test/v1/devices/register');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      deviceId: 'device-123',
      appVersion: '0.4.0',
      platform: 'darwin',
    });
  });

  test('surfaces backend errors', async () => {
    const fetcher = vi.fn(async () => createResponse(400, { error: 'invalid_device_id' }));
    const client = createLicenseClient({
      baseUrl: 'https://license.test',
      fetcher,
      deviceIdProvider: async () => 'device-123',
    });

    await expect(client.registerDevice()).rejects.toThrow('invalid_device_id');
  });
});

describe('buildCheckoutUrl', () => {
  test('appends token query param', () => {
    expect(buildCheckoutUrl('https://vibe.test/checkout', 'tok')).toBe(
      'https://vibe.test/checkout?token=tok'
    );
    expect(buildCheckoutUrl('https://vibe.test/checkout?plan=annual', 'tok')).toBe(
      'https://vibe.test/checkout?plan=annual&token=tok'
    );
    expect(buildCheckoutUrl('https://vibe.test/checkout', 'tok', 'annual')).toBe(
      'https://vibe.test/checkout?plan=annual&token=tok'
    );
    expect(buildCheckoutUrl('https://vibe.test/checkout?plan=monthly', 'tok', 'annual')).toBe(
      'https://vibe.test/checkout?plan=annual&token=tok'
    );
  });
});

describe('parseCheckoutSessionId', () => {
  test('extracts session id from deep link', () => {
    expect(parseCheckoutSessionId('vibecraft://checkout/success?session_id=cs_test_123')).toBe('cs_test_123');
    expect(parseCheckoutSessionId('vibecraft://checkout/success?sessionId=cs_test_456')).toBe('cs_test_456');
  });

  test('returns null for unrelated urls', () => {
    expect(parseCheckoutSessionId('https://vibe.test')).toBeNull();
    expect(parseCheckoutSessionId('vibecraft://checkout/success')).toBeNull();
    expect(parseCheckoutSessionId('vibecraft://something/else?session_id=cs')).toBeNull();
  });
});

describe('resolvePricingUrl', () => {
  test('returns the first valid http(s) candidate from a comma-separated env var', () => {
    const original = process.env.VIBECRAFT_PRICING_URL;
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.VIBECRAFT_PRICING_URL = 'http://localhost:8788/checkout,https://';
    try {
      expect(resolvePricingUrl()).toBe('http://localhost:8788/checkout');
    } finally {
      if (original === undefined) delete process.env.VIBECRAFT_PRICING_URL;
      else process.env.VIBECRAFT_PRICING_URL = original;
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe('resolveBaseUrl', () => {
  test('returns the first valid http(s) candidate from a comma-separated env var', () => {
    const original = process.env.VIBECRAFT_LICENSE_API_URL;
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.VIBECRAFT_LICENSE_API_URL = 'https://license.test,not-a-url';
    try {
      expect(resolveBaseUrl()).toBe('https://license.test');
    } finally {
      if (original === undefined) delete process.env.VIBECRAFT_LICENSE_API_URL;
      else process.env.VIBECRAFT_LICENSE_API_URL = original;
      process.env.NODE_ENV = originalEnv;
    }
  });
});
