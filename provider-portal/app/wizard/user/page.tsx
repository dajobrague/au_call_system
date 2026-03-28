'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import WizardLayout from '@/components/wizard/WizardLayout';
import { validatePassword, passwordsMatch } from '@/lib/utils/password-utils';
import { saveWizardState, getWizardState } from '@/lib/utils/wizard-storage';
import { Loader2 } from 'lucide-react';

const field =
  'w-full rounded-md border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20';

export default function WizardUserPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailStatus, setEmailStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle');
  const emailCheckRef = useRef<AbortController | null>(null);

  const checkEmail = useCallback(async (value: string) => {
    if (!value || !value.includes('@')) {
      setEmailStatus('idle');
      return;
    }

    emailCheckRef.current?.abort();
    const controller = new AbortController();
    emailCheckRef.current = controller;

    setEmailStatus('checking');
    try {
      const res = await fetch('/api/wizard/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value.trim() }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!controller.signal.aborted) {
        setEmailStatus(data.available ? 'available' : 'taken');
      }
    } catch {
      if (!controller.signal.aborted) {
        setEmailStatus('idle');
      }
    }
  }, []);

  useEffect(() => {
    const state = getWizardState();
    if (!state.plan?.planRecordId) {
      router.replace('/wizard/plan');
    }
  }, [router]);

  useEffect(() => {
    const state = getWizardState();
    if (state.user) {
      setFirstName(state.user.firstName || '');
      setLastName(state.user.lastName || '');
      setEmail(state.user.email);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    const newErrors: string[] = [];

    if (!firstName.trim()) {
      newErrors.push('First name is required');
    }

    if (!lastName.trim()) {
      newErrors.push('Last name is required');
    }

    if (!email || !email.includes('@')) {
      newErrors.push('Please enter a valid email address');
    } else if (emailStatus === 'taken') {
      newErrors.push('An account with this email already exists');
    } else if (emailStatus === 'checking') {
      newErrors.push('Still verifying your email — please wait a moment');
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      newErrors.push(...passwordValidation.errors);
    }

    if (!passwordsMatch(password, confirmPassword)) {
      newErrors.push('Passwords do not match');
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    saveWizardState({
      user: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email,
        password,
      },
      currentStep: 3,
    });

    router.push('/wizard/business');
  };

  return (
    <WizardLayout>
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Create your account
        </h2>
        <p className="mt-1 mb-6 text-sm leading-relaxed text-muted-foreground">
          Enter your email and create a secure password
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="firstName"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                First name *
              </label>
              <input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={field}
                placeholder="John"
                required
              />
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Last name *
              </label>
              <input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={field}
                placeholder="Smith"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Email address *
            </label>
            <div className="relative">
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailStatus !== 'idle') setEmailStatus('idle');
                }}
                onBlur={() => checkEmail(email)}
                className={`${field} pr-10 ${
                  emailStatus === 'taken'
                    ? 'border-destructive focus:border-destructive/40 focus:ring-destructive/20'
                    : ''
                }`}
                placeholder="your.email@example.com"
                required
              />
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                {emailStatus === 'checking' && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {emailStatus === 'available' && (
                  <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {emailStatus === 'taken' && (
                  <svg className="h-4 w-4 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
            </div>
            {emailStatus === 'taken' && (
              <p className="mt-1 text-xs text-destructive">
                An account with this email already exists
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Password *
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
              placeholder="Enter a secure password"
              required
            />
            <p className="mt-1 text-[10px] text-muted-foreground/70">
              Must be at least 8 characters with uppercase, lowercase, and a
              number
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Confirm password *
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={field}
              placeholder="Re-enter your password"
              required
            />
          </div>

          {errors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="mb-2 text-sm font-semibold text-destructive">
                Please fix the following errors:
              </p>
              <ul className="list-inside list-disc space-y-1">
                {errors.map((err, index) => (
                  <li key={index} className="text-sm text-destructive">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Next: Business Info'}
            </button>
          </div>
        </form>
      </div>
    </WizardLayout>
  );
}
