'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

interface Stage {
  label: string;
  durationMs: number;
}

const STAGES: Stage[] = [
  { label: 'Confirming payment…', durationMs: 0 },
  { label: 'Payment confirmed', durationMs: 1200 },
  { label: 'Setting up your portal…', durationMs: 1500 },
  { label: 'You are all set!', durationMs: 1500 },
];

interface PostPaymentOverlayProps {
  status: 'processing' | 'success' | 'error';
  errorMessage?: string;
  onComplete: () => void;
  onRetry: () => void;
}

export default function PostPaymentOverlay({
  status,
  errorMessage,
  onComplete,
  onRetry,
}: PostPaymentOverlayProps) {
  const [activeStage, setActiveStage] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  const advance = useCallback(() => {
    setActiveStage((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (status !== 'success') return;
    if (activeStage === 0) {
      const t = setTimeout(advance, STAGES[1].durationMs);
      return () => clearTimeout(t);
    }
  }, [status, activeStage, advance]);

  useEffect(() => {
    if (status !== 'success') return;
    if (activeStage < 1 || activeStage >= STAGES.length) return;

    const nextIdx = activeStage + 1;
    if (nextIdx < STAGES.length) {
      const t = setTimeout(advance, STAGES[nextIdx].durationMs);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      setFadingOut(true);
      setTimeout(onComplete, 600);
    }, STAGES[activeStage].durationMs);
    return () => clearTimeout(t);
  }, [status, activeStage, advance, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center bg-background px-6 transition-opacity duration-500 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center">
        <Image
          src="/On-Call-After-Hours-Logo-Updated-1.webp"
          alt="On-Call After Hours"
          width={160}
          height={80}
          className="mb-12 object-contain"
          priority
        />

        {status === 'error' ? (
          <div
            className="flex flex-col items-center gap-4 text-center"
            style={{ animation: 'fade-up-in 0.3s ease-out' }}
          >
            <XCircle className="h-12 w-12 text-destructive" strokeWidth={1.5} />
            <p className="text-lg font-semibold text-foreground">
              Something went wrong
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {errorMessage || 'We could not complete your payment. Please try again.'}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="flex w-full max-w-xs flex-col gap-5">
            {STAGES.map((stage, idx) => {
              const completed =
                status === 'success' && idx < activeStage;
              const active =
                (status === 'processing' && idx === 0) ||
                (status === 'success' && idx === activeStage);
              const pending = !completed && !active;

              if (pending && idx > activeStage + 1) return null;

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 transition-opacity duration-300 ${
                    pending ? 'opacity-0' : 'opacity-100'
                  }`}
                  style={
                    !pending
                      ? { animation: 'fade-up-in 0.3s ease-out' }
                      : undefined
                  }
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                    {completed ? (
                      <CheckCircle2
                        className="h-7 w-7 text-emerald-500"
                        strokeWidth={2}
                        style={{ animation: 'scale-check 0.4s ease-out' }}
                      />
                    ) : active ? (
                      <Loader2
                        className="h-6 w-6 animate-spin text-primary"
                        strokeWidth={2}
                      />
                    ) : null}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      completed
                        ? 'text-muted-foreground'
                        : active
                          ? 'text-foreground'
                          : 'text-muted-foreground/40'
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
