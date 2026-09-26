import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MCP_PACKAGE_NAME = '@intentguard/mcp-server';

/**
 * Finds the IntentGuard checkout this code is running from: the first ancestor
 * directory holding the `mcp/` workspace package. IntentGuard is never published,
 * so connected repos launch the MCP server straight out of this checkout.
 * @param from Directory to start searching from (defaults to this file's directory)
 * @returns The IntentGuard root, or undefined when it cannot be found
 */
export function findIntentGuardHome(from: string = path.dirname(fileURLToPath(import.meta.url))): string | undefined {
  let dir = path.resolve(from);
  for (;;) {
    const pkg = path.join(dir, 'mcp', 'package.json');
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, 'utf8')).name === MCP_PACKAGE_NAME) return dir;
      } catch {
        // Unreadable package.json: keep walking up
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Path to the built MCP server entry point inside the IntentGuard checkout.
 * @throws When the checkout cannot be found or the server has not been built
 */
export function mcpServerEntry(home: string | undefined = findIntentGuardHome()): string {
  if (!home) throw new Error('Could not locate the IntentGuard checkout (no mcp/ package found).');
  const entry = path.join(home, 'mcp', 'dist', 'index.js');
  if (!existsSync(entry)) {
    throw new Error('The IntentGuard MCP server is not built. Run `pnpm build` in the IntentGuard repository first.');
  }
  return entry;
}

/**
 * Loads `<IntentGuard>/.env` into process.env, without overriding variables that are
 * already set. Keys such as WATSONX_API_KEY live with IntentGuard, never in the
 * repositories it is connected to.
 * @returns True when a .env file was loaded
 */
export function loadIntentGuardEnv(home: string | undefined = findIntentGuardHome()): boolean {
  if (!home) return false;
  const envFile = path.join(home, '.env');
  if (!existsSync(envFile) || typeof process.loadEnvFile !== 'function') return false;
  try {
    process.loadEnvFile(envFile);
    return true;
  } catch {
    return false;
  }
}

/** Forward slashes work for node on every platform and keep JSON and TOML configs free of escapes. */
export function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}
