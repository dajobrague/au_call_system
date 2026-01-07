# Provider Onboarding Wizard - Setup Instructions

## Overview
The provider onboarding wizard allows new providers to self-register and set up their accounts.

## Setup Steps

### 1. Install Required Packages

Run this command in the provider-portal directory:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @elevenlabs/elevenlabs-js
```

### 2. Configure Environment Variables

Copy the required environment variables from `voice-agent/.env.local` to `provider-portal/.env.local`:

Required variables:
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`

Also ensure these are set:
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `USER_TABLE_ID` (should be `tblLiBIYIt9jDwQGT`)
- `SESSION_SECRET`

### 3. Pending: S3 Logo Path Decision

**⚠️ REQUIRES CLIENT INPUT:**

We need to decide on the S3 folder structure for provider logos. Current implementation uses:
```
provider-logos/{providerId}/{timestamp}-{filename}
```

Please confirm with your client if this structure is acceptable, or provide an alternative.

### 4. Test the Wizard

Once packages are installed and environment variables are configured:

1. Start the provider-portal dev server:
   ```bash
   cd provider-portal
   npm run dev
   ```

2. Navigate to: `http://localhost:3000/wizard`

3. Complete the wizard flow:
   - Step 1: Create account (email + password)
   - Step 2: Business information
   - Step 3: Upload logo (optional)
   - Step 4: IVR greeting with audio preview (optional)
   - Step 5: Transfer number (optional)
   - Step 6: Review and submit

4. After successful submission, you should be redirected to the dashboard.

## Wizard Flow

### Step 1: User Account (`/wizard/user`)
- Email address
- Password (validated: min 8 chars, uppercase, lowercase, number)
- Password confirmation

### Step 2: Business Info (`/wizard/business`)
- Provider name (required)
- State (dropdown - Australian states)
- Suburb (required)
- Address (required)
- Timezone (dropdown - Australian timezones)

### Step 3: Logo (`/wizard/logo`)
- Optional logo upload
- Max 5MB, image files only
- Uploads to S3 and stores URL in Airtable

### Step 4: Greeting (`/wizard/greeting`)
- Optional IVR greeting text (max 150 chars)
- Preview audio using ElevenLabs TTS
- Can regenerate until satisfied

### Step 5: Transfer Number (`/wizard/transfer`)
- Optional Australian phone number
- Validates and normalizes to +61 format
- Warning if skipped (transfers won't work)

### Step 6: Review & Submit (`/wizard/review`)
- Review all entered information
- Can edit any step
- Submit creates:
  1. Provider record (with auto-generated ID)
  2. User record
  3. Links user to provider
  4. Creates session (logs in)
  5. Redirects to dashboard

## Technical Details

### Provider ID Generation
- Queries Airtable for highest existing Provider ID
- Increments by 1 (e.g., 1010 → 1011)
- Starts at 1001 if no providers exist

### Phone Number Validation
- Accepts all Australian formats
- Normalizes to +61 format without spaces
- Validates mobile (04XX) and landline (02/03/07/08)

### Session Management
- Uses iron-session for secure sessions
- User is automatically logged in after wizard completion
- Session persists across page reloads

### Wizard State
- Stored in sessionStorage during flow
- Cleared after successful submission
- Allows navigation back/forward through steps

## Files Created

### Components
- `components/wizard/WizardLayout.tsx` - Layout with progress indicator

### Pages
- `app/wizard/page.tsx` - Redirect to first step
- `app/wizard/user/page.tsx` - Account creation
- `app/wizard/business/page.tsx` - Business information
- `app/wizard/logo/page.tsx` - Logo upload
- `app/wizard/greeting/page.tsx` - IVR greeting with audio preview
- `app/wizard/transfer/page.tsx` - Transfer number
- `app/wizard/review/page.tsx` - Review and submit

### API Routes
- `app/api/wizard/upload-logo/route.ts` - Upload logo to S3
- `app/api/wizard/generate-greeting/route.ts` - Generate TTS audio
- `app/api/wizard/submit/route.ts` - Create provider & user, log in

### Utilities
- `lib/utils/phone-utils.ts` - Phone number validation/normalization
- `lib/utils/password-utils.ts` - Password validation
- `lib/utils/wizard-storage.ts` - Wizard state management

### Services
- `lib/services/s3-service.ts` - S3 upload functionality
- `lib/services/elevenlabs-service.ts` - ElevenLabs TTS

### Airtable Functions (added to `lib/airtable.ts`)
- `getHighestProviderId()` - Get next provider ID
- `createProvider()` - Create provider record
- `createUser()` - Create user record
- `linkUserToProvider()` - Link user to provider

## Next Steps

1. ✅ Install npm packages (user needs to run command)
2. ⏳ Copy environment variables from voice-agent
3. ⏳ Get client approval on S3 logo folder structure
4. ⏳ Test wizard end-to-end in localhost
5. ⏳ Deploy to production

## Notes

- All wizard steps are validated before submission
- Provider ID auto-increments from highest existing ID
- Logo, greeting, and transfer number are optional
- User is automatically logged in after completion
- Wizard state persists during flow but clears after submission

