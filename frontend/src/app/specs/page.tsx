import { getAllSpecs } from '@/lib/api';
import SpecCard from '@/components/spec-card';
import { Search, Plus } from 'lucide-react';

export default async function SpecsPage() {
  const specs = await getAllSpecs();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Intent Specifications</h1>
          <p className="text-slate-500 mt-1">Manage and track all your project specs.</p>
        </div>
        <button className="flex items-center gap-2 bg-brand-teal hover:bg-brand-dark text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> New Spec
        </button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search specs by ID or objective..." 
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'draft', 'approved', 'verified'].map(status => (
            <button key={status} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize border ${status === 'all' ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'}`}>
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {specs.map(spec => (
          <SpecCard key={spec.id} spec={spec} />
        ))}
      </div>
    </div>
  );
}
