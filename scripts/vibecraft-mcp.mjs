#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';

const COMMANDS_RESOURCE_URI = 'vibecraft://commands';
const DOCS_RESOURCE_PREFIX = 'vibecraft://docs/';
const DEFAULT_TIMEOUT_MS = 15000;
const PROD_STORAGE_DIR = '.vibecraft';
const DEV_STORAGE_DIR = '.vibecraft-dev';
const DEFAULT_DOC_SEARCH_LIMIT = 10;
const MAX_DOC_SEARCH_LIMIT = 50;
const TEXT_FILE_EXTENSIONS = new Set([
  '.md',
  '.mdx',
  '.txt',
  '.rst',
  '.adoc',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
]);
const MIME_BY_EXTENSION = {
  '.md': 'text/markdown',
  '.mdx': 'text/markdown',
  '.txt': 'text/plain',
  '.rst': 'text/plain',
  '.adoc': 'text/plain',
  '.json': 'application/json',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.toml': 'application/toml',
};

const toolNames = {
  command: 'vibecraft.command',
  batch: 'vibecraft.batch',
  batchLegacy: 'vibecraft.command_batch',
  commands: 'vibecraft.commands',
  layout: 'vibecraft.layout',
  docsSearch: 'vibecraft.docs.search',
};

const args = parseArgs(process.argv.slice(2));
const resolvedPaths = resolveMcpPaths(args);
const docsRoot = resolveDocsRoot(args, resolvedPaths);
const serverInfo = getServerInfo();

const server = new Server(
  { name: 'vibecraft', version: serverInfo.version },
  { capabilities: { tools: {}, resources: {} } }
);

let pendingRequests = 0;
let pendingWrites = 0;
let shutdownRequested = false;
let shutdownStarted = false;

const maybeShutdown = () => {
  if (shutdownRequested && !shutdownStarted && pendingRequests === 0 && pendingWrites === 0) {
    void shutdown();
  }
};

const scheduleShutdownCheck = () => {
  if (shutdownRequested) {
    setImmediate(maybeShutdown);
  }
};

const trackRequest =
  (handler) =>
  async (...args) => {
    pendingRequests += 1;
    try {
      return await handler(...args);
    } finally {
      pendingRequests -= 1;
      scheduleShutdownCheck();
    }
  };

const shutdown = async () => {
  if (shutdownStarted) return;
  shutdownStarted = true;
  await server.close();
  process.exit(0);
};

server.setRequestHandler(
  ListToolsRequestSchema,
  trackRequest(async () => {
    return {
      tools: [
        {
          name: toolNames.commands,
          title: 'Discover Available Commands',
          description:
            'Get documentation for all available VibeCraft commands, including schemas and examples.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: toolNames.command,
          title: 'Run VibeCraft Command',
          description:
            'Execute a single command in the VibeCraft workspace. Commands control agents, folders, browsers, terminals, and workspace layout.',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Command identifier' },
                  args: { type: 'object', description: 'Command-specific arguments' },
                  source: {
                    type: 'string',
                    enum: ['mcp', 'ui', 'shortcut'],
                    description: 'Command source',
                  },
                },
                required: ['id'],
              },
            },
            required: ['command'],
          },
        },
        {
          name: toolNames.batch,
          title: 'Run VibeCraft Command Batch',
          description: 'Execute multiple commands in sequence.',
          inputSchema: {
            type: 'object',
            properties: {
              commands: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    args: { type: 'object' },
                  },
                  required: ['id'],
                },
              },
            },
            required: ['commands'],
          },
        },
        {
          name: toolNames.layout,
          title: 'Get Workspace Layout',
          description: 'Retrieve the current workspace layout including all entities and positions.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: toolNames.docsSearch,
          title: 'Search Workspace Docs',
          description:
            'Search user-facing documentation files in the configured docs root. Returns matching files with snippets.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search text to find in documentation files.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of matches to return.',
              },
            },
            required: ['query'],
          },
        },
      ],
    };
  })
);

