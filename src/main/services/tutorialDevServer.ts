import http from 'node:http';
import { app } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { storage } from './storage';
import { resolveWorkspaceSubpath } from './workspacePaths';
import { logger } from '../logger';
import type { TutorialScenario } from './tutorialAgentStub';

const execFileAsync = promisify(execFile);
const TUTORIAL_SERVER_HOST = '127.0.0.1';

type ScenarioConfig = {
  port: number;
  templateDirName: string;
  defaultFolderName: string;
  folderIdKey: 'folderId' | 'folderId2';
};

const SCENARIOS: Record<TutorialScenario, ScenarioConfig> = {
  'cookie-clicker': {
    port: 3000,
    templateDirName: 'cookie-clicker',
    defaultFolderName: 'cookie-clicker',
    folderIdKey: 'folderId',
  },
  'doodle-jump': {
    port: 3001,
    templateDirName: 'doodle-jump',
    defaultFolderName: 'doodle-jump',
    folderIdKey: 'folderId2',
  },
};

const activeServers = new Map<number, { server: http.Server; workspacePath: string }>();
const activeServerStarts = new Map<number, Promise<void>>();
const killExternalPortsEnabled = ['1', 'true', 'yes'].includes(
  (process.env.VIBECRAFT_TUTORIAL_KILL_EXTERNAL_PORTS ?? '').trim().toLowerCase()
);

const getTutorialTemplateDir = (templateDirName: string): string | null => {
  const candidates = [
    path.join(app.getAppPath(), 'assets', 'tutorial', templateDirName),
    path.join(process.cwd(), 'assets', 'tutorial', templateDirName),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
};

const resolveTutorialFolderPath = (workspacePath: string, scenario: TutorialScenario): string => {
  const config = SCENARIOS[scenario];
  const settings = storage.loadSettings();
  const tutorialFolderId = settings.tutorial?.createdIds?.[config.folderIdKey];
  const folders = storage.loadFolders(workspacePath);
  const selectedFolder =
    (tutorialFolderId ? folders.find((folder) => folder.id === tutorialFolderId) : null) ??
    folders.find((folder) => folder.name.toLowerCase() === config.defaultFolderName);
  const relativePath = selectedFolder?.relativePath ?? config.defaultFolderName;
  return resolveWorkspaceSubpath(workspacePath, relativePath) ?? path.join(workspacePath, relativePath);
};

const copyTemplateFiles = (sourceDir: string, targetDir: string): void => {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyTemplateFiles(sourcePath, targetPath);
      continue;
    }
    if (fs.existsSync(targetPath)) continue;
    fs.copyFileSync(sourcePath, targetPath);
  }
};

const ensureTutorialIndex = (workspacePath: string, scenario: TutorialScenario): void => {
  const folderPath = resolveTutorialFolderPath(workspacePath, scenario);
  fs.mkdirSync(folderPath, { recursive: true });
  const config = SCENARIOS[scenario];
  const templateDir = getTutorialTemplateDir(config.templateDirName);
  if (!templateDir) {
    throw new Error(`Tutorial template missing: ${config.templateDirName}`);
  }
  copyTemplateFiles(templateDir, folderPath);
};

const closeActiveServer = async (port: number): Promise<void> => {
  const entry = activeServers.get(port);
  if (!entry) return;
  activeServers.delete(port);
  await new Promise<void>((resolve) => {
    entry.server.close(() => resolve());
  });
};

const normalizeCommandLine = (value: string): string => value.trim().toLowerCase();

const matchesAppSignature = (commandLine: string): boolean => {
  const normalized = normalizeCommandLine(commandLine);
  if (!normalized) return false;
  const appPath = normalizeCommandLine(app.getAppPath());
  const execPath = normalizeCommandLine(process.execPath);
  if (appPath && normalized.includes(appPath)) return true;
  if (execPath && normalized.includes(execPath)) return true;
  return normalized.includes('vibecraft');
};

const getCommandLineForPid = async (pid: number): Promise<string | null> => {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('wmic', [
        'process',
        'where',
        `ProcessId=${pid}`,
        'get',
        'CommandLine',
        '/value',
      ]);
      const lines = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const match = lines.find((line) => line.toLowerCase().startsWith('commandline='));
      return match ? match.slice('commandline='.length).trim() : null;
    }
    const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', 'command=']);
    return stdout.trim() || null;
  } catch (error) {
    logger.warn('Failed to resolve process command line', { pid, error });
    return null;
  }
};

const isKillCandidate = async (pid: number, options: { allowExternal: boolean }): Promise<boolean> => {
  if (!Number.isFinite(pid) || pid <= 1) return false;
  if (pid === process.pid || pid === process.ppid) return false;
  const commandLine = await getCommandLineForPid(pid);
  if (!commandLine) return options.allowExternal;
  if (matchesAppSignature(commandLine)) return true;
  return options.allowExternal;
};

const allowExternalKillForPort = (port: number): boolean => {
  if (killExternalPortsEnabled) return true;
  return port === SCENARIOS['cookie-clicker'].port || port === SCENARIOS['doodle-jump'].port;
};

const TUTORIAL_SIGNATURES: Record<TutorialScenario, string[]> = {
  'cookie-clicker': ['<title>cookie clicker</title>', 'cookie clicker'],
  'doodle-jump': ['<title>doodle jump</title>', 'tutorial:doodle-jump', 'doodle jump'],
};

