'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

function LoadingBar() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-0.5">
      <div
        className={`h-full bg-gradient-to-r from-primary-500 to-primary-300 transition-all duration-300 ${
          loading ? 'w-full opacity-100' : 'w-0 opacity-0'
        }`}
      />
    </div>
  );
}

export default LoadingBar;
