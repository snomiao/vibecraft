import type { TutorialState, TutorialStep, TutorialStatus } from './types';

export const TUTORIAL_WORLD_NAME = 'Tutorial';
export const TUTORIAL_WORLD_ID = 'tutorial-world';
export const TUTORIAL_PROMPT_1 = 'Create a cookie clicker website and run it on port 3000';
export const TUTORIAL_PROMPT_2 = 'Run this website on port 3001';
export const TUTORIAL_BROWSER_URL_1 = 'http://localhost:3000';
export const TUTORIAL_BROWSER_URL_2 = 'http://localhost:3001';

export const DEFAULT_TUTORIAL_STATE: TutorialState = {
  status: 'not_started',
  stepId: 'world-select',
  version: 1,
};

export const TUTORIAL_STATUSES: TutorialStatus[] = ['not_started', 'in_progress', 'completed'];

export const TUTORIAL_STEPS: TutorialStep[] = [
  'world-select',
  'hero-provider',
  'hero-intro',
  'create-project',
  'rename-project',
  'create-agent',
  'attach-agent',
  'open-global-chat',
  'send-prompt',
  'open-terminal',
  'close-terminal',
  'move-project',
  'create-project-2',
  'rename-project-2',
  'create-agent-2',
  'attach-agent-2',
  'open-global-chat-2',
  'send-prompt-2',
  'open-browser-1',
  'open-browser-2',
  'done',
];

export const isTutorialActive = (state?: TutorialState | null): boolean =>
  Boolean(state && state.status !== 'completed');

export const isTutorialStep = (state: TutorialState, step: TutorialStep): boolean =>
  state.status === 'in_progress' && state.stepId === step;