const fetchTutorialHtml = (port: number): Promise<string | null> =>
  new Promise((resolve) => {
    const request = http.get(
      {
        hostname: TUTORIAL_SERVER_HOST,
        port,
        path: '/',
        timeout: 2000,
      },
      (response) => {
        const chunks: string[] = [];
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });
        response.on('end', () => {
          resolve(chunks.join(''));
        });
      }
    );
    request.on('error', () => resolve(null));
    request.on('timeout', () => {
      request.destroy();
      resolve(null);
    });
  });

const matchesTutorialSignature = (html: string | null, scenario: TutorialScenario): boolean => {
  if (!html) return false;
  const normalized = html.toLowerCase();
  return TUTORIAL_SIGNATURES[scenario].some((token) => normalized.includes(token));
};

const verifyTutorialServer = async (scenario: TutorialScenario): Promise<boolean> => {
  const config = SCENARIOS[scenario];
  const html = await fetchTutorialHtml(config.port);
  return matchesTutorialSignature(html, scenario);
};

const killProcessOnPort = async (port: number): Promise<void> => {
  const allowExternal = allowExternalKillForPort(port);
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('netstat', ['-ano', '-p', 'tcp']);
      const pids = new Set<number>();
      stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.includes(`:${port}`) && line.toUpperCase().includes('LISTENING'))
        .forEach((line) => {
          const parts = line.split(/\s+/);
          const pid = Number(parts[parts.length - 1]);
          if (Number.isFinite(pid) && pid > 0 && pid !== process.pid) {
            pids.add(pid);
          }
        });
      for (const pid of pids) {
        if (!(await isKillCandidate(pid, { allowExternal }))) continue;
        try {
          process.kill(pid);
        } catch (error) {
          logger.warn('Failed to kill process on port', { port, pid, error });
        }
      }
    } catch (error) {
      logger.warn('Failed to probe port usage', { port, error });
    }
    return;
  }

  try {
    const { stdout } = await execFileAsync('lsof', ['-n', '-P', '-iTCP:' + port, '-sTCP:LISTEN', '-t']);
    const pids = stdout
      .split(/\s+/)
      .filter(Boolean)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0 && value !== process.pid);
    for (const pid of pids) {
      if (!(await isKillCandidate(pid, { allowExternal }))) continue;
      try {
        process.kill(pid);
      } catch (error) {
        logger.warn('Failed to kill process on port', { port, pid, error });
      }
    }
  } catch (error) {
    logger.warn('Failed to probe port usage', { port, error });
  }
};

const startTutorialServer = async (workspacePath: string, scenario: TutorialScenario): Promise<void> => {
  const config = SCENARIOS[scenario];
  ensureTutorialIndex(workspacePath, scenario);
  await closeActiveServer(config.port);
  await killProcessOnPort(config.port);

  const folderPath = resolveTutorialFolderPath(workspacePath, scenario);
  const server = http.createServer((request, response) => {
    const url = request.url ?? '/';
    const pathname = new URL(url, `http://${TUTORIAL_SERVER_HOST}:${config.port}`).pathname;
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const resolvedPath = path.join(folderPath, normalized);
    if (!resolvedPath.startsWith(folderPath)) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Forbidden');
      return;
    }
    if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    const extension = path.extname(resolvedPath).toLowerCase();
    const mimeType =
      extension === '.html'
        ? 'text/html; charset=utf-8'
        : extension === '.css'
          ? 'text/css; charset=utf-8'
          : extension === '.js'
            ? 'application/javascript; charset=utf-8'
            : extension === '.json'
              ? 'application/json; charset=utf-8'
              : extension === '.svg'
                ? 'image/svg+xml'
                : extension === '.png'
                  ? 'image/png'
                  : extension === '.jpg' || extension === '.jpeg'
                    ? 'image/jpeg'
                    : extension === '.gif'
                      ? 'image/gif'
                      : 'application/octet-stream';
    response.writeHead(200, { 'content-type': mimeType });
    fs.createReadStream(resolvedPath).pipe(response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.warn('Tutorial server already running on port', { port: config.port });
        resolve();
        return;
      }
      reject(error);
    });
    server.listen(config.port, TUTORIAL_SERVER_HOST, () => {
      server.off('error', reject);
      resolve();
    });
  });

  if (server.listening) {
    activeServers.set(config.port, { server, workspacePath });
  }
};

export const ensureTutorialDevServer = async (options: {
  workspacePath: string;
  scenario: TutorialScenario;
}): Promise<boolean> => {
  const config = SCENARIOS[options.scenario];
  const activeEntry = activeServers.get(config.port);
  if (activeEntry?.server.listening && activeEntry.workspacePath === options.workspacePath) {
    if (await verifyTutorialServer(options.scenario)) return true;
    await closeActiveServer(config.port);
  }
  const inflight = activeServerStarts.get(config.port);
  if (inflight) {
    await inflight;
    const nextEntry = activeServers.get(config.port);
    if (nextEntry?.server.listening && nextEntry.workspacePath === options.workspacePath) {
      if (await verifyTutorialServer(options.scenario)) return true;
    }
  }
  const startPromise = startTutorialServer(options.workspacePath, options.scenario).finally(() => {
    activeServerStarts.delete(config.port);
  });
  activeServerStarts.set(config.port, startPromise);
  await startPromise;
  if (await verifyTutorialServer(options.scenario)) return true;

  await closeActiveServer(config.port);
  await killProcessOnPort(config.port);
  await startTutorialServer(options.workspacePath, options.scenario);
  if (await verifyTutorialServer(options.scenario)) return true;
  throw new Error(`Tutorial server on port ${config.port} is not serving the expected content.`);
};

export const stopTutorialDevServer = async (): Promise<void> => {
  const ports = Array.from(activeServers.keys());
  await Promise.all(ports.map((port) => closeActiveServer(port)));
};
