'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';

interface WizardLayoutProps {
  children: React.ReactNode;
  contentMaxWidthClass?: string;
  noCard?: boolean;
  hideBrandPanel?: boolean;
}

const WIZARD_STEPS = [
  {
    step: 1,
    name: 'Plan',
    path: '/wizard/plan',
    headline: 'Choose your plan',
    subtitle:
      'Pick the subscription that fits your practice. You can change it later from billing.',
  },
  {
    step: 2,
    name: 'Account',
    path: '/wizard/user',
    headline: 'Create your account',
    subtitle:
      'Your email and password secure the provider portal and onboarding.',
  },
  {
    step: 3,
    name: 'Business',
    path: '/wizard/business',
    headline: 'Tell us about your business',
    subtitle:
      'We use this to set up your profile and how callers see you.',
  },
  {
    step: 4,
    name: 'Logo',
    path: '/wizard/logo',
    headline: 'Add your logo',
    subtitle: 'Optional — helps brand your patient-facing experience.',
  },
  {
    step: 5,
    name: 'Greeting',
    path: '/wizard/greeting',
    headline: 'IVR greeting',
    subtitle: 'What callers hear when they reach your after-hours line.',
  },
  {
    step: 6,
    name: 'Transfer',
    path: '/wizard/transfer',
    headline: 'Transfer number',
    subtitle: 'Where we should route calls after the greeting.',
  },
  {
    step: 7,
    name: 'Review',
    path: '/wizard/review',
    headline: 'Review & payment',
    subtitle: 'Confirm everything and start your subscription.',
  },
] as const;

const TOTAL_STEPS = WIZARD_STEPS.length;

export default function WizardLayout({
  children,
  contentMaxWidthClass = 'max-w-2xl',
  noCard = false,
  hideBrandPanel = false,
}: WizardLayoutProps) {
  const pathname = usePathname();

  const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.path === pathname);
  const currentStep = currentStepIndex >= 0 ? currentStepIndex + 1 : 1;
  const activeConfig =
    currentStepIndex >= 0
      ? WIZARD_STEPS[currentStepIndex]
      : WIZARD_STEPS[0];

  const progressPct =
    TOTAL_STEPS <= 1
      ? 0
      : ((currentStep - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-[300px] w-[300px] rounded-full bg-primary/4 blur-[80px]"
        aria-hidden
      />

      {/* Sticky header: logo + progress */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Image
            src="/On-Call-After-Hours-Logo-Updated-1.webp"
            alt="On-Call After Hours"
            width={130}
            height={65}
            className="shrink-0 object-contain"
            priority
          />
          <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/70 shadow-sm">
            Step {currentStep} of {TOTAL_STEPS}
          </span>
        </div>

        {/* Progress bar + dots */}
        <div className="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-label={`Onboarding step ${currentStep} of ${TOTAL_STEPS}`}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between gap-1 sm:gap-2">
            {WIZARD_STEPS.map((step) => {
              const done = currentStep > step.step;
              const active = currentStep === step.step;
              return (
                <div
                  key={step.step}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                >
                  <div
                    className={`h-2.5 w-2.5 shrink-0 rounded-full transition-colors ${
                      done
                        ? 'bg-emerald-500'
                        : active
                          ? 'bg-primary ring-2 ring-primary/25 ring-offset-2 ring-offset-card'
                          : 'bg-muted'
                    }`}
                    aria-hidden
                  />
                  <span
                    className={`hidden text-center text-[11px] font-semibold uppercase tracking-[0.12em] sm:block ${
                      active
                        ? 'text-primary'
                        : done
                          ? 'text-foreground'
                          : 'text-muted-foreground/70'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        {!hideBrandPanel && (
          <div className={`mx-auto mb-6 w-full text-center ${contentMaxWidthClass}`}>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {activeConfig.headline}
            </h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {activeConfig.subtitle}
            </p>
          </div>
        )}

        <div className={`mx-auto w-full ${contentMaxWidthClass}`}>
          {noCard ? (
            children
          ) : (
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
              {children}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
