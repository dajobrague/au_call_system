import { NextRequest, NextResponse } from 'next/server';
import {
  createUser,
  createProvider,
  linkUserToProvider,
  getHighestProviderId,
  findUserByEmail,
  getPricingPlanById,
  deleteProviderRecord,
  deleteUserRecord,
  createUsageTrackingRecord,
} from '@/lib/airtable';
import { createSession } from '@/lib/auth';
import { hashPassword } from '@/lib/auth/password';
import type { WizardState } from '@/lib/utils/wizard-storage';
import {
  createCustomer,
  attachPaymentMethodToCustomer,
  createSubscription,
  cancelSubscription,
  deleteCustomer,
} from '@/lib/stripe';
import { mapStripeSubscriptionStatusToAirtable } from '@/lib/billing/subscription-status';

export const runtime = 'nodejs';

const PM_REGEX = /^pm_[a-zA-Z0-9]+$/;
const PRICE_REGEX = /^price_[a-zA-Z0-9]+$/;

function unixToDateOnly(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type SubmitBody = WizardState & { paymentMethodId?: string };

export async function POST(request: NextRequest) {
  let customerId: string | undefined;
  let subscriptionId: string | undefined;
  let providerRecordId: string | undefined;
  let userRecordId: string | undefined;

  async function rollbackSignup(reason: string) {
    console.error('Wizard submit rollback:', reason);
    try {
      if (userRecordId) {
        await deleteUserRecord(userRecordId);
      }
    } catch (e) {
      console.error('Rollback delete user:', e);
    }
    try {
      if (providerRecordId) {
        await deleteProviderRecord(providerRecordId);
      }
    } catch (e) {
      console.error('Rollback delete provider:', e);
    }
    try {
      if (subscriptionId) {
        await cancelSubscription(subscriptionId);
      }
    } catch (e) {
      console.error('Rollback cancel subscription:', e);
    }
    try {
      if (customerId) {
        await deleteCustomer(customerId);
      }
    } catch (e) {
      console.error('Rollback delete Stripe customer:', e);
    }
  }

  try {
    const body: SubmitBody = await request.json();
    const { paymentMethodId, ...wizardState } = body;

    if (
      !wizardState.user?.email ||
      !wizardState.user?.password ||
      !wizardState.user?.firstName ||
      !wizardState.user?.lastName
    ) {
      return NextResponse.json(
        { error: 'User information is required' },
        { status: 400 }
      );
    }

    if (!wizardState.business?.providerName) {
      return NextResponse.json(
        { error: 'Provider name is required' },
        { status: 400 }
      );
    }

    if (!wizardState.plan?.planRecordId || !wizardState.plan?.stripePriceId) {
      return NextResponse.json(
        { error: 'Plan selection is required' },
        { status: 400 }
      );
    }

    if (!paymentMethodId || !PM_REGEX.test(paymentMethodId)) {
      return NextResponse.json(
        { error: 'Valid payment method is required' },
        { status: 400 }
      );
    }

    const stripePriceId = wizardState.plan.stripePriceId.trim();
    if (!PRICE_REGEX.test(stripePriceId)) {
      return NextResponse.json(
        { error: 'Invalid plan price reference' },
        { status: 400 }
      );
    }

    if (!isValidEmail(wizardState.user.email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const planRecord = await getPricingPlanById(wizardState.plan.planRecordId);
    if (!planRecord) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const planActive = planRecord.fields.Active;
    if (planActive !== true && planActive !== 1) {
      return NextResponse.json(
        { error: 'This plan is not available' },
        { status: 400 }
      );
    }

    const airtablePriceId = (
      planRecord.fields['Stripe Price ID'] as string
    )?.trim();
    if (!airtablePriceId || airtablePriceId !== stripePriceId) {
      return NextResponse.json({ error: 'Invalid plan configuration' }, {
        status: 400,
      });
    }

    const existing = await findUserByEmail(wizardState.user.email);
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const displayName = `${wizardState.user.firstName} ${wizardState.user.lastName}`.trim();

    let providerRecord;
    let userRecord;
    let periodStart = '';
    let periodEnd = '';

    try {
      const customer = await createCustomer(
        wizardState.user.email,
        displayName,
        {
          signup_flow: 'wizard',
        }
      );
      customerId = customer.id;

      await attachPaymentMethodToCustomer(customerId, paymentMethodId);

      const subscription = await createSubscription(
        customerId,
        stripePriceId,
        paymentMethodId
      );
      subscriptionId = subscription.id;

      periodStart = unixToDateOnly(subscription.current_period_start);
      periodEnd = unixToDateOnly(subscription.current_period_end);
      const subscriptionStatus = mapStripeSubscriptionStatusToAirtable(
        subscription.status
      );

      const highestId = await getHighestProviderId();
      const newProviderId = highestId + 1;

      const providerFields: Parameters<typeof createProvider>[0] = {
        Name: wizardState.business.providerName,
        'Provider ID': newProviderId,
        State: wizardState.business.state,
        Suburb: wizardState.business.suburb,
        Address: wizardState.business.address,
        Timezone: wizardState.business.timezone,
        Active: true,
        'Stripe Customer ID': customerId,
        'Stripe Subscription ID': subscriptionId,
        Plan: [wizardState.plan.planRecordId],
        'Subscription Status': subscriptionStatus,
        'Billing Period Start': periodStart,
        'Billing Period End': periodEnd,
        'Onboarding Status': 'active',
      };

      if (wizardState.greeting?.greetingText) {
        providerFields['Greeting (IVR)'] = wizardState.greeting.greetingText;
      }

      if (wizardState.transfer?.transferNumber) {
        providerFields['Transfer Number'] = wizardState.transfer.transferNumber;
      }

      if (wizardState.logo?.logoUrl) {
        providerFields.Logo = [{ url: wizardState.logo.logoUrl }];
      }

      providerRecord = await createProvider(providerFields);
      providerRecordId = providerRecord.id;

      const hashedPass = await hashPassword(wizardState.user.password);

      userRecord = await createUser({
        Email: wizardState.user.email,
        Pass: hashedPass,
        'First Name': wizardState.user.firstName,
        'Last Name': wizardState.user.lastName,
        Role: 'Admin',
        'Is Primary': true,
      });
      userRecordId = userRecord.id;

      await linkUserToProvider(userRecord.id, providerRecord.id);
    } catch (signupErr) {
      await rollbackSignup(
        signupErr instanceof Error ? signupErr.message : 'Signup failed'
      );
      return NextResponse.json(
        {
          error:
            signupErr instanceof Error
              ? signupErr.message
              : 'Failed to create account. Please try again.',
        },
        { status: 500 }
      );
    }

    try {
      await createUsageTrackingRecord({
        Provider: [providerRecord!.id],
        'Billing Period Start': periodStart,
        'Billing Period End': periodEnd,
        'Inbound Minutes Used': 0,
        'Outbound Attempts Used': 0,
        'SMS Sent': 0,
        'Last Aggregated': new Date().toISOString(),
      });
    } catch (usageErr) {
      console.error(
        'Usage tracking create failed (non-critical):',
        usageErr
      );
    }

    try {
      await createSession({
        id: userRecord!.id,
        email: wizardState.user.email,
        firstName: wizardState.user.firstName,
        providerId: providerRecord!.id,
      });
    } catch (sessionErr) {
      console.error('Session create failed after signup:', sessionErr);
      return NextResponse.json(
        {
          error:
            'Your account was created but we could not log you in automatically. Please sign in with your email and password.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      providerId: providerRecord!.id,
      providerName: wizardState.business.providerName,
    });
  } catch (error) {
    console.error('Wizard submission error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create account. Please try again.',
      },
      { status: 500 }
    );
  }
}
