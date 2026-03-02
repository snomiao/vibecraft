import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const parseArgs = (argv) => {
  const options = {
    iterations: 5,
    outDir: 'history/perf',
    runtime: false,
    runtimeShowWindow: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if ((arg === '--iterations' || arg === '-n') && argv[i + 1]) {
      const value = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(value) && value > 0) {
        options.iterations = value;
      }
      i += 1;
      continue;
    }
    if ((arg === '--out-dir' || arg === '-o') && argv[i + 1]) {
      options.outDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--runtime') {
      options.runtime = true;
      continue;
    }
    if (arg === '--runtime-show-window') {
      options.runtime = true;
      options.runtimeShowWindow = true;
    }
  }

  return options;
};

const runCommand = (command, args, env) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env,
    });

    child.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });

const extractBenchmarks = (payload) => {
  const collected = [];

  const visit = (node) => {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const candidate = /** @type {Record<string, unknown>} */ (node);
    const name = typeof candidate.name === 'string' ? candidate.name : null;
    const stats = candidate.stats && typeof candidate.stats === 'object' ? candidate.stats : null;
    const hzCandidate = [
      candidate.hz,
      stats && typeof stats === 'object' ? stats.hz : undefined,
      candidate.runsPerSecond,
    ].find((value) => typeof value === 'number' && Number.isFinite(value));

    if (name && typeof hzCandidate === 'number') {
      collected.push({
        name,
        hz: hzCandidate,
      });
    }

    Object.values(candidate).forEach(visit);
  };

  visit(payload);
  const deduped = new Map();
  collected.forEach((entry) => {
    const existing = deduped.get(entry.name);
    if (!existing || entry.hz > existing.hz) {
      deduped.set(entry.name, entry);
    }
  });

  return [...deduped.values()];
};

const timestampSlug = () => new Date().toISOString().replace(/[.:]/g, '-');

const main = async () => {
  const { iterations, outDir, runtime, runtimeShowWindow } = parseArgs(process.argv.slice(2));
  const outputDir = resolve(process.cwd(), outDir);
  await mkdir(outputDir, { recursive: true });

  const loopId = timestampSlug();
  const env = {
    ...process.env,
    VIBECRAFT_TUTORIAL_FIXTURES_DIR:
      process.env.VIBECRAFT_TUTORIAL_FIXTURES_DIR || resolve(process.cwd(), 'assets', 'tutorial', 'fixtures'),
  };

  if (runtime) {
    console.log('\n[perf-loop] building app for runtime benchmark passes');
    await runCommand('bun', ['run', 'build'], env);
  }

  const runs = [];
  for (let i = 1; i <= iterations; i += 1) {
    const filePath = resolve(outputDir, `perf-bench-${loopId}-${String(i).padStart(2, '0')}.json`);
    console.log(`\n[perf-loop] run ${i}/${iterations}`);
    await runCommand(
      'bunx',
      ['vitest', 'bench', '--config', 'vitest.perf.config.ts', '--run', '--outputJson', filePath],
      env
    );

    const raw = await readFile(filePath, 'utf8');
    const payload = JSON.parse(raw);
    const benchmarks = extractBenchmarks(payload);
    const averageHz =
      benchmarks.length > 0
        ? benchmarks.reduce((sum, benchmark) => sum + benchmark.hz, 0) / benchmarks.length
        : 0;

    const runSummary = {
      run: i,
      filePath,
      averageHz,
      benchmarks,
    };

    if (runtime) {
      const runtimeFilePath = resolve(
        outputDir,
        `perf-runtime-panning-${loopId}-${String(i).padStart(2, '0')}.json`
      );
      const runtimeEnv = {
        ...env,
        VIBECRAFT_RUNTIME_PERF_OUT: runtimeFilePath,
        VIBECRAFT_RUNTIME_PERF_DISABLE_BACKGROUND_THROTTLING:
          process.env.VIBECRAFT_RUNTIME_PERF_DISABLE_BACKGROUND_THROTTLING ?? '1',
        ...(runtimeShowWindow ? { VIBECRAFT_RUNTIME_PERF_SHOW_WINDOW: '1' } : {}),
      };

      console.log(`[perf-loop] runtime pass ${i}/${iterations}`);
      await runCommand(
        'bunx',
        ['playwright', 'test', '--config', 'tests/perf/runtime/playwright.perf.config.ts'],
        runtimeEnv
      );

      const runtimeRaw = await readFile(runtimeFilePath, 'utf8');
      const runtimePayload = JSON.parse(runtimeRaw);
      runSummary.runtime = {
        filePath: runtimeFilePath,
        avgFps: runtimePayload?.frame?.avgFps ?? 0,
        minFps: runtimePayload?.frame?.minFps ?? 0,
        avgP95FrameMs: runtimePayload?.frame?.avgP95FrameMs ?? 0,
        sampleCount: runtimePayload?.capture?.sampleCount ?? 0,
      };
      console.log(
        `[perf-loop] runtime avg fps: ${runSummary.runtime.avgFps.toFixed(2)} min fps: ${runSummary.runtime.minFps.toFixed(2)}`
      );
    }

    runs.push(runSummary);

    console.log(
      `[perf-loop] run ${i} avg hz: ${averageHz.toFixed(2)} (${benchmarks.length} benchmarks discovered)`
    );
  }

  const summary = {
    loopId,
    createdAt: new Date().toISOString(),
    iterations,
    runs,
  };

  const summaryPath = resolve(outputDir, `perf-bench-summary-${loopId}.json`);
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log(`\n[perf-loop] summary written to ${summaryPath}`);
};

main().catch((error) => {
  console.error('[perf-loop] failed', error);
  process.exitCode = 1;
});
