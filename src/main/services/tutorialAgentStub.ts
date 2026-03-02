import { app } from 'electron';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AgentProvider } from '../../shared/types';
import type { AgentConnectEvent } from './agentConnect/service';
import { logger } from '../logger';

const log = logger.scope('tutorial:stub');

export type TutorialScenario = 'cookie-clicker' | 'doodle-jump';

const DEFAULT_TUTORIAL_OUTPUTS: Record<TutorialScenario, string> = {
  'cookie-clicker':
    '✅ Cookie Clicker scaffold ready.\n\n' +
    'Running the dev server on port 3000.\n' +
    'Open http://localhost:3000 in the Browser panel to preview it.',
  'doodle-jump':
    '✅ Doodle Jump scaffold ready.\n\n' +
    'Running the dev server on port 3001.\n' +
    'Open http://localhost:3001 in the Browser panel to preview it.',
};

const DEFAULT_TUTORIAL_PORTS: Record<TutorialScenario, number> = {
  'cookie-clicker': 3000,
  'doodle-jump': 3001,
};

const FIXTURE_WORKSPACE_TOKEN = '__VIBECRAFT_TUTORIAL_WORKSPACE__';
const FIXTURE_USER_HOME_TOKEN = '__VIBECRAFT_USER_HOME__';
const FIXTURE_CLAUDE_TASKS_TOKEN = '__VIBECRAFT_CLAUDE_TASKS__';

const FIXTURE_FILES: Record<TutorialScenario, Record<string, string>> = {
  'cookie-clicker': {
    claude: 'claude-headless-output-cookie-clicker.jsonl',
    codex: 'codex-headless-output-cookie-clicker.jsonl',
  },
  'doodle-jump': {
    claude: 'claude-headless-output-doodle-jump.jsonl',
    codex: 'codex-headless-output-doodle-jump.jsonl',
  },
};

const resolveFixturePath = (scenario: TutorialScenario, provider: AgentProvider): string | null => {
  const scenarioFiles = FIXTURE_FILES[scenario];
  const fileName = scenarioFiles[provider] ?? scenarioFiles.claude;
  const appRoot = app.getAppPath();
  const overrideRoot = process.env.VIBECRAFT_TUTORIAL_FIXTURES_DIR;
  const candidates = [
    overrideRoot ? path.join(overrideRoot, fileName) : null,
    path.join(appRoot, 'assets', 'tutorial', 'fixtures', fileName),
    path.join(process.cwd(), 'assets', 'tutorial', 'fixtures', fileName),
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const parseJsonLines = (raw: string): unknown[] => {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const parsed: unknown[] = [];
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line));
    } catch (error) {
      log.warn('Failed to parse tutorial fixture line', { error });
    }
  }
  return parsed;
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildClaudeTasksPath = (workspacePath: string): string => {
  const tmpDir = os.tmpdir();
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'user';
  const slug = workspacePath.replace(/[\\/]/g, '-').replace(/:/g, '');
  return path.join(tmpDir, `claude-${uid}`, slug, 'tasks');
};

const normalizeFixtureText = (value: string, workspacePath: string): string => {
  let next = value;
  if (next.includes(FIXTURE_WORKSPACE_TOKEN)) {
    next = next.split(FIXTURE_WORKSPACE_TOKEN).join(workspacePath);
  }
  if (next.includes(FIXTURE_USER_HOME_TOKEN)) {
    next = next.split(FIXTURE_USER_HOME_TOKEN).join(os.homedir());
  }
  if (next.includes(FIXTURE_CLAUDE_TASKS_TOKEN)) {
    next = next.split(FIXTURE_CLAUDE_TASKS_TOKEN).join(buildClaudeTasksPath(workspacePath));
  }
  return next;
};

const normalizeFixtureEvents = (events: AgentConnectEvent[], workspacePath: string): AgentConnectEvent[] =>
  events.map((event) => {
    if (event.type === 'message') {
      const content = normalizeFixtureText(event.content, workspacePath);
      return content === event.content ? event : { ...event, content };
    }
    if (event.type === 'tool_call') {
      const input = event.input ? normalizeFixtureText(event.input, workspacePath) : event.input;
      const output = event.output ? normalizeFixtureText(event.output, workspacePath) : event.output;
      if (input === event.input && output === event.output) return event;
      return { ...event, input, output };
    }
    if (event.type === 'delta') {
      const text = normalizeFixtureText(event.text, workspacePath);
      return text === event.text ? event : { ...event, text };
    }
    if (event.type === 'summary') {
      const summary = normalizeFixtureText(event.summary, workspacePath);
      return summary === event.summary ? event : { ...event, summary };
    }
    if (event.type === 'raw_line') {
      const line = normalizeFixtureText(event.line, workspacePath);
      return line === event.line ? event : { ...event, line };
    }
    if (event.type === 'error') {
      const message = normalizeFixtureText(event.message, workspacePath);
      return message === event.message ? event : { ...event, message };
    }
    if (event.type === 'thinking' && event.text) {
      const text = normalizeFixtureText(event.text, workspacePath);
      return text === event.text ? event : { ...event, text };
    }
    return event;
  });

