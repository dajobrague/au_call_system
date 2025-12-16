# Transfer Number Configuration Feature

## Overview
Added the ability for administrators to configure a "Transfer Number" through the Provider Portal admin page. This phone number is used when the voice agent needs to transfer calls to a representative.

## Changes Made

### 1. Provider Portal UI (`provider-portal/`)

#### Updated Files:
- **`components/data-entry/ProfileConfig.tsx`**
  - Added `Transfer Number` field to the provider configuration form
  - Implemented Australian phone number validation (client-side)
  - Added input field with proper formatting hints
  - Validates both mobile (+61 4XX XXX XXX) and landline (+61 X XXXX XXXX) formats

#### Features:
- Real-time validation as user types
- Clear error messages for invalid phone numbers
- Accepts common Australian phone formats:
  - Mobile: `+61 4XX XXX XXX` or `04XX XXX XXX`
  - Landline: `+61 X XXXX XXXX` or `0X XXXX XXXX`
- Allows spaces, hyphens, and parentheses in input (automatically cleaned)

### 2. API Endpoint (`provider-portal/`)

#### Updated Files:
- **`app/api/provider/info/route.ts`**
  - Added server-side validation for Transfer Number
  - Validates Australian phone number format before saving to Airtable
  - Returns appropriate error messages for invalid numbers

### 3. Voice Agent Types (`voice-agent/`)

#### Updated Files:
- **`src/services/airtable/types.ts`**
  - Added `Transfer Number` field to `ProviderFields` interface
  - Added `transferNumber` property to `Provider` interface

- **`src/services/airtable/employee-service.ts`**
  - Updated `transformProviderRecord()` to include `transferNumber` in the transformed provider object

## Phone Number Validation

The validation accepts Australian phone numbers in the following formats:

### Mobile Numbers:
- `+61 4XX XXX XXX` (international format)
- `04XX XXX XXX` (local format)
- Must have exactly 10 digits (including the leading 0 or country code)
- Must start with `04` (or `+614`)

### Landline Numbers:
- `+61 X XXXX XXXX` (international format, where X is 2-8)
- `0X XXXX XXXX` (local format, where X is 2-8)
- Must have exactly 10 digits (including the leading 0 or country code)
- Must start with `02`, `03`, `07`, or `08` (or international equivalent)

### Allowed Formatting:
The validator automatically strips common formatting characters:
- Spaces: `+61 4XX XXX XXX`
- Hyphens: `+61-4XX-XXX-XXX`
- Parentheses: `(04XX) XXX XXX`

## Usage

### For Administrators:
1. Log in to the Provider Portal
2. Navigate to **Dashboard** → **Admin Section**
3. Scroll to the **Transfer Number** field
4. Enter an Australian phone number
5. Click **Save Changes**

### Validation Behavior:
- **Empty field**: Allowed (optional field)
- **Invalid format**: Error message displayed immediately
- **Valid format**: Saved successfully to Airtable

## Database Schema

### Airtable Field:
- **Table**: `Providers`
- **Field Name**: `Transfer Number`
- **Type**: Single line text (phone number)
- **Required**: No (optional)

## Integration Points

The Transfer Number field is now available in:
1. **Provider Portal**: Admin configuration page
2. **Voice Agent**: Provider data structure for future use in transfer logic

## Future Enhancements

The Transfer Number is now stored in Airtable and available in the Provider data structure. To use it in the voice agent's transfer logic:

1. Update transfer handlers to read from `provider.transferNumber` instead of hardcoded `REPRESENTATIVE_PHONE`
2. Files that may need updates:
   - `voice-agent/src/websocket/dtmf-router.ts`
   - `voice-agent/app/api/queue/initiate-transfer/route.ts`
   - `voice-agent/app/api/queue/transfer/route.ts`
   - `voice-agent/app/api/transfer/after-connect/route.ts`
   - `voice-agent/src/http/server.ts`

## Testing Checklist

- [ ] Admin can view the Transfer Number field
- [ ] Admin can enter a valid Australian mobile number
- [ ] Admin can enter a valid Australian landline number
- [ ] Invalid phone numbers show error message
- [ ] Empty field is accepted (optional)
- [ ] Changes are saved to Airtable
- [ ] Saved number persists after page reload
- [ ] Server-side validation rejects invalid numbers
- [ ] Phone numbers with formatting (spaces, hyphens) are accepted

## Error Messages

### Client-Side:
- "Please enter a valid Australian phone number (e.g., +61 4XX XXX XXX or 04XX XXX XXX)"

### Server-Side:
- "Transfer Number must be a valid Australian phone number"

## Notes

- The field is optional - providers can leave it empty if not needed
- Validation is performed both client-side (for UX) and server-side (for security)
- The validation regex allows for common Australian phone number formats
- The field is ready for integration with the voice agent's transfer logic

