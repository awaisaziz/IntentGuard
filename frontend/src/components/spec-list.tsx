'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import SpecCard from '@/components/spec-card';
import type { Spec } from '@/lib/api';

const FILTERS = ['all', 'draft', 'approved', 'shipped', 'verified'] as const;
type Filter = (typeof FILTERS)[number];

/** Searchable, filterable grid of specs. */
export default function SpecList({ specs }: { specs: Spec[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return specs.filter(
      spec =>
        (filter === 'all' || spec.status === filter) &&
        (!q || spec.id.toLowerCase().includes(q) || spec.objective.toLowerCase().includes(q))
    );
  }, [specs, query, filter]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-4 md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search specs by ID or objective..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize border ${
                status === filter
                  ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map(spec => (
            <SpecCard key={spec.id} spec={spec} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-slate-500 text-sm">
          {specs.length === 0
            ? 'No specs yet. Describe a change in Agent Chat to draft the first one.'
            : 'No specs match this search.'}
        </div>
      )}
    </div>
  );
}
