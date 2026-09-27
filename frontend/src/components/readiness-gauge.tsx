import { cn } from '@/lib/utils';

const sizes = {
  sm: { box: 'w-12 h-12', value: 'text-xs', unit: 'text-[8px]' },
  md: { box: 'w-24 h-24', value: 'text-xl', unit: 'text-xs' },
  lg: { box: 'w-36 h-36', value: 'text-3xl', unit: 'text-base' },
};

/** Ring gauge. The number is sized to sit inside the ring at every size, including "100". */
export default function ReadinessGauge({ score, size = 'md' }: { score: number; size?: keyof typeof sizes }) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const color = value >= 70 ? 'text-emerald-500' : value >= 50 ? 'text-amber-500' : 'text-red-500';

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const s = sizes[size];

  return (
    <div
      className={cn('relative shrink-0', s.box)}
      role="img"
      aria-label={`Readiness ${value} percent`}
    >
      <svg className="-rotate-90 w-full h-full" viewBox="0 0 100 100">
        <circle className="text-slate-200 dark:text-slate-800" strokeWidth="8" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" />
        <circle
          className={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="50"
          cy="50"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('font-bold leading-none tabular-nums text-slate-900 dark:text-white', s.value)}>
          {value}
          <span className={cn('font-semibold text-slate-500 ml-0.5', s.unit)}>%</span>
        </span>
      </div>
    </div>
  );
}
