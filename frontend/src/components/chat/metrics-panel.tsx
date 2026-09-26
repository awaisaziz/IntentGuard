import { Activity } from 'lucide-react';
import type { AgentMetrics } from '@/lib/chat-client';

export default function MetricsPanel({ metrics }: { metrics: AgentMetrics | null }) {
  if (!metrics) return null;
  const blocked = Object.values(metrics.blocked).reduce((a, b) => a + b, 0);
  const rows: Array<[string, string | number, string?]> = [
    ['Tool calls', metrics.toolCalls],
    ['Model calls', metrics.llmCalls],
    ['Edits blocked', blocked, blocked ? 'text-red-600' : undefined],
    ['Files written', metrics.filesWritten.length],
    ['Out-of-scope writes', metrics.outOfScopeWrites.length, metrics.outOfScopeWrites.length ? 'text-red-600' : 'text-emerald-600'],
    ['Checks passed', `${metrics.checks.filter(c => c.passed).length}/${metrics.checks.length}`],
    ['Tokens', `${((metrics.promptTokens + metrics.completionTokens) / 1000).toFixed(1)}k`],
    ['Working time', `${Math.round(metrics.elapsedMs / 1000)}s`],
  ];
  return (
    <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <h2 className="font-bold flex items-center gap-2 mb-3">
        <Activity className="w-5 h-5 text-slate-500" /> Session metrics
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="contents">
            <dt className="text-slate-500">{label}</dt>
            <dd className={`text-right font-semibold tabular-nums ${tone ?? ''}`}>{value}</dd>
          </div>
        ))}
      </dl>
      {metrics.outOfScopeWrites.length > 0 && (
        <ul className="mt-3 text-xs font-mono text-red-700 dark:text-red-400 space-y-0.5">
          {metrics.outOfScopeWrites.map(f => (
            <li key={f}>✖ {f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
