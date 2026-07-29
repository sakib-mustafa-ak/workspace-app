'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Shortcut = {
  keys: string[];
  description: string;
  action: () => void;
};

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let buffer = '';
    let timer: ReturnType<typeof setTimeout>;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        setShowCheatSheet((prev) => !prev);
        return;
      }

      if (e.ctrlKey || e.metaKey || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      buffer += e.key.toLowerCase();
      clearTimeout(timer);
      timer = setTimeout(() => { buffer = ''; }, 1000);

      for (const shortcut of shortcuts) {
        const seq = shortcut.keys.join('').toLowerCase();
        if (buffer.endsWith(seq)) {
          e.preventDefault();
          shortcut.action();
          buffer = '';
          break;
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, router]);

  return { showCheatSheet, setShowCheatSheet };
}
