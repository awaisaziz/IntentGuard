import { Settings as SettingsIcon, Terminal, Database, Server } from 'lucide-react';
import { getAgents, getConfig, getProviders } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [agents, providers, config] = await Promise.all([getAgents(), getProviders(), getConfig()]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-brand-teal" />
          Settings
        </h1>
        <p className="text-slate-500 mt-2">What IntentGuard is connected to in this repository. Read-only.</p>
      </div>

      <div className="grid gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-slate-500" /> Chat Model Providers
          </h2>
          <div className="space-y-4">
            {providers.providers.map(provider => (
              <div key={provider.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div>
                  <div className="font-medium">
                    {provider.name}
                    {providers.default === provider.id && <span className="ml-2 text-xs text-brand-teal font-semibold">default</span>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {provider.configured ? 'Key found in the IntentGuard environment' : `Set ${provider.envVar} in the IntentGuard .env file`}
                  </div>
                </div>
                <Badge active={provider.configured} on="Configured" off="No key" />
              </div>
            ))}
            {providers.providers.length === 0 && <div className="text-sm text-slate-500 italic">No providers reported.</div>}
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-slate-500" /> AI Coding Agents
          </h2>
          <div className="space-y-4">
            {agents.map(agent => (
              <div key={agent.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div>
                  <div className="font-medium">{agent.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{agent.mcpConfigPath}</div>
                </div>
                <Badge active={agent.mcpConfigured && agent.rulesInstalled} on="Connected" off="Not set up" />
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-slate-500" /> .intent/config.json
          </h2>
          <pre className="p-4 bg-slate-950 text-slate-300 rounded-lg font-mono text-sm overflow-x-auto border border-slate-800">
            {JSON.stringify(config ?? {}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function Badge({ active, on, off }: { active: boolean; on: string; off: string }) {
  return (
    <div
      className={
        active
          ? 'px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs font-bold uppercase rounded'
          : 'px-3 py-1 bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs font-bold uppercase rounded'
      }
    >
      {active ? on : off}
    </div>
  );
}
