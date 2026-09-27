'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, LayoutDashboard, Layers, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/specs', label: 'Specs', icon: Layers },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors',
              active
                ? 'bg-brand-teal/10 text-brand-teal'
                : 'text-slate-600 dark:text-slate-400 hover:text-brand-teal hover:bg-slate-100 dark:hover:bg-slate-900'
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </>
  );
}
