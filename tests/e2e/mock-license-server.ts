import { randomUUID } from 'crypto';

type Scenario = 'trial' | 'expired' | 'subscribed' | 'device_limit';

type ScenarioStatus = {
  active: boolean;
  reason: 'trial' | 'inactive' | 'subscription' | 'device_limit';
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'canceled' | 'none';
  plan: 'monthly' | 'annual' | 'unknown';
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  deviceCount: number | null;
  deviceLimit: number | null;
};

const allowedScenarios: Scenario[] = ['trial', 'expired', 'subscribed', 'device_limit'];

const parseArg = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
};

const parseScenario = (value?: string): Scenario => {
  if (value && allowedScenarios.includes(value as Scenario)) {
    return value as Scenario;
  }
  return 'trial';
};

const parsePort = (value?: string): number => {
  if (!value) return 8787;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 8787;
  return parsed;
};

const iso = (ms: number) => new Date(ms).toISOString();

const buildStatus = (scenario: Scenario): ScenarioStatus => {
  const now = Date.now();
  switch (scenario) {
    case 'trial':
      return {
        active: true,
        reason: 'trial',
        subscriptionStatus: 'none',
        plan: 'unknown',
        trialEndsAt: iso(now + 7 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        deviceCount: null,
        deviceLimit: null,
      };
    case 'expired':
      return {
        active: false,
        reason: 'inactive',
        subscriptionStatus: 'none',
        plan: 'unknown',
        trialEndsAt: iso(now - 24 * 60 * 60 * 1000),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        deviceCount: null,
        deviceLimit: null,
      };
    case 'device_limit':
      return {
        active: false,
        reason: 'device_limit',
        subscriptionStatus: 'active',
        plan: 'annual',
        trialEndsAt: iso(now - 24 * 60 * 60 * 1000),
        currentPeriodEnd: iso(now + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        deviceCount: 3,
        deviceLimit: 3,
      };
    case 'subscribed':
    default:
      return {
        active: true,
        reason: 'subscription',
        subscriptionStatus: 'active',
        plan: 'annual',
        trialEndsAt: iso(now - 30 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: iso(now + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        deviceCount: 1,
        deviceLimit: 3,
      };
  }
};

const initialScenario = parseScenario(parseArg('scenario'));
let currentScenario: Scenario = initialScenario;

const registeredDevices = new Map<string, string>();

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const errorResponse = (status: number, error: string) => json({ error }, status);

const parseBody = async (request: Request): Promise<Record<string, unknown> | null> => {
  try {
    const body = await request.json();
    if (body && typeof body === 'object') return body as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
};

const requireDeviceId = (body: Record<string, unknown> | null): string | null => {
  if (!body || typeof body.deviceId !== 'string' || !body.deviceId.trim()) return null;
  return body.deviceId.trim();
};

const ensureDevice = (deviceId: string): string => {
  let devicePublicId = registeredDevices.get(deviceId);
  if (!devicePublicId) {
    devicePublicId = `device_${randomUUID()}`;
    registeredDevices.set(deviceId, devicePublicId);
  }
  return devicePublicId;
};

const handleRegister = async (request: Request): Promise<Response> => {
  const body = await parseBody(request);
  const deviceId = requireDeviceId(body);
  if (!deviceId) return errorResponse(400, 'invalid_device_id');

  const devicePublicId = ensureDevice(deviceId);
  const status = buildStatus(currentScenario);

  return json({
    devicePublicId,
    trialEndsAt: status.trialEndsAt,
    subscriptionStatus: status.subscriptionStatus,
    active: status.active,
  });
};

const handleStatus = async (request: Request): Promise<Response> => {
  const body = await parseBody(request);
  const deviceId = requireDeviceId(body);
  if (!deviceId) return errorResponse(400, 'invalid_device_id');
  if (!registeredDevices.has(deviceId)) return errorResponse(404, 'device_not_registered');

  const status = buildStatus(currentScenario);

  return json({
    active: status.active,
    reason: status.reason,
    trialEndsAt: status.trialEndsAt,
    subscriptionStatus: status.subscriptionStatus,
    currentPeriodEnd: status.currentPeriodEnd,
    cancelAtPeriodEnd: status.cancelAtPeriodEnd,
    deviceCount: status.deviceCount,
    deviceLimit: status.deviceLimit,
    plan: status.plan,
  });
};

const handleCheckoutToken = async (request: Request): Promise<Response> => {
  const body = await parseBody(request);
  const deviceId = requireDeviceId(body);
  if (!deviceId) return errorResponse(400, 'invalid_checkout_token_request');
  ensureDevice(deviceId);

  return json({
    token: `token_${randomUUID()}`,
    expiresAt: iso(Date.now() + 30 * 60 * 1000),
  });
};

const handleCheckoutConfirm = async (request: Request): Promise<Response> => {
  const body = await parseBody(request);
  const deviceId = requireDeviceId(body);
  if (!deviceId) return errorResponse(400, 'invalid_checkout_confirm');
  const sessionId =
    typeof body?.sessionId === 'string' && body.sessionId.trim() ? body.sessionId.trim() : null;
  if (!sessionId) return errorResponse(400, 'invalid_checkout_confirm');
  ensureDevice(deviceId);

  currentScenario = 'subscribed';
  const status = buildStatus(currentScenario);

  return json({
    active: status.active,
    subscriptionStatus: status.subscriptionStatus,
    trialEndsAt: status.trialEndsAt,
    currentPeriodEnd: iso(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
};

const handlePairingStart = async (request: Request): Promise<Response> => {
  const body = await parseBody(request);
  const deviceId = requireDeviceId(body);
  if (!deviceId) return errorResponse(400, 'invalid_pairing_start');
  ensureDevice(deviceId);

  if (currentScenario !== 'subscribed') {
    return errorResponse(403, 'pairing_not_allowed');
  }

  return json({
    code: `PAIR-${Math.floor(1000 + Math.random() * 9000)}`,
    expiresAt: iso(Date.now() + 10 * 60 * 1000),
  });
};

const handlePairingClaim = async (request: Request): Promise<Response> => {
  const body = await parseBody(request);
  const deviceId = requireDeviceId(body);
  if (!deviceId) return errorResponse(400, 'invalid_pairing_claim');
  const code = typeof body?.code === 'string' && body.code.trim() ? body.code.trim() : null;
  if (!code) return errorResponse(400, 'invalid_pairing_claim');
  ensureDevice(deviceId);

  currentScenario = 'subscribed';
  const status = buildStatus(currentScenario);

  return json({
    active: status.active,
    subscriptionStatus: status.subscriptionStatus,
  });
};

const handleSetState = async (request: Request): Promise<Response> => {
  const body = await parseBody(request);
  const scenario = typeof body?.scenario === 'string' ? parseScenario(body.scenario) : null;
  if (!scenario) return errorResponse(400, 'invalid_scenario');
  currentScenario = scenario;
  return json({ scenario });
};

const handleReset = async (): Promise<Response> => {
  currentScenario = 'trial';
  registeredDevices.clear();
  return json({ ok: true });
};

const port = parsePort(parseArg('port'));

const bun = (
  globalThis as {
    Bun?: {
      serve: (options: {
        port: number;
        fetch: (request: Request) => Response | Promise<Response>;
      }) => unknown;
    };
  }
).Bun;

if (!bun) {
  throw new Error('Bun runtime is required to start the mock license server.');
}

bun.serve({
  port,
  fetch: async (request: Request) => {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname;

    if (method === 'GET' && path === '/health') {
      return json({ ok: true, scenario: currentScenario });
    }

    if (method === 'POST' && path === '/test/set-state') {
      return handleSetState(request);
    }

    if (method === 'POST' && path === '/test/reset') {
      return handleReset();
    }

    if (method === 'POST' && path === '/v1/devices/register') {
      return handleRegister(request);
    }

    if (method === 'POST' && path === '/v1/license/status') {
      return handleStatus(request);
    }

    if (method === 'POST' && path === '/v1/checkout/token') {
      return handleCheckoutToken(request);
    }

    if (method === 'POST' && path === '/v1/checkout/confirm') {
      return handleCheckoutConfirm(request);
    }

    if (method === 'POST' && path === '/v1/pairing/start') {
      return handlePairingStart(request);
    }

    if (method === 'POST' && path === '/v1/pairing/claim') {
      return handlePairingClaim(request);
    }

    return errorResponse(404, 'not_found');
  },
});
