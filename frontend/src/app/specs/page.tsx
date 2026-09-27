import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getAllSpecs } from '@/lib/api';
import SpecList from '@/components/spec-list';

export const dynamic = 'force-dynamic';

export default async function SpecsPage() {
  const specs = await getAllSpecs();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Intent Specifications</h1>
          <p className="text-slate-500 mt-1">
            {specs.length} {specs.length === 1 ? 'spec' : 'specs'} in this repository&apos;s .intent folder.
          </p>
        </div>
        <Link
          href="/chat"
          className="flex items-center gap-2 bg-brand-teal hover:bg-brand-dark text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Spec
        </Link>
      </div>

      <SpecList specs={specs} />
    </div>
  );
}
