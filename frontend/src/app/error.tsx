'use client';

import { useEffect } from 'react';
import { PlugZap, RotateCcw } from 'lucide-react';

/**
 * Shown when a page cannot load its data, which in practice means the backend is
 * not running. Production builds hide error messages, so the advice is static.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto mt-12 p-6 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
      <h1 className="text-xl font-bold flex items-center gap-2 text-amber-900 dark:text-amber-300">
        <PlugZap className="w-5 h-5" /> The IntentGuard backend did not answer
      </h1>
      <p className="mt-3 text-sm text-amber-900/80 dark:text-amber-200/80">
        The dashboard reads specs, readiness and reports from the local API. Start it in the IntentGuard folder, then retry:
      </p>
      <pre className="mt-3 p-3 rounded-lg bg-slate-950 text-slate-200 text-sm font-mono overflow-x-auto">pnpm dev:server</pre>
      <p className="mt-3 text-xs text-amber-900/70 dark:text-amber-200/70">
        It listens on http://localhost:3848. To guard another repository, add <code>--repo &lt;path&gt;</code>.
      </p>
      <button
        onClick={reset}
        className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal hover:bg-brand-dark text-white text-sm font-medium"
      >
        <RotateCcw className="w-4 h-4" /> Retry
      </button>
    </div>
  );
}
