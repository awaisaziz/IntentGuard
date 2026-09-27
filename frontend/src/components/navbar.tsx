import Link from 'next/link';
import { ShieldCheck, Github, FolderGit2, GitBranch } from 'lucide-react';
import NavLinks from '@/components/nav-links';
import { getWorkspacesQuietly, repoLabel } from '@/lib/api';

export default async function Navbar() {
  const state = await getWorkspacesQuietly();
  const current = state?.current;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/" className="flex items-center gap-2 text-brand-teal shrink-0">
            <ShieldCheck className="w-6 h-6" />
            <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">IntentGuard</span>
          </Link>
          {current ? (
            <Link
              href="/"
              title={current.root}
              className="hidden md:inline-flex items-center gap-2 min-w-0 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300 hover:border-brand-teal"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
              <span className="font-medium truncate max-w-[16rem]">{repoLabel(current)}</span>
              {current.branch && (
                <span className="inline-flex items-center gap-1 text-slate-400 shrink-0">
                  <GitBranch className="w-3 h-3" /> {current.branch}
                </span>
              )}
            </Link>
          ) : (
            <span className="hidden md:inline text-xs text-amber-600">Backend offline</span>
          )}
        </div>

        <nav className="flex items-center gap-1 text-sm font-medium shrink-0">
          <NavLinks />
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
          <a
            href={current?.remote?.startsWith('https://') ? current.remote.replace(/\.git$/, '') : 'https://github.com/awaisaziz/IntentGuard'}
            target="_blank"
            rel="noreferrer"
            title="Open the repository on GitHub"
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <Github className="w-5 h-5" />
          </a>
        </nav>
      </div>
    </header>
  );
}
