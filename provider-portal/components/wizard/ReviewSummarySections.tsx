'use client';

import { useRouter } from 'next/navigation';
import type { WizardState } from '@/lib/utils/wizard-storage';
import { formatAustralianPhoneForDisplay } from '@/lib/utils/phone-utils';
import {
  CreditCard,
  User,
  Building2,
  Image as ImageIcon,
  Mic,
  Phone,
} from 'lucide-react';

export default function ReviewSummarySections({
  wizardState,
  formatMoney,
}: {
  wizardState: WizardState;
  formatMoney: (n: number) => string;
}) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CreditCard
              className="h-5 w-5 shrink-0 text-primary"
              strokeWidth={2}
            />
            <h3 className="text-sm font-semibold text-foreground">Plan</h3>
          </div>
          <button
            type="button"
            onClick={() => router.push('/wizard/plan')}
            className="rounded-full px-2 py-0.5 text-xs font-medium text-primary hover:text-primary/80"
          >
            Edit
          </button>
        </div>
        {wizardState.plan ? (
          <dl className="mt-3 space-y-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Selected
              </dt>
              <dd className="text-sm text-foreground">
                {wizardState.plan.planName} —{' '}
                {formatMoney(wizardState.plan.priceMonthly)}/month
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-destructive">No plan selected</p>
        )}
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
            <h3 className="text-sm font-semibold text-foreground">Account</h3>
          </div>
          <button
            type="button"
            onClick={() => router.push('/wizard/user')}
            className="rounded-full px-2 py-0.5 text-xs font-medium text-primary hover:text-primary/80"
          >
            Edit
          </button>
        </div>
        <dl className="mt-3 space-y-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Name
            </dt>
            <dd className="text-sm text-foreground">
              {wizardState.user?.firstName} {wizardState.user?.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Email
            </dt>
            <dd className="text-sm text-foreground">
              {wizardState.user?.email}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Password
            </dt>
            <dd className="text-sm text-foreground">••••••••</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2
              className="h-5 w-5 shrink-0 text-primary"
              strokeWidth={2}
            />
            <h3 className="text-sm font-semibold text-foreground">Business</h3>
          </div>
          <button
            type="button"
            onClick={() => router.push('/wizard/business')}
            className="rounded-full px-2 py-0.5 text-xs font-medium text-primary hover:text-primary/80"
          >
            Edit
          </button>
        </div>
        <dl className="mt-3 space-y-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Provider name
            </dt>
            <dd className="text-sm text-foreground">
              {wizardState.business?.providerName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              State / Suburb
            </dt>
            <dd className="text-sm text-foreground">
              {wizardState.business?.state}, {wizardState.business?.suburb}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Address
            </dt>
            <dd className="text-sm text-foreground">
              {wizardState.business?.address}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Timezone
            </dt>
            <dd className="text-sm text-foreground">
              {wizardState.business?.timezone}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ImageIcon
              className="h-5 w-5 shrink-0 text-primary"
              strokeWidth={2}
            />
            <h3 className="text-sm font-semibold text-foreground">Logo</h3>
          </div>
          <button
            type="button"
            onClick={() => router.push('/wizard/logo')}
            className="rounded-full px-2 py-0.5 text-xs font-medium text-primary hover:text-primary/80"
          >
            Edit
          </button>
        </div>
        {wizardState.logo?.logoUrl ? (
          <div className="mt-3 flex items-center gap-3">
            <img
              src={wizardState.logo.logoUrl}
              alt="Provider logo"
              className="h-14 w-14 rounded-md border border-border/60 object-contain"
            />
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200/60">
              Uploaded
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No logo uploaded</p>
        )}
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
            <h3 className="text-sm font-semibold text-foreground">
              Greeting (IVR)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => router.push('/wizard/greeting')}
            className="rounded-full px-2 py-0.5 text-xs font-medium text-primary hover:text-primary/80"
          >
            Edit
          </button>
        </div>
        {wizardState.greeting?.greetingText ? (
          <p className="mt-3 text-sm leading-relaxed text-foreground">
            {wizardState.greeting.greetingText}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No greeting set</p>
        )}
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
            <h3 className="text-sm font-semibold text-foreground">
              Transfer number
            </h3>
          </div>
          <button
            type="button"
            onClick={() => router.push('/wizard/transfer')}
            className="rounded-full px-2 py-0.5 text-xs font-medium text-primary hover:text-primary/80"
          >
            Edit
          </button>
        </div>
        {wizardState.transfer?.transferNumber ? (
          <p className="mt-3 text-sm text-foreground">
            {formatAustralianPhoneForDisplay(
              wizardState.transfer.transferNumber
            )}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Not set — add later in settings for transfers.
          </p>
        )}
      </div>
    </div>
  );
}
