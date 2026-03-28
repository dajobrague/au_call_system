import { NextResponse } from 'next/server';
import {
  listActivePricingPlans,
  parsePricingPlanFields,
} from '@/lib/airtable';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const records = await listActivePricingPlans();

    const plans = records.map((r) => {
      const p = parsePricingPlanFields(r.fields);
      return {
        id: r.id,
        name: p.name,
        price: p.priceMonthly,
        priceMonthly: p.priceMonthly,
        inboundMinutes: p.inboundMinutes,
        outboundAttempts: p.outboundAttempts,
        smsIncluded: p.smsIncluded,
        stripePriceId: p.stripePriceId,
        overageInbound: p.overageInbound,
        overageOutbound: p.overageOutbound,
        overageSms: p.overageSms,
        multiLocation: p.multiLocation,
      };
    });

    plans.sort((a, b) => a.priceMonthly - b.priceMonthly);

    return NextResponse.json({ success: true, plans });
  } catch (error) {
    console.error('Wizard plans error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load plans' },
      { status: 500 }
    );
  }
}