const buildClaudeEvents = (lines: unknown[]): AgentConnectEvent[] => {
  const events: AgentConnectEvent[] = [];
  for (const entry of lines) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as {
      type?: string;
      message?: { role?: string; content?: unknown[] };
    };

    if (record.type === 'assistant' && record.message?.role === 'assistant') {
      const contentItems = Array.isArray(record.message.content) ? record.message.content : [];
      for (const item of contentItems) {
        if (!item || typeof item !== 'object') continue;
        const payload = item as { type?: string; text?: string; name?: string; id?: string; input?: unknown };
        if (payload.type === 'text' && payload.text) {
          events.push({ type: 'message', role: 'assistant', content: payload.text });
        } else if (payload.type === 'tool_use' && payload.id) {
          events.push({
            type: 'tool_call',
            phase: 'start',
            callId: payload.id,
            name: payload.name,
            input: payload.input ? toText(payload.input) : undefined,
          });
        }
      }
    }

    if (record.type === 'user' && record.message?.content) {
      const contentItems = Array.isArray(record.message.content) ? record.message.content : [];
      for (const item of contentItems) {
        if (!item || typeof item !== 'object') continue;
        const payload = item as {
          type?: string;
          tool_use_id?: string;
          content?: unknown;
          is_error?: boolean;
        };
        if (payload.type === 'tool_result' && payload.tool_use_id) {
          events.push({
            type: 'tool_call',
            phase: 'complete',
            callId: payload.tool_use_id,
            output: toText(payload.content),
            status: payload.is_error ? 'error' : 'completed',
          });
        }
      }
    }
  }
  return events;
};

const buildCodexEvents = (lines: unknown[]): AgentConnectEvent[] => {
  const events: AgentConnectEvent[] = [];
  for (const entry of lines) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as {
      type?: string;
      item?: {
        id?: string;
        type?: string;
        command?: string;
        aggregated_output?: string;
        exit_code?: number;
        text?: string;
      };
    };

    if (record.type === 'item.started' && record.item?.type === 'command_execution' && record.item.id) {
      events.push({
        type: 'tool_call',
        phase: 'start',
        callId: record.item.id,
        name: 'command_execution',
        input: record.item.command,
      });
    }

    if (record.type === 'item.completed' && record.item?.type === 'command_execution' && record.item.id) {
      events.push({
        type: 'tool_call',
        phase: 'complete',
        callId: record.item.id,
        name: 'command_execution',
        output: record.item.aggregated_output ?? '',
        status: record.item.exit_code === 0 ? 'completed' : 'error',
      });
    }

    if (record.type === 'item.completed' && record.item?.type === 'agent_message' && record.item.text) {
      events.push({
        type: 'message',
        role: 'assistant',
        content: record.item.text,
      });
    }
  }
  return events;
};

export const getTutorialStubEvents = (
  provider: AgentProvider,
  scenario: TutorialScenario,
  workspacePath: string
): AgentConnectEvent[] => {
  const fixturePath = resolveFixturePath(scenario, provider);
  if (!fixturePath) {
    log.warn('Tutorial fixture missing; using fallback output', { provider });
    return [{ type: 'message', role: 'assistant', content: DEFAULT_TUTORIAL_OUTPUTS[scenario] }];
  }

  const raw = fs.readFileSync(fixturePath, 'utf8');
  const lines = parseJsonLines(raw);
  const events = provider === 'codex' ? buildCodexEvents(lines) : buildClaudeEvents(lines);
  const normalizedEvents = normalizeFixtureEvents(events, workspacePath);

  if (normalizedEvents.length === 0) {
    log.warn('Tutorial fixture produced no events; using fallback output', { provider, fixturePath });
    return [{ type: 'message', role: 'assistant', content: DEFAULT_TUTORIAL_OUTPUTS[scenario] }];
  }

  const portToken = `localhost:${DEFAULT_TUTORIAL_PORTS[scenario]}`;
  const hasPortMessage = normalizedEvents.some(
    (event) =>
      event.type === 'message' &&
      event.role === 'assistant' &&
      typeof event.content === 'string' &&
      event.content.includes(portToken)
  );
  if (!hasPortMessage) {
    normalizedEvents.push({
      type: 'message',
      role: 'assistant',
      content: DEFAULT_TUTORIAL_OUTPUTS[scenario],
    });
  }

  return normalizedEvents;
};
