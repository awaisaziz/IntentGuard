import fs from 'node:fs/promises';
import path from 'node:path';
import type { IntentConfig } from '../schema/intentspec.js';

export const DEFAULT_CONFIG: IntentConfig = {
  projectName: undefined,
  llmProvider: 'auto',
  readinessThreshold: 70,
  specDir: '.intent/specs',
  reportDir: '.intent/reports',
  privacy: { redactSpecs: true, redactReports: true },
};

/**
 * Loads the config from .intent/config.json, applying defaults for anything missing.
 * @param rootDir Root directory of the project
 * @returns The configuration
 */
export async function loadConfig(rootDir: string): Promise<IntentConfig> {
  try {
    const configPath = path.join(rootDir, '.intent', 'config.json');
    const content = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(content) as Partial<IntentConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      privacy: { ...DEFAULT_CONFIG.privacy, ...parsed.privacy },
    };
  } catch {
    // If not found or invalid, return defaults
    return { ...DEFAULT_CONFIG, privacy: { ...DEFAULT_CONFIG.privacy } };
  }
}

/**
 * Saves the given config to .intent/config.json
 * @param rootDir Root directory of the project
 * @param config Configuration to save
 */
export async function saveConfig(rootDir: string, config: IntentConfig): Promise<void> {
  const intentDir = path.join(rootDir, '.intent');
  await fs.mkdir(intentDir, { recursive: true });
  const configPath = path.join(intentDir, 'config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Detects basic project info to prepopulate config if needed.
 * @param rootDir Root directory of the project
 * @returns Detected info like projectName
 */
export async function detectProjectInfo(rootDir: string): Promise<{ projectName?: string }> {
  try {
    const pkgPath = path.join(rootDir, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(content);
    return { projectName: pkg.name };
  } catch {
    return {};
  }
}
