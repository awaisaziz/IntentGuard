'use client';

import { useEffect, useState } from 'react';
import { getSpecById, getSpecReadiness, type Spec, type ReadinessResult } from '@/lib/api';
import GateChecklist from '@/components/gate-checklist';
import ReadinessGauge from '@/components/readiness-gauge';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';
import { use } from 'react';

export default function ReadinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([getSpecById(id), getSpecReadiness(id)])
      .then(([s, r]) => {
        if (!s) { setNotFound(true); return; }
        setSpec(s);
        setReadiness(r);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (notFound || !spec) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Link href="/specs" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Specs
        </Link>
        <p className="text-slate-500">Spec not found.</p>
      </div>
    );
  }

  const score = readiness?.score ?? spec.readinessScore ?? 0;
  const gates = readiness?.gates ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link href={`/specs/${spec.id}`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Spec
      </Link>

      <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-brand-teal" />
            Readiness Audit
          </h1>
          <p className="text-slate-500 mt-2 font-mono text-sm">{spec.id}</p>
          {readiness && (
            <p className={`text-sm mt-1 font-medium ${readiness.ready ? 'text-emerald-600' : 'text-red-500'}`}>
              {readiness.ready ? '✓ Ready to implement' : '✗ Not ready — fix the failing gates'}
            </p>
          )}
        </div>
        <ReadinessGauge score={score} size="md" />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-bold mb-6">6-Gate Validation</h2>
        {gates.length > 0 ? (
          <GateChecklist gates={gates} />
        ) : (
          <p className="text-sm text-slate-500">No readiness data available for this spec.</p>
        )}
      </div>
    </div>
  );
}
