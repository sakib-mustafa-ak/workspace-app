'use client';

import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  currentLabel?: string;
}

export function Breadcrumbs({ items, currentLabel }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-label">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <span className="text-caption text-surface-400" aria-hidden="true">/</span>
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-surface-500 hover:text-primary-400 transition-colors text-label underline-grow"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-primary-400 text-label font-medium">{item.label}</span>
          )}
        </span>
      ))}
      {currentLabel && (
        <span className="flex items-center gap-1">
          <span className="text-caption text-surface-400" aria-hidden="true">/</span>
          <span className="text-primary-400 text-label font-medium">{currentLabel}</span>
        </span>
      )}
    </nav>
  );
}