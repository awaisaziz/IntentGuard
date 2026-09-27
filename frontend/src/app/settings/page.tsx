'use client';

import { useEffect, useState } from 'react';
import {
  getConfig, getAgentStatuses, initRepo, connectRepo,
  type IntentConfig, type AgentStatus, type ConnectResult,
} from '@/lib/api';
import {
  Settings as SettingsIcon, Terminal, Database, Server,
  CheckCircle2, XCircle, Loader2, FolderOpen, GitBranch, Zap, AlertCircle,
  RefreshCw, Link2, FileCode2, Cpu,
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

interface ConnectLog {
  agentId: string;
  kind: 'mcp' | 'rules' | 'both';
  result: ConnectResult | null;
  error: string | null;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<IntentConfig | null>(null);
  const [agents, setAgents] = useState<AgentStatus[] | null>(null);

  // Init state
  const [initialising, setInitialising] = useState(false);
  const [initResult, setInitResult] = useState<{ projectName: string | null } | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // Connect state — keyed by agentId+kind
  const [connecting, setConnecting] = useState<string | null>(null); // "<agentId>:<kind>"
  const [connectLogs, setConnectLogs] = useState<ConnectLog[]>([]);

  const reload = () =>
    Promise.all([getConfig(), getAgentStatuses()]).then(([cfg, ags]) => {
      setConfig(cfg);
      setAgents(ags);
    });

  useEffect(() => { reload(); }, []);

  const rootDir = config?.rootDir ?? null;

  // ── Init ──────────────────────────────────────────────────────────────────
  const handleInit = async () => {
    setInitialising(true);
    setInitError(null);
    setInitResult(null);
    try {
      const r = await initRepo();
      setInitResult({ projectName: r.projectName });
      await reload();
    } catch (err) {
      setInitError((err as Error).message);
    } finally {
      setInitialising(false);
    }
  };

  // ── Connect (per-agent) ────────────────────────────────────────────────────
  const handleConnect = async (agentId: string, kind: 'mcp' | 'rules' | 'both') => {
    const key = `${agentId}:${kind}`;
    setConnecting(key);
    try {
      const result = await connectRepo(
        agentId,
        kind === 'mcp',
        kind === 'rules',
      );
      setConnectLogs(prev => [{ agentId, kind, result, error: null }, ...prev.filter(l => !(l.agentId === agentId && l.kind === kind))]);
      await reload();
    } catch (err) {
      setConnectLogs(prev => [{ agentId, kind, result: null, error: (err as Error).message }, ...prev.filter(l => !(l.agentId === agentId && l.kind === kind))]);
    } finally {
      setConnecting(null);
    }
  };

  // ── Connect all ────────────────────────────────────────────────────────────
  const handleConnectAll = async () => {
    setConnecting('all:both');
    try {
      const result = await connectRepo(undefined, false, false);
      setConnectLogs(prev => [{ agentId: 'all', kind: 'both', result, error: null }, ...prev]);
      await reload();
    } catch (err) {
      setConnectLogs(prev => [{ agentId: 'all', kind: 'both', result: null, error: (err as Error).message }, ...prev]);
    } finally {
      setConnecting(null);
    }
  };

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

              {/* Init button — always available to re-initialise */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-700 bg-slate-800/30">
                <div>
                  <p className="text-sm font-semibold text-white">Initialize / Re-initialize</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Runs <code className="font-mono bg-slate-700 px-1 rounded">intent init</code> — creates <code className="font-mono bg-slate-700 px-1 rounded">.intent/</code> and detects project info.
                  </p>
                </div>
                <button
                  onClick={handleInit}
                  disabled={initialising}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-brand-teal hover:bg-brand-dark text-white disabled:opacity-50 transition-all ml-4"
                >
                  {initialising ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {initialising ? 'Initialising…' : 'Initialize'}
                </button>
              </div>

              {initResult && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-700/50 bg-emerald-950/30 text-emerald-400 text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Initialized{initResult.projectName ? ` · project: ${initResult.projectName}` : ''}
                </div>
              )}
              {initError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-red-700/50 bg-red-950/30 text-red-400 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {initError}
                </div>
              )}

              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-950/10 flex items-start gap-2 text-xs text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  To connect a different repository, restart the server with{' '}
                  <code className="font-mono bg-slate-800 px-1 py-0.5 rounded">pnpm dev:server --repo /path/to/repo</code>
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-950/10 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">No repository connected</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Run <code className="font-mono bg-slate-800 px-1 rounded">pnpm dev:server --repo /path/to/repo</code> to point IntentGuard at your project.
                  </p>
                </div>
              </div>
              <button
                onClick={handleInit}
                disabled={initialising}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-brand-teal hover:bg-brand-dark text-white disabled:opacity-50 transition-all"
              >
                {initialising ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {initialising ? 'Initialising…' : 'Initialize repo'}
              </button>
              {initError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-red-700/50 bg-red-950/30 text-red-400 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {initError}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ── AI Coding Agents ── */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <SectionTitle icon={Terminal} title="AI Coding Agents" />
            <button
              onClick={handleConnectAll}
              disabled={connecting !== null}
              className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 transition-all"
            >
              {connecting === 'all:both' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              {connecting === 'all:both' ? 'Connecting…' : 'Connect all agents'}
            </button>
          </div>

          {agents === null ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-teal" /> Loading agents…
            </div>
          ) : agents.length === 0 ? (
            <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/30 text-sm text-slate-400 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
              <span>No agents found. Click <strong>Connect all agents</strong> above to register them.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map(agent => {
                const active = agent.mcpConfigured && agent.rulesInstalled;
                const partial = agent.mcpConfigured || agent.rulesInstalled;
                const log = connectLogs.find(l => l.agentId === agent.id);
                const mcpKey = `${agent.id}:mcp`;
                const rulesKey = `${agent.id}:rules`;
                return (
                  <div key={agent.id}
                    className={`rounded-xl border transition-all ${
                      active  ? 'border-emerald-700/40 bg-emerald-950/20' :
                      partial ? 'border-amber-700/30 bg-amber-950/10' :
                                'border-slate-800 bg-slate-800/30'
                    }`}>
                    <div className="flex items-center justify-between p-4">
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
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${
                          active  ? 'text-emerald-400 border-emerald-700/50 bg-emerald-950/40' :
                          partial ? 'text-amber-400  border-amber-700/40  bg-amber-950/30' :
                                    'text-slate-500  border-slate-700      bg-slate-800/50'
                        }`}>
                          {active ? 'Active' : partial ? 'Partial' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {/* Per-agent action row */}
                    <div className="flex items-center gap-2 px-4 pb-4 pt-0 border-t border-slate-800/60 mt-0 pt-3">
                      <button
                        onClick={() => handleConnect(agent.id, 'mcp')}
                        disabled={connecting !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-900/60 hover:bg-blue-800/70 border border-blue-700/40 text-blue-300 disabled:opacity-50 transition-all"
                      >
                        {connecting === mcpKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
                        Setup MCP
                      </button>
                      <button
                        onClick={() => handleConnect(agent.id, 'rules')}
                        disabled={connecting !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-900/60 hover:bg-purple-800/70 border border-purple-700/40 text-purple-300 disabled:opacity-50 transition-all"
                      >
                        {connecting === rulesKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCode2 className="w-3.5 h-3.5" />}
                        Generate Rules
                      </button>
                      <button
                        onClick={() => handleConnect(agent.id, 'both')}
                        disabled={connecting !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-900/60 hover:bg-emerald-800/70 border border-emerald-700/40 text-emerald-300 disabled:opacity-50 transition-all"
                      >
                        {connecting === `${agent.id}:both` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                        Connect
                      </button>
                    </div>

                    {/* Result log for this agent */}
                    {log && (
                      <div className={`mx-4 mb-4 px-3 py-2 rounded-lg border text-xs ${
                        log.error
                          ? 'border-red-700/50 bg-red-950/30 text-red-400'
                          : 'border-emerald-700/50 bg-emerald-950/30 text-emerald-400'
                      }`}>
                        {log.error ? (
                          <span className="flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{log.error}</span>
                        ) : log.result ? (
                          <div className="space-y-0.5">
                            {log.result.mcpConfigs.map(f => (
                              <div key={f} className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 shrink-0" /> MCP: <span className="font-mono truncate">{f}</span></div>
                            ))}
                            {log.result.rules.map(f => (
                              <div key={f} className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 shrink-0" /> Rules: <span className="font-mono truncate">{f}</span></div>
                            ))}
                            {log.result.mcpConfigs.length === 0 && log.result.rules.length === 0 && (
                              <span>Already up to date.</span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}
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
