'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { verifyEmail } from '@/lib/auth';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    verifyEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(`Email ${res.email} verified successfully!`);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed');
      });
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {status === 'loading' && (
          <>
            <Loader2 size={40} className="mx-auto mb-4 animate-spin text-primary-500" />
            <h1 className="text-xl font-bold">Verifying your email…</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={40} className="mx-auto mb-4 text-emerald-500" />
            <h1 className="text-xl font-bold">Email verified!</h1>
            <p className="mt-2 text-sm text-surface-400">{message}</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="mt-6 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-500"
            >
              Go to login
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={40} className="mx-auto mb-4 text-red-500" />
            <h1 className="text-xl font-bold">Verification failed</h1>
            <p className="mt-2 text-sm text-surface-400">{message}</p>
            <Link
              href="/auth/request-verification"
              className="mt-6 inline-block rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-500"
            >
              Request new link
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    }>
      <VerifyEmailInner />
    </Suspense>
  );
}
