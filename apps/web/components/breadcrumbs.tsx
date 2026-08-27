'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={12} className="text-surface-600" />}
          {item.href ? (
            <Link href={item.href} className="text-surface-400 hover:text-surface-200 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-surface-100 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}