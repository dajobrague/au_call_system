import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getProviderById,
  getPricingPlanById,
  getUsageTrackingByProvider,
  parsePricingPlanFields,
} from '@/lib/airtable';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const provider = await getProviderById(user.providerId);
  if (!provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  const planLinks = provider.fields.Plan as string[] | undefined;
  const planRecord = planLinks?.[0]
    ? await getPricingPlanById(planLinks[0])
    : null;

  const usage = await getUsageTrackingByProvider(provider.id);

  return NextResponse.json({
    success: true,
    provider: {
      id: provider.id,
      name: provider.fields.Name as string,
      subscriptionStatus: provider.fields['Subscription Status'] as
        | string
        | undefined,
      billingPeriodStart: provider.fields['Billing Period Start'] as
        | string
        | undefined,
      billingPeriodEnd: provider.fields['Billing Period End'] as
        | string
        | undefined,
      stripeCustomerId: provider.fields['Stripe Customer ID'] as
        | string
        | undefined,
    },
    plan: planRecord
      ? (() => {
          const p = parsePricingPlanFields(planRecord.fields);
          return {
            id: planRecord.id,
            name: p.name,
            priceMonthly: p.priceMonthly,
            inboundMinutes: p.inboundMinutes,
            outboundAttempts: p.outboundAttempts,
            smsIncluded: p.smsIncluded,
          };
        })()
      : null,
    usage: usage
      ? {
          inboundMinutesUsed:
            Number(usage.fields['Inbound Minutes Used']) || 0,
          outboundAttemptsUsed:
            Number(usage.fields['Outbound Attempts Used']) || 0,
          smsSent: Number(usage.fields['SMS Sent']) || 0,
          billingPeriodStart: usage.fields['Billing Period Start'] as
            | string
            | undefined,
          billingPeriodEnd: usage.fields['Billing Period End'] as
            | string
            | undefined,
        }
      : null,
  });
}
