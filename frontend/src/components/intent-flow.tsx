import { ArrowRight, MessageSquare, Target, Terminal, GitCommit, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function IntentFlow({ currentStep = 1 }: { currentStep?: number }) {
  const steps = [
    { id: 1, name: 'Request', icon: MessageSquare },
    { id: 2, name: 'Intent', icon: Target },
    { id: 3, name: 'Code', icon: Terminal },
    { id: 4, name: 'Proof', icon: CheckCircle },
    { id: 5, name: 'Commit', icon: GitCommit },
  ];

  return (
    <div className="flex items-center justify-between w-full max-w-3xl mx-auto py-8">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isPast = step.id < currentStep;
        const isCurrent = step.id === currentStep;

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-2 relative">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                isCurrent ? "bg-brand-teal text-white border-brand-teal shadow-lg shadow-brand-teal/20 scale-110" : 
                isPast ? "bg-slate-800 text-white border-slate-800" : "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-900 dark:border-slate-800"
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={cn(
                "text-xs font-semibold uppercase tracking-wider absolute -bottom-6",
                isCurrent ? "text-brand-teal" : "text-slate-500"
              )}>
                {step.name}
              </span>
            </div>
            
            {index < steps.length - 1 && (
              <div className="w-12 sm:w-20 lg:w-24 px-2 flex justify-center">
                <div className={cn(
                  "h-0.5 w-full",
                  step.id < currentStep ? "bg-slate-800" : "bg-slate-200 dark:bg-slate-800"
                )} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
