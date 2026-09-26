import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GateStatus = 'pass' | 'warn' | 'fail';

export interface Gate {
  id: string;
  name: string;
  status: GateStatus;
  message?: string;
}

const icons = {
  pass: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
  warn: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  fail: <XCircle className="w-5 h-5 text-red-500" />
};

export default function GateChecklist({ gates }: { gates: Gate[] }) {
  return (
    <div className="space-y-3">
      {gates.map((gate) => (
        <div key={gate.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="mt-0.5">{icons[gate.status]}</div>
          <div>
            <h4 className="font-medium text-sm text-slate-900 dark:text-slate-100">{gate.name}</h4>
            {gate.message && (
              <p className={cn("text-xs mt-1", gate.status === 'fail' ? 'text-red-600 dark:text-red-400' : 'text-slate-500')}>
                {gate.message}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