server.setRequestHandler(
  CallToolRequestSchema,
  trackRequest(async (request) => {
    const { name, arguments: toolArgs } = request.params;

    if (name === toolNames.command) {
      const result = await callInternalTool(toolNames.command, toolArgs ?? {});
      return buildToolResponse(result);
    }

    if (name === toolNames.batch || name === toolNames.batchLegacy) {
      const result = await callInternalTool(toolNames.batch, toolArgs ?? {});
      return buildToolResponse(result);
    }

    if (name === toolNames.layout) {
      const result = await callInternalTool(toolNames.layout, toolArgs ?? {});
      return buildToolResponse(result);
    }

    if (name === toolNames.commands) {
      const result = await callInternalTool(toolNames.commands, toolArgs ?? {});
      return buildToolResponse(result);
    }

    if (name === toolNames.docsSearch) {
      const result = await searchDocumentation(toolArgs ?? {});
      return buildToolResponse({ ok: true, result: { structuredContent: result } });
    }

    return buildToolError(`Unknown tool: ${name}`);
  })
);

server.setRequestHandler(
  ListResourcesRequestSchema,
  trackRequest(async () => {
    const docsResources = listDocsResources();
    return {
      resources: [
        {
          uri: COMMANDS_RESOURCE_URI,
          name: 'Command Reference',
          description: 'Complete documentation of all VibeCraft commands with schemas and examples',
          mimeType: 'application/json',
        },
        ...docsResources,
      ],
    };
  })
);

server.setRequestHandler(
  ReadResourceRequestSchema,
  trackRequest(async (request) => {
    const { uri } = request.params;
    if (uri === COMMANDS_RESOURCE_URI) {
      const commandsPayload = await fetchCommandsResource();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(commandsPayload, null, 2),
          },
        ],
      };
    }
    if (!uri.startsWith(DOCS_RESOURCE_PREFIX)) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
    }
    const docResource = readDocResource(uri);
    return {
      contents: [
        {
          uri: docResource.uri,
          mimeType: docResource.mimeType,
          text: docResource.text,
        },
      ],
    };
  })
);

const transport = new StdioServerTransport();
const originalSend = transport.send.bind(transport);
transport.send = async (message, options) => {
  pendingWrites += 1;
  try {
    return await originalSend(message, options);
  } finally {
    pendingWrites -= 1;
    scheduleShutdownCheck();
  }
};
await server.connect(transport);

process.stdin.on('end', () => {
  shutdownRequested = true;
  scheduleShutdownCheck();
});
process.stdin.on('close', () => {
  shutdownRequested = true;
  scheduleShutdownCheck();
});

function parseArgs(argv) {
  const parsed = {
    workspace: undefined,
    info: undefined,
    timeout: undefined,
    storage: undefined,
    docsRoot: undefined,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--workspace' || arg === '-w') {
      parsed.workspace = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--info') {
      parsed.info = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--timeout') {
      parsed.timeout = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--storage' || arg === '-s') {
      parsed.storage = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--docs-root') {
      parsed.docsRoot = argv[i + 1];
      i += 1;
      continue;
    }
  }

  if (parsed.help) {
    printHelp();
    process.exit(0);
  }
  if (parsed.storage && parsed.storage !== 'dev' && parsed.storage !== 'prod') {
    console.error(`Invalid --storage value: ${parsed.storage}`);
    printHelp();
    process.exit(1);
  }

  return parsed;
}

