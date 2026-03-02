const DEFAULT_NETWORK_CHECK_URL = 'https://www.google.com/generate_204';
const NETWORK_CHECK_TIMEOUT_MS = 3000;

const resolveNetworkCheckUrl = (): string => {
  const explicit = process.env.VIBECRAFT_NETWORK_CHECK_URL?.trim();
  return explicit || DEFAULT_NETWORK_CHECK_URL;
};

export const checkNetworkReachable = async (): Promise<boolean> => {
  const url = resolveNetworkCheckUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};
