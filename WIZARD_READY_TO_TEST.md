# 🎉 Provider Onboarding Wizard - READY TO TEST!

## ✅ Setup Complete

All environment variables have been automatically copied from `voice-agent` to `provider-portal`!

### What Was Done

1. ✅ Installed required packages: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@elevenlabs/elevenlabs-js`
2. ✅ Copied all environment variables from voice-agent to provider-portal
3. ✅ Created `.env.local` with all necessary configuration
4. ✅ Generated new SESSION_SECRET (32-character secure key)
5. ✅ Dev server is already running

## 🚀 Test the Wizard NOW

The provider-portal is already running at:
### **http://localhost:3000**

### Access the Wizard:
Navigate to: **http://localhost:3000/wizard**

## 📋 Test Checklist

Follow this testing guide:

### Step 1: User Account
- [ ] Try invalid email format (should show error)
- [ ] Try short password (< 8 chars, should show error)
- [ ] Try password without uppercase (should show error)
- [ ] Try password without number (should show error)
- [ ] Try non-matching passwords (should show error)
- [ ] Enter valid credentials and proceed

### Step 2: Business Information
- [ ] Leave required fields empty (should show error)
- [ ] Select state from dropdown
- [ ] Select timezone from dropdown
- [ ] Fill all fields and proceed

### Step 3: Logo Upload (Optional)
- [ ] Try uploading file > 5MB (should show error)
- [ ] Try uploading non-image file (should show error)
- [ ] Upload valid image (should show preview)
- [ ] Click "Skip for now" option
- [ ] Try both paths and proceed

### Step 4: IVR Greeting (Optional)
- [ ] Click "Use Sample" to fill default text
- [ ] Enter custom text (max 150 chars)
- [ ] Click "Preview Greeting Audio" button
- [ ] Wait for audio generation (should show "Audio generated successfully!")
- [ ] Click "Play Audio" button and listen
- [ ] Regenerate multiple times to test
- [ ] Try exceeding 150 characters (should show error)
- [ ] Test "Skip for now" option

### Step 5: Transfer Number (Optional)
- [ ] Try invalid phone format (should show error)
- [ ] Test various AU formats:
  - `+61 412 345 678` ✓
  - `0412 345 678` ✓
  - `(02) 1234 5678` ✓
  - `+61 2 1234 5678` ✓
- [ ] Verify normalization shows `+61` format
- [ ] Test "Skip for now" option (should show warning)

### Step 6: Review & Submit
- [ ] Verify all entered data is correct
- [ ] Click "Edit" on any section to go back
- [ ] Modify data and return to review
- [ ] Click "Create Account" button
- [ ] Wait for submission (should see "Creating Account..." spinner)
- [ ] Verify redirect to `/dashboard` after success

### Post-Submission Verification
- [ ] Check you're logged in (should see provider dashboard)
- [ ] Check Airtable:
  - [ ] New provider record created with correct ID (highest + 1)
  - [ ] New user record created in `tblLiBIYIt9jDwQGT`
  - [ ] User linked to provider
  - [ ] Logo URL saved (if uploaded)
  - [ ] Greeting text saved (if entered)
  - [ ] Transfer number saved (if entered)
- [ ] Check S3 (if logo uploaded):
  - [ ] Logo file exists at correct path
  - [ ] Logo URL is accessible

## 🔍 Environment Variables Copied

The following variables were copied from voice-agent:

```env
# AWS S3 Configuration
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=

# ElevenLabs Configuration
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=

# Airtable Configuration
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=
USER_TABLE_ID=tblLiBIYIt9jDwQGT

# Redis Configuration (optional)
REDIS_URL=

# Session Configuration
SESSION_SECRET=[Auto-generated 32-char key]
```

## 🐛 If You Encounter Issues

### Issue: Logo upload fails
- Check AWS credentials in `.env.local`
- Check S3 bucket permissions
- Check file size < 5MB

### Issue: Audio generation fails
- Check ELEVENLABS_API_KEY in `.env.local`
- Check ELEVENLABS_VOICE_ID is valid
- Check internet connection

### Issue: Submission fails
- Check Airtable credentials in `.env.local`
- Check browser console for errors
- Check terminal logs for server errors

### Issue: Not redirected after submission
- Check session configuration
- Clear browser cookies
- Check `/api/wizard/submit` logs

## 📊 Expected Provider ID Behavior

When you create your first test provider:
- Script queries Airtable for highest Provider ID
- If current highest is `1010`, new provider gets `1011`
- If no providers exist, starts at `1001`
- Auto-increments sequentially

## 🎨 UI Features

- ✨ Beautiful gradient background
- ✨ Progress indicator with checkmarks
- ✨ Real-time validation feedback
- ✨ Loading states for async operations
- ✨ Success/error messages
- ✨ Edit any step from review page
- ✨ Mobile-responsive design

## 📁 Files Created/Modified

### New Files (27 total)
```
provider-portal/
├── app/wizard/
│   ├── page.tsx
│   ├── user/page.tsx
│   ├── business/page.tsx
│   ├── logo/page.tsx
│   ├── greeting/page.tsx
│   ├── transfer/page.tsx
│   └── review/page.tsx
├── app/api/wizard/
│   ├── upload-logo/route.ts
│   ├── generate-greeting/route.ts
│   └── submit/route.ts
├── components/wizard/
│   └── WizardLayout.tsx
├── lib/utils/
│   ├── phone-utils.ts
│   ├── password-utils.ts
│   └── wizard-storage.ts
├── lib/services/
│   ├── s3-service.ts
│   └── elevenlabs-service.ts
├── copy-env-vars.sh (script)
├── .env.local (auto-generated)
├── WIZARD_SETUP_INSTRUCTIONS.md
└── WIZARD_IMPLEMENTATION_COMPLETE.md
```

### Modified Files
- `lib/airtable.ts` (added 4 functions)
- `package.json` (added 3 packages)

## ⏭️ Next Steps After Testing

1. **Test Thoroughly** - Complete all test cases above
2. **Fix Any Issues** - Report bugs and I'll fix them
3. **Get Client Approval** - Confirm S3 logo path structure
4. **Deploy to Production** - Once tested and approved
5. **Update Website** - Add wizard link to client's website

## 🔗 Quick Links

- **Wizard URL**: http://localhost:3000/wizard
- **Dashboard**: http://localhost:3000/dashboard
- **API Routes**:
  - Upload Logo: http://localhost:3000/api/wizard/upload-logo
  - Generate Greeting: http://localhost:3000/api/wizard/generate-greeting
  - Submit: http://localhost:3000/api/wizard/submit

## 📞 Support

If you encounter any issues during testing, let me know:
- What step you're on
- What error message you see
- What you expected to happen
- Browser console errors (if any)

---

**Status**: ✅ READY TO TEST
**Environment**: Development (localhost:3000)
**Last Updated**: $(date)

Start testing now at: **http://localhost:3000/wizard**