function printHelp() {
  const lines = [
    'Usage: vibecraft-mcp [options]',
    '',
    'Options:',
    '  -w, --workspace <path>   Workspace root (defaults to env VIBECRAFT_WORKSPACE or search upward)',
    '  --info <path>            Path to .vibecraft[-dev]/mcp.json (overrides workspace)',
    '  -s, --storage <dev|prod> Storage namespace override (defaults to auto discovery)',
    '  --docs-root <path>       Root directory for docs resources/search',
    '  --timeout <ms>           HTTP timeout in milliseconds (default 15000)',
    '  -h, --help               Show this help text',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

function resolveMcpPaths(parsedArgs) {
  const storagePreference = resolveStoragePreference(parsedArgs);
  const infoOverride = parsedArgs.info || process.env.VIBECRAFT_MCP_INFO;
  if (infoOverride) {
    const infoPath = path.resolve(infoOverride);
    return {
      workspacePath: deriveWorkspaceFromInfo(infoPath),
      infoPath,
      timeoutMs: parseTimeout(parsedArgs.timeout),
    };
  }

  const workspaceCandidate = parsedArgs.workspace || process.env.VIBECRAFT_WORKSPACE;
  if (workspaceCandidate) {
    const workspacePath = path.resolve(workspaceCandidate);
    const preferredInfoPath = resolveInfoPathForWorkspace(workspacePath, storagePreference);
    return {
      workspacePath,
      infoPath: preferredInfoPath,
      timeoutMs: parseTimeout(parsedArgs.timeout),
    };
  }

  const discoveredInfo = findInfoUpwards(process.cwd(), storagePreference);
  if (discoveredInfo) {
    return {
      workspacePath: deriveWorkspaceFromInfo(discoveredInfo),
      infoPath: discoveredInfo,
      timeoutMs: parseTimeout(parsedArgs.timeout),
    };
  }

  return { workspacePath: undefined, infoPath: undefined, timeoutMs: parseTimeout(parsedArgs.timeout) };
}

function resolveDocsRoot(parsedArgs, paths) {
  const docsRootCandidate = parsedArgs.docsRoot || process.env.VIBECRAFT_DOCS_ROOT;
  if (!docsRootCandidate) return null;
  const resolved = path.resolve(docsRootCandidate);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return resolved;
  }
  if (paths.workspacePath) {
    const relativeFromWorkspace = path.resolve(paths.workspacePath, docsRootCandidate);
    if (fs.existsSync(relativeFromWorkspace) && fs.statSync(relativeFromWorkspace).isDirectory()) {
      return relativeFromWorkspace;
    }
  }
  return resolved;
}

function parseTimeout(rawValue) {
  if (!rawValue) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.trunc(parsed);
}

function deriveWorkspaceFromInfo(infoPath) {
  const infoDir = path.dirname(infoPath);
  if (isWorkspaceStorageDir(path.basename(infoDir))) {
    return path.dirname(infoDir);
  }
  return path.dirname(infoPath);
}

function findInfoUpwards(startDir, storagePreference) {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = resolveInfoPathForWorkspace(current, storagePreference);
    if (candidate) return candidate;
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function isWorkspaceStorageDir(dirName) {
  return dirName === PROD_STORAGE_DIR || dirName === DEV_STORAGE_DIR;
}

function getStorageDirNames(storagePreference) {
  if (storagePreference === 'prod') {
    return [PROD_STORAGE_DIR];
  }
  if (storagePreference === 'dev') {
    return [DEV_STORAGE_DIR];
  }
  return [DEV_STORAGE_DIR, PROD_STORAGE_DIR];
}

function resolveInfoPathForWorkspace(workspacePath, storagePreference) {
  const candidates = getStorageDirNames(storagePreference).map((dirName) =>
    path.join(workspacePath, dirName, 'mcp.json')
  );
  const existing = candidates
    .filter((candidate) => fs.existsSync(candidate))
    .map((candidate) => ({ candidate, mtimeMs: fs.statSync(candidate).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return existing[0]?.candidate ?? null;
}

function resolveStoragePreference(parsedArgs) {
  const fromArgs = parsedArgs.storage;
  if (fromArgs === 'dev' || fromArgs === 'prod') {
    return fromArgs;
  }
  const fromEnv = process.env.VIBECRAFT_STORAGE_NAMESPACE;
  if (fromEnv === 'dev' || fromEnv === 'prod') {
    return fromEnv;
  }
  return null;
}

function getServerInfo() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const packagePath = path.join(__dirname, '..', 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    if (pkg && typeof pkg.version === 'string') {
      return { version: pkg.version };
    }
  } catch {
    // fall through
  }
  return { version: '0.0.0' };
}

function readMcpInfo() {
  if (!resolvedPaths.infoPath) {
    if (resolvedPaths.workspacePath) {
      return {
        ok: false,
        error: `No mcp.json found for workspace: ${resolvedPaths.workspacePath}`,
      };
    }
    return { ok: false, error: 'Workspace not specified and no mcp.json found' };
  }
  let raw;
  try {
    raw = fs.readFileSync(resolvedPaths.infoPath, 'utf8');
  } catch (error) {
    return {
      ok: false,
      error: `Failed to read MCP info: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      error: `Invalid MCP info JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Invalid MCP info payload' };
  }
  const host = typeof parsed.host === 'string' ? parsed.host : '';
  const port = typeof parsed.port === 'number' ? parsed.port : Number(parsed.port);
  if (!host || !Number.isFinite(port)) {
    return { ok: false, error: 'MCP info missing host or port' };
  }
  return { ok: true, info: { host, port } };
}

async function callInternalTool(name, args) {
  const infoResult = readMcpInfo();
  if (!infoResult.ok) {
    return { ok: false, error: infoResult.error };
  }

  const payload = {
    jsonrpc: '2.0',
    id: createRequestId(),
    method: 'tools/call',
    params: {
      name,
      arguments: args,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolvedPaths.timeoutMs);

  try {
    const response = await fetch(`http://${infoResult.info.host}:${infoResult.info.port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      return { ok: false, error: `MCP bridge HTTP ${response.status}: ${text}` };
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return {
        ok: false,
        error: `Invalid MCP bridge response: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    if (parsed?.error) {
      const message = parsed.error?.message || 'MCP bridge error';
      return { ok: false, error: message };
    }

    return { ok: true, result: parsed?.result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `MCP bridge request failed: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}

function buildToolResponse(result) {
  if (!result.ok) {
    return buildToolError(result.error);
  }
  const payload = extractStructuredContent(result.result);
  const text = JSON.stringify(payload ?? result.result ?? {}, null, 2);
  const isError =
    payload && typeof payload === 'object' && 'ok' in payload ? payload.ok === false : undefined;
  return {
    content: [{ type: 'text', text }],
    structuredContent: payload ?? undefined,
    isError: isError || undefined,
  };
}

function buildToolError(message) {
  const errorText = typeof message === 'string' ? message : 'Unknown tool error';
  const payload = { ok: false, error: errorText };
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError: true,
  };
}

function extractStructuredContent(result) {
  if (result && typeof result === 'object' && 'structuredContent' in result) {
    return result.structuredContent;
  }
  const text = result?.content?.[0]?.text;
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchCommandsResource() {
  const result = await callInternalTool(toolNames.commands, {});
  if (!result.ok) {
    throw new McpError(ErrorCode.InternalError, result.error || 'Failed to fetch command metadata');
  }
  const payload = extractStructuredContent(result.result);
  if (!payload) {
    throw new McpError(ErrorCode.InternalError, 'Failed to parse command metadata');
  }
  return payload;
}

function listDocsResources() {
  const files = listDocsFiles();
  return files.map((relativePath) => ({
    uri: toDocsResourceUri(relativePath),
    name: `Docs: ${relativePath}`,
    description: `Documentation file ${relativePath}`,
    mimeType: mimeTypeForPath(relativePath),
  }));
}

function readDocResource(uri) {
  if (!docsRoot) {
    throw new McpError(ErrorCode.InvalidParams, 'Docs root is not configured');
  }
  const relativePath = parseDocsResourceUri(uri);
  const absolutePath = resolveDocAbsolutePath(relativePath);
  const text = fs.readFileSync(absolutePath, 'utf8');
  return {
    uri: toDocsResourceUri(relativePath),
    mimeType: mimeTypeForPath(relativePath),
    text,
  };
}

async function searchDocumentation(args) {
  if (!docsRoot) {
    throw new McpError(ErrorCode.InvalidParams, 'Docs root is not configured');
  }
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (!query) {
    throw new McpError(ErrorCode.InvalidParams, 'query is required');
  }
  const limit = normalizeSearchLimit(args.limit);
  const queryLower = query.toLowerCase();
  const matches = [];
  const files = listDocsFiles();

  for (const relativePath of files) {
    const absolutePath = resolveDocAbsolutePath(relativePath);
    let content = '';
    try {
      content = fs.readFileSync(absolutePath, 'utf8');
    } catch {
      continue;
    }
    const contentLower = content.toLowerCase();
    const firstIndex = contentLower.indexOf(queryLower);
    if (firstIndex === -1) continue;
    matches.push({
      path: relativePath,
      uri: toDocsResourceUri(relativePath),
      score: countOccurrences(contentLower, queryLower),
      snippet: createSnippet(content, firstIndex, query.length),
    });
  }

  matches.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.path.localeCompare(right.path);
  });

  return {
    ok: true,
    query,
    docsRoot,
    totalMatches: matches.length,
    matches: matches.slice(0, limit),
  };
}

function normalizeSearchLimit(value) {
  if (value === undefined) return DEFAULT_DOC_SEARCH_LIMIT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_DOC_SEARCH_LIMIT;
  const normalized = Math.trunc(parsed);
  if (normalized <= 0) return DEFAULT_DOC_SEARCH_LIMIT;
  return Math.min(normalized, MAX_DOC_SEARCH_LIMIT);
}

function listDocsFiles() {
  if (!docsRoot || !fs.existsSync(docsRoot)) return [];
  let rootStats;
  try {
    rootStats = fs.statSync(docsRoot);
  } catch {
    return [];
  }
  if (!rootStats.isDirectory()) return [];

  const files = [];
  const visit = (absoluteDir, relativeDir = '') => {
    let entries = [];
    try {
      entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const entryRelative = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
      const entryAbsolute = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        visit(entryAbsolute, entryRelative);
        continue;
      }
      if (!entry.isFile()) continue;
      const normalizedRelative = normalizeRelativePath(entryRelative);
      if (!isTextDocsPath(normalizedRelative)) continue;
      files.push(normalizedRelative);
    }
  };

  visit(docsRoot);
  files.sort((left, right) => left.localeCompare(right));
  return files;
}

function parseDocsResourceUri(uri) {
  if (!uri.startsWith(DOCS_RESOURCE_PREFIX)) {
    throw new McpError(ErrorCode.InvalidParams, `Unknown docs resource URI: ${uri}`);
  }
  const encodedPath = uri.slice(DOCS_RESOURCE_PREFIX.length);
  if (!encodedPath) {
    throw new McpError(ErrorCode.InvalidParams, 'Docs resource path is required');
  }
  let decoded = '';
  try {
    decoded = encodedPath
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
      .join('/');
  } catch {
    throw new McpError(ErrorCode.InvalidParams, 'Docs resource URI is invalid');
  }
  const normalized = normalizeRelativePath(decoded);
  if (!normalized) {
    throw new McpError(ErrorCode.InvalidParams, 'Docs resource path is required');
  }
  return normalized;
}

function toDocsResourceUri(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const encoded = normalized
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${DOCS_RESOURCE_PREFIX}${encoded}`;
}

function resolveDocAbsolutePath(relativePath) {
  if (!docsRoot) {
    throw new McpError(ErrorCode.InvalidParams, 'Docs root is not configured');
  }
  const normalized = normalizeRelativePath(relativePath);
  const absolute = path.resolve(docsRoot, normalized);
  const docsRootPrefix = docsRoot.endsWith(path.sep) ? docsRoot : `${docsRoot}${path.sep}`;
  if (absolute !== docsRoot && !absolute.startsWith(docsRootPrefix)) {
    throw new McpError(ErrorCode.InvalidParams, `Docs path is outside docs root: ${relativePath}`);
  }
  if (!fs.existsSync(absolute)) {
    throw new McpError(ErrorCode.InvalidParams, `Docs file does not exist: ${relativePath}`);
  }
  const stats = fs.statSync(absolute);
  if (!stats.isFile()) {
    throw new McpError(ErrorCode.InvalidParams, `Docs resource is not a file: ${relativePath}`);
  }
  return absolute;
}

function normalizeRelativePath(value) {
  return value
    .split(path.sep)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

function isTextDocsPath(relativePath) {
  const extension = path.extname(relativePath).toLowerCase();
  return TEXT_FILE_EXTENSIONS.has(extension);
}

function mimeTypeForPath(relativePath) {
  const extension = path.extname(relativePath).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? 'text/plain';
}

function countOccurrences(haystack, needle) {
  let index = 0;
  let count = 0;
  while (index >= 0) {
    index = haystack.indexOf(needle, index);
    if (index === -1) break;
    count += 1;
    index += needle.length;
  }
  return count;
}

function createSnippet(content, index, queryLength) {
  const windowSize = 140;
  const start = Math.max(0, index - Math.floor(windowSize / 2));
  const end = Math.min(content.length, index + queryLength + Math.floor(windowSize / 2));
  const snippet = content.slice(start, end).replace(/\s+/g, ' ').trim();
  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length ? '...' : '';
  return `${prefix}${snippet}${suffix}`;
}

function createRequestId() {
  return `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
