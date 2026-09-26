import Link from 'next/link';
import { ShieldCheck, Github, Settings, LayoutDashboard, Layers, FileCode } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-brand-teal">
            <ShieldCheck className="w-6 h-6" />
            <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">IntentGuard</span>
          </Link>
          <span className="text-xs text-slate-500 hidden sm:inline-block">Any agent. Clear intent. Proven changes.</span>
        </div>

        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-brand-teal transition-colors">
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <Link href="/specs" className="flex items-center gap-2 text-slate-600 hover:text-brand-teal transition-colors">
            <Layers className="w-4 h-4" />
            <span>Specs</span>
          </Link>
          <Link href="/settings" className="flex items-center gap-2 text-slate-600 hover:text-brand-teal transition-colors">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </Link>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
          <a href="https://github.com/awaisaziz/IntentGuard" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <Github className="w-5 h-5" />
          </a>
        </nav>
      </div>
    </header>
  );
}
