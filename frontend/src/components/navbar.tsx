'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Github, Settings, LayoutDashboard, Layers, MessageSquare, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/',        label: 'Dashboard', icon: LayoutDashboard },
  { href: '/specs',   label: 'Specs',     icon: Layers },
  { href: '/chat',    label: 'Chat',      icon: MessageSquare },
  { href: '/settings',label: 'Settings',  icon: Settings },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative w-7 h-7 flex items-center justify-center rounded-lg bg-brand-teal/10 border border-brand-teal/30 group-hover:bg-brand-teal/20 transition-all">
            <ShieldCheck className="w-4 h-4 text-brand-teal" />
            <div className="absolute inset-0 rounded-lg ring-1 ring-brand-teal/0 group-hover:ring-brand-teal/30 transition-all" />
          </div>
          <span className="font-black text-base text-white tracking-tight">Intent<span className="text-brand-teal">Guard</span></span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  active
                    ? 'bg-brand-teal/10 text-brand-teal border border-brand-teal/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-3">
          <Link
            href="/specs"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-teal/10 border border-brand-teal/30 text-brand-teal hover:bg-brand-teal/20 transition-all"
          >
            <Zap className="w-3 h-3" /> New Spec
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <a
            href="https://github.com/awaisaziz/IntentGuard"
            target="_blank" rel="noreferrer"
            className="text-slate-600 hover:text-slate-300 transition-colors"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
