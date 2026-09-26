import fs from 'node:fs/promises';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { toPosixPath } from '../utils/home.js';

export class WorkspaceError extends Error {}

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'out', 'coverage', '.turbo', '__pycache__', '.venv', 'venv', 'target']);
const SECRET_FILE = /(^|\/)(\.env(\.(?!example$|sample$|template$)[^/]+)?|id_(rsa|dsa|ecdsa|ed25519)|\.netrc|\.pypirc)$|\.(pem|key|p12|pfx|jks|keystore)$/i;
const MAX_READ_BYTES = 256 * 1024;
const MAX_SEARCH_BYTES = 1024 * 1024;

/**
 * File access for the chat agent, confined to one repository. Everything the model asks
 * for is resolved against the root; paths that escape it, secrets, and IntentGuard's own
 * state are refused no matter what the model says.
 */
export class Workspace {
  readonly root: string;
  private realRoot?: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  /**
   * Resolves a model-supplied path to an absolute path inside the root.
   * @param mode "write" additionally protects `.intent/` and dependency folders
   */
  async resolve(input: string, mode: 'read' | 'write'): Promise<{ abs: string; rel: string }> {
    if (typeof input !== 'string' || !input.trim()) throw new WorkspaceError('A file path is required.');
    const abs = path.resolve(this.root, input.trim());
    const rel = toPosixPath(path.relative(this.root, abs));
    if (rel === '' && mode === 'write') throw new WorkspaceError('Refusing to write to the repository root itself.');
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new WorkspaceError(`Path is outside the repository: ${input}`);
    }

