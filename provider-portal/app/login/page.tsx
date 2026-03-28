/**
 * Login Page — Split-screen layout
 * Left:  Hero image with logo + tagline
 * Right: Sign-in form
 *
 * To change the hero image, replace: public/login-hero.jpg
 */

'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Loader2, ArrowLeft } from 'lucide-react';

const HERO_IMAGE = '/login-hero.jpg';
const MARKETING_URL = 'https://oncallafterhours.com.au';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        const redirect = searchParams.get('redirect') || '/dashboard';
        router.push(redirect);
        router.refresh();
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — Hero image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          className="object-cover"
          priority
          sizes="50vw"
        />

        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-black/30" />

        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-8 z-10">
          <Image
            src="/On-Call-After-Hours-Logo-Updated-1.webp"
            alt="On Call After Hours"
            width={140}
            height={50}
            className="object-contain brightness-0 invert"
          />
          <a
            href={MARKETING_URL}
            className="flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Website
          </a>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 z-10">
          <h2 className="text-3xl font-bold text-white leading-tight xl:text-4xl">
            Smarter After-Hours.
            <br />
            Better Mornings.
            <br />
            Full Control.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70 max-w-md">
            After-hours call handling, escalation workflows, and morning reporting — with full provider control from your own dashboard.
          </p>
        </div>
      </div>

      {/* Right panel — Sign-in form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-background p-6 sm:p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="flex justify-center lg:hidden">
            <Image
              src="/On-Call-After-Hours-Logo-Updated-1.webp"
              alt="On Call After Hours"
              width={180}
              height={60}
              className="object-contain h-auto"
              priority
            />
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Welcome back!
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your provider portal to manage your after-hours operations.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link
                href="/wizard/user"
                className="font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Sign up here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
