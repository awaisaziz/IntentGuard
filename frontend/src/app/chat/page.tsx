'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Square, RotateCcw, Loader2, ChevronDown } from 'lucide-react';
import Transcript, { type TranscriptItem } from '@/components/chat/transcript';
import SpecPanel from '@/components/chat/spec-panel';
import MetricsPanel from '@/components/chat/metrics-panel';
import { listChatModels } from '@/lib/api';
import {
  approveSpec,
  createSession,
  sendMessage,
  type AgentEvent,
  type AgentMetrics,
  type ChatSession,
  type SpecSnapshot,
} from '@/lib/chat-client';

function target(args: Record<string, unknown>): string {
  const value = args.path ?? args.query ?? args.name ?? args.request ?? '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

export default function ChatPage() {
  const [harness, setHarness] = useState(true);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [spec, setSpec] = useState<SpecSnapshot | null>(null);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Model selector
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  const start = useCallback(async (withHarness: boolean) => {
    setSession(null);
    setSetupError(null);
    setItems([]);
    setMetrics(null);
    try {
      const s = await createSession(withHarness, selectedModel || undefined);
      setSession(s);
      setSpec(s.spec);
    } catch (err) {
      setSetupError((err as Error).message);
    }
  }, [selectedModel]);

  // Fetch available models once on mount (best-effort — chat still works without them)
  useEffect(() => {
    listChatModels().then(list => {
      setModels(list);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    start(harness);
  }, [harness, start]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items]);

  const onEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case 'assistant':
        setItems(prev => [...prev, { kind: 'agent', text: event.text }]);
        break;
      case 'tool_call':
        setItems(prev => [...prev, { kind: 'tool', id: event.id, name: event.name, target: target(event.args), status: 'running' }]);
        break;
      case 'tool_result':
        setItems(prev =>
          prev.map(item =>
            item.kind === 'tool' && item.id === event.id && item.status === 'running'
              ? { ...item, status: event.blocked ? 'blocked' : event.ok ? 'ok' : 'error', summary: event.summary, blocked: event.blocked }
              : item
          )
        );
        break;
      case 'spec':
        setSpec(event.spec);
        break;
      case 'metrics':
        setMetrics(event.metrics);
        break;
      case 'error':
        setItems(prev => [...prev, { kind: 'notice', tone: 'error', text: event.message }]);
        break;
    }
  }, []);

  const run = useCallback(
    async (text: string, echo = true) => {
      if (!session || running) return;
      if (echo) setItems(prev => [...prev, { kind: 'user', text }]);
      setRunning(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await sendMessage(session.id, text, onEvent, controller.signal);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setItems(prev => [...prev, { kind: 'notice', tone: 'error', text: (err as Error).message }]);
        } else {
          setItems(prev => [...prev, { kind: 'notice', tone: 'info', text: 'Stopped.' }]);
        }
      } finally {
        abortRef.current = null;
        setRunning(false);
      }
    },
    [session, running, onEvent]
  );

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    run(text);
  };

  const approve = async () => {
    if (!session) return;
    setApproving(true);
    try {
      const approved = await approveSpec(session.id);
      setSpec(approved);
      setItems(prev => [...prev, { kind: 'notice', tone: 'success', text: `You approved ${approved.id}. The agent may now edit files inside its scope.` }]);
      await run('Approved. Go ahead and implement the spec, then verify it.', false);
    } catch (err) {
      setItems(prev => [...prev, { kind: 'notice', tone: 'error', text: (err as Error).message }]);
    } finally {
      setApproving(false);
    }
  };

  const switchMode = (next: boolean) => {
    if (next === harness || running) return;
    if (items.length && !window.confirm('Switching mode starts a new session. Continue?')) return;
    setHarness(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-brand-teal" /> Agent Chat
          </h1>
          <p className="text-slate-500 mt-1">
            An IBM watsonx coding agent
            {session ? (
              <>
                {' working in '}
                <span
                  className="font-mono text-slate-700 dark:text-slate-300"
                  title={session.repoPath}
                >
                  {session.repoPath.split(/[\\/]/).pop() ?? session.repoPath}
                </span>
                {` · ${session.model}`}
              </>
            ) : (
              ' working in the connected repository'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-1 bg-white dark:bg-slate-900 text-sm font-medium">
            <button
              onClick={() => switchMode(true)}
              className={`px-3 py-1.5 rounded-md ${harness ? 'bg-brand-teal text-white' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Intent layer ON
            </button>
            <button
              onClick={() => switchMode(false)}
              className={`px-3 py-1.5 rounded-md ${!harness ? 'bg-amber-500 text-white' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Baseline (OFF)
            </button>
          </div>

          {/* Model selector — only shown when the server returned a model list */}
          {models.length > 0 && (
            <div className="relative">
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                disabled={running}
                title="Pick a watsonx model for the next session"
                className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-teal disabled:opacity-40 cursor-pointer"
              >
                <option value="">Default model</option>
                {models.map(m => (
                  <option key={m} value={m}>{m.split('/').pop() ?? m}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            </div>
          )}

          <button
            onClick={() => start(harness)}
            disabled={running}
            title="New session"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 min-h-[60vh]">
          <div className="flex-1 p-4 overflow-y-auto max-h-[65vh]">
            {setupError ? (
              <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300 text-sm whitespace-pre-wrap">
                {setupError}
              </div>
            ) : !session ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Starting a session…
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-slate-500 space-y-2">
                <p>Describe a change, as vague as a real ticket. For example: &ldquo;improve the booking flow&rdquo;.</p>
                {harness && (
                  <p>
                    With the intent layer on, the agent drafts an IntentSpec, gathers evidence, asks you what it cannot infer, and
                    may only edit files after you approve the spec, and only inside its scope.
                  </p>
                )}
              </div>
            ) : (
              <Transcript items={items} />
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={submit} className="border-t border-slate-200 dark:border-slate-800 p-3 flex gap-2 bg-white dark:bg-slate-950 rounded-b-2xl">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              disabled={!session}
              placeholder={session ? 'Message the agent (Enter to send, Shift+Enter for a new line)' : ''}
              className="flex-1 resize-none p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
            />
            {running ? (
              <button type="button" onClick={() => abortRef.current?.abort()} className="px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white" title="Stop">
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button type="submit" disabled={!session || !input.trim()} className="px-4 rounded-lg bg-brand-teal hover:bg-brand-dark disabled:opacity-40 text-white" title="Send">
                <Send className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>

        <div className="space-y-6">
          <SpecPanel spec={spec} harness={harness} approving={approving} disabled={running || !session} onApprove={approve} />
          <MetricsPanel metrics={metrics} />
        </div>
      </div>
    </div>
  );
}
