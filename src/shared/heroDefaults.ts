import { type Hero, VIBECRAFT_CORE_MCP_SKILL_ID, VIBECRAFT_DOCS_MCP_SKILL_ID } from './types';

export const DEFAULT_HERO: Hero = {
  id: 'hero',
  name: 'Davion',
  provider: 'claude',
  model: '',
  x: 608,
  y: 275,
  mcpSkillIds: [VIBECRAFT_CORE_MCP_SKILL_ID, VIBECRAFT_DOCS_MCP_SKILL_ID],
};
