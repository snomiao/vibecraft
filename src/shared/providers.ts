import type { ProviderId as AgentConnectProviderId } from '@agentconnect/host';

export const SUPPORTED_AGENT_PROVIDERS = [
  'claude',
  'codex',
  'cursor',
] as const satisfies readonly AgentConnectProviderId[];

export const TUTORIAL_HERO_PROVIDERS = [
  'claude',
  'codex',
] as const satisfies readonly AgentConnectProviderId[];

export type SupportedAgentProvider = (typeof SUPPORTED_AGENT_PROVIDERS)[number];

export const isSupportedAgentProvider = (value: string): value is SupportedAgentProvider =>
  SUPPORTED_AGENT_PROVIDERS.includes(value as SupportedAgentProvider);
