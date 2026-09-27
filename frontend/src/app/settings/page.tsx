'use client';

import { useEffect, useState } from 'react';
import { getConfig, getAgentStatuses, type IntentConfig, type AgentStatus } from '@/lib/api';
import { Settings as SettingsIcon, Terminal, Database, Server, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const [config, setConfig] = useState<IntentConfig | null>(null);
  const [agents, setAgents] = useState<AgentStatus[] | null>(null);

  useEffect(() => {
    Promise.all([getConfig(), getAgentStatuses()]).then(([cfg, ags]) => {
      setConfig(cfg);
      setAgents(ags);
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-brand-teal" />
          Settings
        </h1>
        <p className="text-slate-500 mt-2">IntentGuard configuration and agent integrations.</p>
      </div>

      <div className="grid gap-6">
        {/* Agent integrations */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-slate-500" /> AI Coding Agents
          </h2>
          {agents === null ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading agents…
            </div>
          ) : agents.length === 0 ? (
            <p className="text-sm text-slate-500">No agents found. Run <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">pnpm agents:setup</code> to register agents.</p>
          ) : (
            <div className="space-y-3">
              {agents.map(agent => {
                const active = agent.mcpConfigured && agent.rulesInstalled;
                const partial = agent.mcpConfigured || agent.rulesInstalled;
                return (
                  <div key={agent.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">{agent.mcpConfigPath}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`flex items-center gap-1 text-xs ${agent.mcpConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          {agent.mcpConfigured ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          MCP
                        </span>
                        <span className={`flex items-center gap-1 text-xs ${agent.rulesInstalled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          {agent.rulesInstalled ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          Rules
                        </span>
                      </div>
                    </div>
                    <div className={`px-3 py-1 text-xs font-bold uppercase rounded ${
                      active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                        : partial
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {active ? 'Active' : partial ? 'Partial' : 'Inactive'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LLM provider */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-slate-500" /> LLM Provider
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg">
              <div>
                <div className="font-medium text-blue-900 dark:text-blue-100">IBM watsonx Granite</div>
                <div className="text-xs text-blue-600/80 dark:text-blue-400/80">
                  {config?.llmProvider ? `Provider: ${config.llmProvider}` : 'Primary reasoning model'}
                </div>
              </div>
              <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div>
                <div className="font-medium">Readiness threshold</div>
                <div className="text-xs text-slate-500">Minimum score to unlock coding</div>
              </div>
              <div className="text-lg font-bold text-brand-teal">
                {config === null ? <Loader2 className="w-4 h-4 animate-spin" /> : `${config.readinessThreshold ?? 70}%`}
              </div>
            </div>
          </div>
        </div>

        {/* .intent config */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-slate-500" /> .intent Configuration
          </h2>
          {config === null ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading config…
            </div>
          ) : (
            <pre className="p-4 bg-slate-950 text-slate-300 rounded-lg font-mono text-sm overflow-x-auto border border-slate-800">
              {JSON.stringify(config, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
