import { NextRequest, NextResponse } from 'next/server';
import {
  createUser,
  createProvider,
  linkUserToProvider,
  getHighestProviderId,
} from '@/lib/airtable';
import { createSession } from '@/lib/auth';
import type { WizardState } from '@/lib/utils/wizard-storage';

export async function POST(request: NextRequest) {
  try {
    const wizardState: WizardState = await request.json();

    // Validate required fields
    if (!wizardState.user?.email || !wizardState.user?.password || 
        !wizardState.user?.firstName || !wizardState.user?.lastName) {
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

    // Step 1: Generate next provider ID
    const highestId = await getHighestProviderId();
    const newProviderId = highestId + 1;

    console.log('Creating provider with ID:', newProviderId);

    // Step 2: Create provider record
    const providerFields: {
      'Name': string;
      'Provider ID': number;
      'State': string;
      'Suburb': string;
      'Address': string;
      'Timezone': string;
      'Greeting (IVR)'?: string;
      'Transfer Number'?: string;
      'Logo'?: Array<{ url: string }>;
      'Active': boolean;
    } = {
      'Name': wizardState.business.providerName,
      'Provider ID': newProviderId,
      'State': wizardState.business.state,
      'Suburb': wizardState.business.suburb,
      'Address': wizardState.business.address,
      'Timezone': wizardState.business.timezone,
      'Active': true,
    };

    // Add optional fields
    if (wizardState.greeting?.greetingText) {
      providerFields['Greeting (IVR)'] = wizardState.greeting.greetingText;
    }

    if (wizardState.transfer?.transferNumber) {
      providerFields['Transfer Number'] = wizardState.transfer.transferNumber;
    }

    if (wizardState.logo?.logoUrl) {
      providerFields['Logo'] = [{ url: wizardState.logo.logoUrl }];
    }

    const providerRecord = await createProvider(providerFields);
    console.log('Provider created:', providerRecord.id);

    // Step 3: Create user record
    const userRecord = await createUser({
      'Email': wizardState.user.email,
      'Pass': wizardState.user.password,
      'First Name': wizardState.user.firstName,
      'Last Name': wizardState.user.lastName,
    });
    console.log('User created:', userRecord.id);

    // Step 4: Link user to provider
    await linkUserToProvider(userRecord.id, providerRecord.id);
    console.log('User linked to provider');

    // Step 5: Create session (log in the user)
    await createSession({
      id: userRecord.id,
      email: wizardState.user.email,
      firstName: wizardState.user.firstName,
      providerId: providerRecord.id,
    });
    console.log('Session created');

    return NextResponse.json({
      success: true,
      providerId: providerRecord.id,
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

