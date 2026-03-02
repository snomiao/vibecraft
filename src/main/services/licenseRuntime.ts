import { createLicenseClient, resolveBaseUrl, resolvePricingUrl, type LicenseClient } from './licenseClient';
import { APP_VERSION } from './appVersion';

let cachedClient: LicenseClient | null = null;

export const getLicenseClient = (): LicenseClient => {
  if (!cachedClient) {
    cachedClient = createLicenseClient({
      baseUrl: resolveBaseUrl(),
      pricingUrl: resolvePricingUrl(),
      appVersion: APP_VERSION,
      platform: process.platform,
    });
  }
  return cachedClient;
};
