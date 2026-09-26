import { Settings as SettingsIcon, Terminal, Database, Server } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-brand-teal" />
          Settings
        </h1>
        <p className="text-slate-500 mt-2">Manage IntentGuard configuration and integrations.</p>
      </div>

      <div className="grid gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-slate-500" /> AI Coding Agents
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div>
                <div className="font-medium">Claude Code</div>
                <div className="text-xs text-slate-500">Detected in environment</div>
              </div>
              <div className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs font-bold uppercase rounded">Active</div>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div>
                <div className="font-medium">Cursor</div>
                <div className="text-xs text-slate-500">Workspace integration</div>
              </div>
              <div className="px-3 py-1 bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs font-bold uppercase rounded">Inactive</div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-slate-500" /> LLM Provider
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg">
              <div>
                <div className="font-medium text-blue-900 dark:text-blue-100">IBM watsonx Granite</div>
                <div className="text-xs text-blue-600/80 dark:text-blue-400/80">Primary reasoning model</div>
              </div>
              <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div>
                <div className="font-medium">Ollama (Local)</div>
                <div className="text-xs text-slate-500">Fallback engine</div>
              </div>
              <div className="w-2 h-2 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-slate-500" /> .intent Configuration
          </h2>
          <pre className="p-4 bg-slate-950 text-slate-300 rounded-lg font-mono text-sm overflow-x-auto border border-slate-800">
{`{
  "project": "IntentGuard Web",
  "defaultModel": "watsonx-granite",
  "gateStrictness": "high",
  "requireProofForCommit": true,
  "paths": {
    "specs": "./.intent/specs",
    "reports": "./.intent/reports"
  }
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
