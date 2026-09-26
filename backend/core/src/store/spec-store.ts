import fs from 'node:fs/promises';
import path from 'node:path';
import type { IntentSpec, ProofReport, IntentConfig } from '../schema/intentspec.js';
import { specToMarkdown } from '../utils/markdown.js';
import { redactReport, redactSpec, type PiiMatch } from '../privacy/redact.js';
import { DEFAULT_CONFIG, loadConfig } from './config.js';

export interface SavedSpec {
  /** What was actually written, after redaction. */
  spec: IntentSpec;
  redactions: PiiMatch[];
}

export interface SavedReport {
  report: ProofReport;
  redactions: PiiMatch[];
}

/**
 * Reads and writes IntentSpecs and proof reports under `.intent/`.
 *
 * Specs and reports are committed to the repository, so every write passes
 * through the privacy redactor unless `privacy.redactSpecs` /
 * `privacy.redactReports` is set to `false` in `.intent/config.json`.
 */
export class SpecStore {
  private config: IntentConfig;
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.config = { ...DEFAULT_CONFIG, privacy: { ...DEFAULT_CONFIG.privacy } };
  }

  private async ensureConfig(): Promise<IntentConfig> {
    try {
      this.config = await loadConfig(this.rootDir);
    } catch {
      // Keep default config
    }
    return this.config;
  }

  async init(): Promise<void> {
    await this.ensureConfig();
    await fs.mkdir(path.join(this.rootDir, this.config.specDir), { recursive: true });
    await fs.mkdir(path.join(this.rootDir, this.config.reportDir), { recursive: true });
  }

  /**
   * Writes a spec as JSON plus a Markdown rendering.
   * @returns The redacted spec that was written, and what was redacted
   */
  async save(spec: IntentSpec): Promise<SavedSpec> {
    const config = await this.ensureConfig();
    const { spec: safe, matches } =
      config.privacy?.redactSpecs === false ? { spec, matches: [] } : redactSpec(spec, this.rootDir);

    const specsDir = path.join(this.rootDir, config.specDir);
    await fs.mkdir(specsDir, { recursive: true });
    await fs.writeFile(path.join(specsDir, `${safe.id}.json`), JSON.stringify(safe, null, 2), 'utf8');
    await fs.writeFile(path.join(specsDir, `${safe.id}.md`), specToMarkdown(safe), 'utf8');
    return { spec: safe, redactions: matches };
  }

  async load(id: string): Promise<IntentSpec> {
    await this.ensureConfig();
    const jsonPath = path.join(this.rootDir, this.config.specDir, `${id}.json`);
    const content = await fs.readFile(jsonPath, 'utf8');
    return JSON.parse(content) as IntentSpec;
  }

  async loadActive(): Promise<IntentSpec | null> {
    try {
      await this.ensureConfig();
      const activePath = path.join(this.rootDir, '.intent', 'active.json');
      const content = await fs.readFile(activePath, 'utf8');
      const data = JSON.parse(content);
      if (data.activeSpecId) {
        return await this.load(data.activeSpecId);
      }
      return null;
    } catch {
      return null;
    }
  }

  async setActive(id: string | null): Promise<void> {
    const intentDir = path.join(this.rootDir, '.intent');
    await fs.mkdir(intentDir, { recursive: true });
    const activePath = path.join(intentDir, 'active.json');
    if (id) {
      await fs.writeFile(activePath, JSON.stringify({ activeSpecId: id }, null, 2), 'utf8');
    } else {
      try {
        await fs.unlink(activePath);
      } catch {
        // Ignore if file doesn't exist
      }
    }
  }

  async list(): Promise<string[]> {
    try {
      await this.ensureConfig();
      const specsDir = path.join(this.rootDir, this.config.specDir);
      const files = await fs.readdir(specsDir);
      return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  /**
   * Writes a proof report. Test output is path-normalised so the committed
   * report never contains a machine-specific path.
   * @returns The redacted report that was written, and what was redacted
   */
  async saveReport(report: ProofReport): Promise<SavedReport> {
    const config = await this.ensureConfig();
    const { report: safe, matches } =
      config.privacy?.redactReports === false ? { report, matches: [] } : redactReport(report, this.rootDir);

    const reportsDir = path.join(this.rootDir, config.reportDir);
    await fs.mkdir(reportsDir, { recursive: true });
    await fs.writeFile(path.join(reportsDir, `${safe.specId}-report.json`), JSON.stringify(safe, null, 2), 'utf8');
    return { report: safe, redactions: matches };
  }

  async loadReport(specId: string): Promise<ProofReport | null> {
    try {
      await this.ensureConfig();
      const reportPath = path.join(this.rootDir, this.config.reportDir, `${specId}-report.json`);
      const content = await fs.readFile(reportPath, 'utf8');
      return JSON.parse(content) as ProofReport;
    } catch {
      return null;
    }
  }
}
