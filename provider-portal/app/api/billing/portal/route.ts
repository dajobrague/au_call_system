import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProviderById } from '@/lib/airtable';
import { createBillingPortalSession } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const provider = await getProviderById(user.providerId);
  if (!provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  const customerId = provider.fields['Stripe Customer ID'] as string | undefined;
  if (!customerId) {
    return NextResponse.json(
      { error: 'No Stripe customer on file' },
      { status: 400 }
    );
  }

  const origin =
    request.headers.get('origin') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin;
  const returnUrl = `${origin.replace(/\/$/, '')}/dashboard/billing`;

  try {
    const session = await createBillingPortalSession(customerId, returnUrl);
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('Billing portal error:', e);
    return NextResponse.json(
      { error: 'Could not open billing portal' },
      { status: 500 }
    );
  }
}
