'use client';

import { useEffect, useState } from 'react';
import { getConfig, getAgentStatuses, type IntentConfig, type AgentStatus } from '@/lib/api';
import {
  Settings as SettingsIcon, Terminal, Database, Server,
  CheckCircle2, XCircle, Loader2, FolderOpen, GitBranch, Zap, AlertCircle,
} from 'lucide-react';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-6 bg-slate-900/60 border border-slate-800 rounded-xl ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, color = 'text-slate-400' }: { icon: React.ElementType; title: string; color?: string }) {
  return (
    <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-5">
      <Icon className={`w-4 h-4 ${color}`} />
      <span className={color}>{title}</span>
    </h2>
  );
}

export default function SettingsPage() {
  const [config, setConfig] = useState<IntentConfig | null>(null);
  const [agents, setAgents] = useState<AgentStatus[] | null>(null);

  useEffect(() => {
    Promise.all([getConfig(), getAgentStatuses()]).then(([cfg, ags]) => {
      setConfig(cfg);
      setAgents(ags);
    });
  }, []);

  const rootDir = config?.rootDir ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-brand-teal" />
          <span className="text-xs font-bold uppercase tracking-widest text-brand-teal">Configuration</span>
        </div>
        <h1 className="text-3xl font-black text-white">Settings</h1>
        <p className="text-slate-400 mt-1 text-sm">IntentGuard configuration, connected repo, and agent integrations.</p>
      </div>

      <div className="grid gap-6">

        {/* ── Connected Repository ── */}
        <Card>
          <SectionTitle icon={FolderOpen} title="Connected Repository" color="text-brand-teal" />
          {config === null ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-teal" /> Loading…
            </div>
          ) : rootDir ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl border border-brand-teal/20 bg-brand-teal/5">
                <GitBranch className="w-5 h-5 text-brand-teal shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-brand-teal font-bold uppercase tracking-wider mb-1">Root directory</p>
                  <p className="font-mono text-sm text-white break-all">{rootDir}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    This is the repository IntentGuard is protecting. All specs, scope fences, and agent changes are relative to this path.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-800/40">
                  <p className="text-xs text-slate-500 mb-1">Specs stored in</p>
                  <p className="font-mono text-xs text-slate-300">{rootDir}/.intent/specs/</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-800/40">
                  <p className="text-xs text-slate-500 mb-1">Proof reports in</p>
                  <p className="font-mono text-xs text-slate-300">{rootDir}/.intent/reports/</p>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-950/10 flex items-start gap-2 text-xs text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  To connect a different repository, restart the server with{' '}
                  <code className="font-mono bg-slate-800 px-1 py-0.5 rounded">pnpm dev:server --repo /path/to/repo</code>
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-950/10 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-400">No repository connected</p>
                <p className="text-xs text-slate-400 mt-1">
                  Run <code className="font-mono bg-slate-800 px-1 rounded">pnpm dev:server --repo /path/to/repo</code> to point IntentGuard at your project.
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* ── AI Coding Agents ── */}
        <Card>
          <SectionTitle icon={Terminal} title="AI Coding Agents" />
          {agents === null ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-teal" /> Loading agents…
            </div>
          ) : agents.length === 0 ? (
            <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/30 text-sm text-slate-400 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
              <span>No agents found. Run <code className="font-mono bg-slate-800 px-1 rounded text-slate-300">pnpm agents:setup</code> to register agents.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map(agent => {
                const active = agent.mcpConfigured && agent.rulesInstalled;
                const partial = agent.mcpConfigured || agent.rulesInstalled;
                return (
                  <div key={agent.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      active ? 'border-emerald-700/40 bg-emerald-950/20' :
                      partial ? 'border-amber-700/30 bg-amber-950/10' :
                      'border-slate-800 bg-slate-800/30'
                    }`}>
                    <div className="min-w-0">
                      <div className="font-semibold text-white">{agent.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono truncate">{agent.mcpConfigPath}</div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`flex items-center gap-1 text-xs font-medium ${agent.mcpConfigured ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {agent.mcpConfigured ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          MCP config
                        </span>
                        <span className={`flex items-center gap-1 text-xs font-medium ${agent.rulesInstalled ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {agent.rulesInstalled ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          Rules installed
                        </span>
                      </div>
                    </div>
                    <span className={`shrink-0 ml-4 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${
                      active  ? 'text-emerald-400 border-emerald-700/50 bg-emerald-950/40' :
                      partial ? 'text-amber-400  border-amber-700/40  bg-amber-950/30' :
                                'text-slate-500  border-slate-700      bg-slate-800/50'
                    }`}>
                      {active ? 'Active' : partial ? 'Partial' : 'Inactive'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── LLM Provider ── */}
        <Card>
          <SectionTitle icon={Database} title="LLM Provider" />
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl border border-blue-700/30 bg-blue-950/20">
              <div>
                <div className="font-semibold text-white">IBM watsonx Granite</div>
                <div className="text-xs text-blue-400/80 mt-0.5">
                  {config?.llmProvider ? `Provider: ${config.llmProvider}` : 'Primary reasoning model for spec drafting and chat'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.8)] animate-pulse" />
                <span className="text-xs text-blue-400 font-medium">Connected</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-800/30">
              <div>
                <div className="font-semibold text-white">Readiness threshold</div>
                <div className="text-xs text-slate-400 mt-0.5">Minimum score before the agent may edit files</div>
              </div>
              <div className="text-2xl font-black text-brand-teal">
                {config === null ? <Loader2 className="w-4 h-4 animate-spin" /> : `${config.readinessThreshold ?? 70}`}
                <span className="text-sm text-slate-500 font-normal ml-0.5">/100</span>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Raw config ── */}
        <Card>
          <SectionTitle icon={Server} title=".intent/config.json" />
          {config === null ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-teal" /> Loading…
            </div>
          ) : (
            <pre className="p-4 bg-slate-950 text-slate-400 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
              {JSON.stringify(config, null, 2)}
            </pre>
          )}
        </Card>

      </div>
    </div>
  );
}
