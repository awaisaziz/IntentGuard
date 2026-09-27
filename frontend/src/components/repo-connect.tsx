'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Github, Loader2, FolderGit2, GitBranch, Check, Home, Download } from 'lucide-react';
import { repoLabel, type WorkspaceInfo, type WorkspaceState } from '@/lib/api';
import { activateWorkspace, connectRepository } from '@/lib/workspace-client';
import { cn } from '@/lib/utils';

/** Paste a GitHub URL to clone a repository, or switch between the ones already cloned. */
export default function RepoConnect({ state }: { state: WorkspaceState }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<string>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const connect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || busy) return;
    run('connect', async () => {
      const result = await connectRepository(url.trim());
      setUrl('');
      const label = repoLabel(result.current);
      return result.cloned ? `Cloned ${label}. The dashboard now shows this repository.` : `${label} was already cloned. Switched to it.`;
    });
  };

  const switchTo = (name: string | null, label: string) =>
    run(name ?? 'start', async () => {
      await activateWorkspace(name);
      return `Switched to ${label}.`;
    });

  const rows: Array<{ key: string; name: string | null; info: WorkspaceInfo; start: boolean }> = [
    { key: 'start', name: null, info: state.start, start: true },
    ...state.workspaces.map(w => ({ key: w.name, name: w.name as string | null, info: w, start: false })),
  ];

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Github className="w-5 h-5 text-brand-teal" /> Connect a repository
      </h2>
      <p className="text-sm text-slate-500 mt-1">
        Paste a GitHub URL. IntentGuard clones it into its git-ignored <code className="font-mono text-xs">workspaces/</code> folder and
        shows its specs and progress here.
      </p>

      <form onSubmit={connect} className="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={busy !== null}
          placeholder="https://github.com/owner/repo"
          aria-label="GitHub repository URL"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-teal disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!url.trim() || busy !== null}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-teal hover:bg-brand-dark text-white text-sm font-medium disabled:opacity-40 shrink-0"
        >
          {busy === 'connect' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {busy === 'connect' ? 'Cloning…' : 'Clone & open'}
        </button>
      </form>

      {error && (
        <div className="mt-3 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="mt-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300 text-sm">
          {notice}
        </div>
      )}

      <div className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">Repositories</div>
      <ul className="mt-2 space-y-2 overflow-y-auto max-h-64 pr-1">
        {rows.map(row => {
          const active = row.start ? state.active === null : state.active === row.name;
          const label = repoLabel(row.info);
          return (
            <li key={row.key}>
              <button
                onClick={() => !active && switchTo(row.name, label)}
                disabled={busy !== null || active}
                className={cn(
                  'w-full text-left p-3 rounded-lg border flex items-center gap-3 transition-colors',
                  active
                    ? 'border-brand-teal bg-brand-teal/5'
                    : 'border-slate-200 dark:border-slate-800 hover:border-brand-teal disabled:opacity-60'
                )}
              >
                {row.start ? <Home className="w-4 h-4 text-slate-400 shrink-0" /> : <FolderGit2 className="w-4 h-4 text-slate-400 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{label}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-3">
                    {row.info.branch && (
                      <span className="inline-flex items-center gap-1">
                        <GitBranch className="w-3 h-3" /> {row.info.branch}
                      </span>
                    )}
                    <span>
                      {row.info.specs} {row.info.specs === 1 ? 'spec' : 'specs'}
                    </span>
                    {row.start && <span>started here</span>}
                  </div>
                </div>
                {busy === row.key ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
                ) : active ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-teal shrink-0">
                    <Check className="w-3.5 h-3.5" /> Active
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 shrink-0">Open</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
