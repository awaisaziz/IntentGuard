import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../store/config.js';

export interface CheckResult {
  name: string;
  command: string;
  passed: boolean;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  /** Tail of combined stdout/stderr. */
  output: string;
}

const OUTPUT_TAIL = 6000;

function killTree(pid: number): void {
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => {});
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // Already exited
    }
  }
}

/**
 * Runs one of the named checks from `.intent/config.json` (`commands`). Only the
 * developer-configured command strings ever execute; callers choose them by name.
 * @param rootDir Repository root the command runs in
 * @param name Check name, e.g. "test"
 */
export async function runProjectCheck(
  rootDir: string,
  name: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<CheckResult> {
  const config = await loadConfig(rootDir);
  const command = config.commands?.[name];
  if (!command) {
    const known = Object.keys(config.commands ?? {});
    throw new Error(
      known.length
        ? `Unknown check "${name}". Configured checks: ${known.join(', ')}`
        : 'No checks are configured. Add them under "commands" in .intent/config.json, e.g. { "test": "npm test" }.'
    );
  }

  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? 5 * 60_000;
  return new Promise(resolve => {
    const child = spawn(command, {
      cwd: rootDir,
      shell: true,
      detached: process.platform !== 'win32',
      env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const collect = (chunk: Buffer) => {
      output = (output + chunk.toString('utf8')).slice(-OUTPUT_TAIL * 2);
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);

    let timedOut = false;
    const stop = () => child.pid !== undefined && killTree(child.pid);
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeoutMs);
    options.signal?.addEventListener('abort', stop, { once: true });

    const finish = (exitCode: number | null) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', stop);
      resolve({
        name,
        command,
        passed: exitCode === 0 && !timedOut,
        exitCode,
        timedOut,
        durationMs: Date.now() - started,
        output: output.slice(-OUTPUT_TAIL),
      });
    };
    child.on('error', err => {
      output += `\n${err.message}`;
      finish(null);
    });
    child.on('close', code => finish(code));
  });
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Guesses sensible checks for a repository from its manifests, used when a repo is
 * first connected. The developer can edit the result in `.intent/config.json`.
 */
export async function detectProjectCommands(rootDir: string): Promise<Record<string, string>> {
  const at = (f: string) => path.join(rootDir, f);
  const commands: Record<string, string> = {};

  try {
    const pkg = JSON.parse(await fs.readFile(at('package.json'), 'utf8'));
    const scripts: Record<string, string> = pkg.scripts ?? {};
    const pm = (await exists(at('pnpm-lock.yaml')))
      ? 'pnpm'
      : (await exists(at('yarn.lock')))
        ? 'yarn'
        : (await exists(at('bun.lockb'))) || (await exists(at('bun.lock')))
          ? 'bun'
          : 'npm';
    const placeholderTest = /no test specified/i;
    if (scripts.test && !placeholderTest.test(scripts.test)) commands.test = pm === 'npm' ? 'npm test' : `${pm} test`;
    for (const name of ['lint', 'typecheck', 'build']) {
      if (scripts[name]) commands[name] = `${pm} run ${name}`;
    }
  } catch {
    // Not a Node project
  }

  if (!commands.test) {
    if (await exists(at('go.mod'))) commands.test = 'go test ./...';
    else if (await exists(at('Cargo.toml'))) commands.test = 'cargo test';
    else if (await exists(at('pom.xml'))) commands.test = 'mvn -q test';
    else if (
      (await exists(at('pytest.ini'))) ||
      (await exists(at('pyproject.toml'))) ||
      (await exists(at('setup.cfg'))) ||
      (await exists(at('tox.ini')))
    ) {
      commands.test = 'python -m pytest -q';
    }
  }
  return commands;
}