    // Follow symlinks: the real target must also be inside the repository
    this.realRoot ??= await fs.realpath(this.root);
    let probe = abs;
    for (;;) {
      try {
        const real = await fs.realpath(probe);
        const realRel = path.relative(this.realRoot, real);
        if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
          throw new WorkspaceError(`Path resolves outside the repository: ${input}`);
        }
        break;
      } catch (err) {
        if (err instanceof WorkspaceError) throw err;
        const parent = path.dirname(probe);
        if (parent === probe) break;
        probe = parent; // Not created yet: check the nearest existing ancestor
      }
    }

    const segments = rel.split('/');
    if (segments[0] === '.git') throw new WorkspaceError('The .git directory is off limits.');
    if (SECRET_FILE.test(rel)) throw new WorkspaceError(`Refusing to access a secrets file: ${rel}`);
    if (mode === 'write') {
      if (segments[0] === '.intent') {
        throw new WorkspaceError('IntentGuard state (.intent/) is changed only through the intent_* tools.');
      }
      if (segments.includes('node_modules')) throw new WorkspaceError('Refusing to edit installed dependencies.');
    }
    return { abs, rel };
  }

  /** Repository files, respecting .gitignore when the root is a git repository. */
  async allFiles(): Promise<string[]> {
    try {
      const out = await simpleGit(this.root).raw(['ls-files', '--cached', '--others', '--exclude-standard']);
      const files = out.split(/\r?\n/).filter(Boolean);
      if (files.length) return files.filter(f => !SECRET_FILE.test(f));
    } catch {
      // Not a git repository: walk the tree
    }
    const files: string[] = [];
    const walk = async (dir: string) => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (files.length >= 20_000) return;
        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) await walk(path.join(dir, entry.name));
        } else if (entry.isFile()) {
          const rel = toPosixPath(path.relative(this.root, path.join(dir, entry.name)));
          if (!SECRET_FILE.test(rel)) files.push(rel);
        }
      }
    };
    await walk(this.root);
    return files;
  }

  /** Lists files under a directory, to a maximum depth. */
  async listFiles(dir = '.', depth = 3, limit = 300): Promise<{ files: string[]; truncated: boolean }> {
    const { rel } = await this.resolve(dir, 'read');
    const prefix = rel ? `${rel}/` : '';
    const matches = (await this.allFiles()).filter(
      f => f.startsWith(prefix) && f.slice(prefix.length).split('/').length <= depth
    );
    return { files: matches.slice(0, limit), truncated: matches.length > limit };
  }

  /** Reads a text file, optionally a 1-based inclusive line range. */
  async readFile(file: string, startLine?: number, endLine?: number): Promise<{ rel: string; text: string; totalLines: number; from: number; to: number }> {
    const { abs, rel } = await this.resolve(file, 'read');
    const stat = await fs.stat(abs).catch(() => undefined);
    if (!stat?.isFile()) throw new WorkspaceError(`File not found: ${rel}`);
    if (stat.size > MAX_READ_BYTES && !startLine) {
      throw new WorkspaceError(`${rel} is ${Math.round(stat.size / 1024)} KB; read it in parts with start_line/end_line.`);
    }
    const content = await fs.readFile(abs, 'utf8');
    if (content.includes('\u0000')) throw new WorkspaceError(`${rel} is a binary file.`);
    const lines = content.split(/\r?\n/);
    const from = Math.max(1, Math.floor(startLine ?? 1));
    const to = Math.min(lines.length, Math.floor(endLine ?? from + 399));
    return { rel, text: lines.slice(from - 1, to).join('\n'), totalLines: lines.length, from, to };
  }

  /** Case-insensitive text search across repository files. */
  async search(query: string, dir = '.', limit = 60): Promise<{ matches: Array<{ file: string; line: number; text: string }>; truncated: boolean }> {
    if (!query?.trim()) throw new WorkspaceError('A search query is required.');
    const { rel } = await this.resolve(dir, 'read');
    const prefix = rel ? `${rel}/` : '';
    const needle = query.toLowerCase();
    const matches: Array<{ file: string; line: number; text: string }> = [];
    for (const file of await this.allFiles()) {
      if (!file.startsWith(prefix)) continue;
      const abs = path.join(this.root, file);
      const stat = await fs.stat(abs).catch(() => undefined);
      if (!stat?.isFile() || stat.size > MAX_SEARCH_BYTES) continue;
      const content = await fs.readFile(abs, 'utf8').catch(() => '');
      if (content.includes('\u0000') || !content.toLowerCase().includes(needle)) continue;
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(needle)) {
          matches.push({ file, line: i + 1, text: lines[i].trim().slice(0, 200) });
          if (matches.length > limit) return { matches: matches.slice(0, limit), truncated: true };
        }
      }
    }
    return { matches, truncated: false };
  }

  async writeFile(file: string, content: string): Promise<{ rel: string; created: boolean }> {
    const { abs, rel } = await this.resolve(file, 'write');
    if (typeof content !== 'string') throw new WorkspaceError('File content must be a string.');
    const created = !(await fs.stat(abs).catch(() => undefined));
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
    return { rel, created };
  }

  /** Replaces exactly one occurrence of `oldText`. */
  async editFile(file: string, oldText: string, newText: string): Promise<{ rel: string }> {
    const { abs, rel } = await this.resolve(file, 'write');
    if (typeof oldText !== 'string' || !oldText) throw new WorkspaceError('old_string must be a non-empty string.');
    if (typeof newText !== 'string') throw new WorkspaceError('new_string must be a string.');
    const content = await fs.readFile(abs, 'utf8').catch(() => {
      throw new WorkspaceError(`File not found: ${rel}`);
    });
    const first = content.indexOf(oldText);
    if (first === -1) throw new WorkspaceError(`old_string was not found in ${rel}. Read the file again and copy the text exactly.`);
    if (content.indexOf(oldText, first + oldText.length) !== -1) {
      throw new WorkspaceError(`old_string appears more than once in ${rel}. Include more surrounding lines to make it unique.`);
    }
    await fs.writeFile(abs, content.slice(0, first) + newText + content.slice(first + oldText.length), 'utf8');
    return { rel };
  }
}
