import { cn } from '@/lib/utils';

export default function ReadinessGauge({ score, size = "md" }: { score: number, size?: "sm" | "md" | "lg" }) {
  let color = "text-red-500";
  let bg = "bg-red-500";
  
  if (score >= 70) {
    color = "text-emerald-500";
    bg = "bg-emerald-500";
  } else if (score >= 50) {
    color = "text-amber-500";
    bg = "bg-amber-500";
  }

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const sizes = {
    sm: "w-12 h-12 text-sm",
    md: "w-24 h-24 text-2xl",
    lg: "w-32 h-32 text-4xl"
  };

  return (
    <div className={cn("relative flex items-center justify-center", sizes[size])}>
      <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
        <circle 
          className="text-slate-200 dark:text-slate-800"
          strokeWidth="8"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="50"
          cy="50"
        />
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
      <div className="absolute inset-0 flex flex-col items-center justify-center font-bold text-slate-900 dark:text-white">
        <span>{score}%</span>
      </div>
    </div>
  );
}
