import type { Agent, BrowserPanel, Folder, Hero, TerminalPanel } from './types';

export type WorkspaceLayout = {
  hero: Hero;
  agents: Agent[];
  folders: Folder[];
  browsers: BrowserPanel[];
  terminals: TerminalPanel[];
};

export type LayoutRequest = {
  requestId: string;
  workspacePath: string;
};

export type LayoutResponse = {
  requestId: string;
  ok: boolean;
  error?: string;
  layout?: WorkspaceLayout;
};
