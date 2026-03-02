import type { AgentProvider } from '../../shared/types';
import { providerIcons } from '../assets/icons';

const fallbackProviderIcon = providerIcons.claude;

export const getProviderIconUrl = (provider: AgentProvider): string =>
  providerIcons[provider] ?? fallbackProviderIcon;

export const getProviderIcon = getProviderIconUrl;
