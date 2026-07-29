'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { verifyEmail } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      router.replace('/dashboard?verify=missing-token');
      return;
    }
    verifyEmail(token)
      .then(() => {
        router.replace('/dashboard?verify=success');
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Verification failed';
        router.replace(`/dashboard?verify=error&message=${encodeURIComponent(msg)}`);
      });
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950">
      <div className="animate-fadeIn flex flex-col items-center gap-3">
        <Loader2 size={32} className="animate-spin text-primary-500" />
        <p className="text-sm text-surface-400">Verifying your email…</p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-surface-950">
        <div className="animate-fadeIn">
          <Loader2 size={24} className="animate-spin text-primary-500" />
        </div>
      </div>
    }>
      <VerifyEmailInner />
    </Suspense>
  );
}
