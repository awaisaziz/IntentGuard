import { CheckCircle2, XCircle } from 'lucide-react';

interface ScopeTreeProps {
  inScope?: string[];
  outOfScope?: string[];
}

export default function ScopeTree({ inScope = [], outOfScope = [] }: ScopeTreeProps) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4" /> In Scope
        </h4>
        <ul className="space-y-2">
          {inScope.length > 0 ? inScope.map((item, idx) => (
            <li key={idx} className="p-3 text-sm bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-lg text-slate-700 dark:text-slate-300">
              {item}
            </li>
          )) : (
            <li className="text-sm text-slate-500 italic">No in-scope items defined.</li>
          )}
        </ul>
      </div>
      
      <div className="space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
          <XCircle className="w-4 h-4" /> Out of Scope (Fence)
        </h4>
        <ul className="space-y-2">
          {outOfScope.length > 0 ? outOfScope.map((item, idx) => (
            <li key={idx} className="p-3 text-sm bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-lg text-slate-700 dark:text-slate-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-1 bg-red-100 dark:bg-red-900 text-[10px] font-bold text-red-800 dark:text-red-200 uppercase rounded-bl">Blocked</div>
              {item}
            </li>
          )) : (
            <li className="text-sm text-slate-500 italic">No out-of-scope boundaries defined.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
