import { MessageSquare, Target, Terminal, GitCommit, CheckCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  { id: 1, name: 'Request', hint: 'Raw ticket', icon: MessageSquare },
  { id: 2, name: 'Intent', hint: 'Spec and readiness gate', icon: Target },
  { id: 3, name: 'Code', hint: 'Inside the scope fence', icon: Terminal },
  { id: 4, name: 'Proof', hint: 'Verify against the spec', icon: CheckCircle },
  { id: 5, name: 'Commit', hint: 'With a proof report', icon: GitCommit },
];

/** The lifecycle as a full-width stepper: connectors stretch to fill the available space. */
export default function IntentFlow({ currentStep = 1 }: { currentStep?: number }) {
  return (
    <ol className="flex items-start w-full">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isPast = step.id < currentStep;
        const isCurrent = step.id === currentStep;

        return (
          <li key={step.id} className={cn('flex items-start', index < steps.length - 1 ? 'flex-1' : 'flex-none')}>
            <div className="flex flex-col items-center text-center w-20 sm:w-28 shrink-0">
              <div
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center border-2 transition-colors',
                  isCurrent
                    ? 'bg-brand-teal text-white border-brand-teal shadow-lg shadow-brand-teal/25'
                    : isPast
                      ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200'
                      : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                )}
              >
                {isPast ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={cn('mt-2 text-xs font-semibold uppercase tracking-wider', isCurrent ? 'text-brand-teal' : 'text-slate-500')}>
                {step.name}
              </span>
              <span className="mt-0.5 text-[11px] leading-tight text-slate-400 hidden md:block">{step.hint}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={cn('flex-1 h-0.5 mt-[21px] rounded', isPast ? 'bg-slate-800 dark:bg-slate-200' : 'bg-slate-200 dark:bg-slate-800')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
