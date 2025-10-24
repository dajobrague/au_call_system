# Cloudflare Voice Bridge Deployment Guide

## Overview

This guide covers deploying the Cloudflare Voice Bridge Worker to production with custom domain support for Twilio Media Streams.

## Prerequisites

- Cloudflare account (your client's production account)
- Domain `netmtion.io` already added to Cloudflare
- Wrangler CLI installed (`npm install -g wrangler` or use `npx wrangler`)

## Part 1: Selecting the Correct Cloudflare Account/Workspace

If you have multiple Cloudflare accounts/workspaces under the same user, you need to specify which account to deploy to.

### Step 1: Find Your Account ID

1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com)
2. **Select the correct workspace** from the account dropdown (top left)
3. Go to **Workers & Pages**
4. Look at the right sidebar → **Account ID** is displayed there
5. Copy the Account ID (format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### Step 2: Choose Your Deployment Method

**Option A: Set Account ID in wrangler.toml (Recommended)**

Edit `cloudflare-voice-bridge/wrangler.toml`:

```toml
name = "voice-proxy"
main = "src/index.ts"
compatibility_date = "2025-09-01"
workers_dev = true

# Add your project's account ID here
account_id = "your-project-account-id-here"
```

**Option B: Specify Account ID During Deployment**

```bash
npx wrangler deploy --account-id=your-account-id
```

**Option C: Use Environment Variable**

```bash
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
npx wrangler deploy
```

### Step 3: Verify Current Configuration

```bash
cd cloudflare-voice-bridge

# Check which user you're logged in as
npx wrangler whoami

# This will show:
# - Your email
# - Your account ID (if set)
# - Your API token status
```

### Step 4: List Available Accounts

```bash
# See all accounts associated with your user
npx wrangler whoami

# The output will show all accounts you have access to
```

### Important Notes

- **Same user, different workspaces:** You stay logged in as the same user
- **Account ID is what matters:** The account ID determines which workspace gets the worker
- **No need to logout:** If you're the same user, just specify the correct account ID
- **Multiple accounts:** You can deploy to different accounts by changing the account_id

## Part 2: Deploy the Worker

```bash
cd cloudflare-voice-bridge

# Install dependencies (if not already done)
npm install

# Deploy to Cloudflare
npx wrangler deploy
```

You should see output like:

```
✨ Built successfully
✨ Uploaded voice-proxy
✨ Deployment complete
🌎 https://voice-proxy.your-username.workers.dev
```

**Important:** Note the `*.workers.dev` URL, but remember it won't work with Twilio - you need a custom domain.

## Part 3: Configure Custom Domain (sam.netmtion.io)

### Step 1: Verify Domain in Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Ensure `netmtion.io` is already added to your account
3. DNS should be active (nameservers pointing to Cloudflare)

### Step 2: Add DNS Record for Subdomain

1. In Cloudflare Dashboard → Select `netmtion.io` domain
2. Go to **DNS** → **Records**
3. Click **Add Record**
4. Configure:
   - **Type:** `CNAME`
   - **Name:** `sam`
   - **Target:** `voice-proxy.your-username.workers.dev` (from deployment output)
   - **Proxy status:** ✅ **Proxied** (orange cloud icon)
   - **TTL:** Auto
5. Click **Save**

### Step 3: Add Custom Domain to Worker

**Option A: Via Dashboard (Easiest)**

1. Go to **Workers & Pages** → **voice-proxy**
2. Click **Settings** tab → **Triggers**
3. Under **Custom Domains**, click **Add Custom Domain**
4. Enter: `sam.netmtion.io`
5. Click **Add Custom Domain**

Cloudflare will automatically:
- Create the DNS record if not exists
- Provision SSL certificate
- Route traffic to your worker

**Option B: Via Wrangler CLI**

```bash
npx wrangler domains add sam.netmtion.io
```

### Step 4: Wait for SSL Certificate

- SSL provisioning typically takes 1-5 minutes
- Check status in Dashboard → Workers & Pages → voice-proxy → Settings → Triggers
- Once active, you'll see ✅ next to the custom domain

### Step 5: Test the Custom Domain

```bash
# Health check
curl https://sam.netmtion.io/health
# Should return: OK

# Test WebSocket endpoint (will return upgrade required for non-WS requests)
curl -i https://sam.netmtion.io/stream
# Should return: 426 Upgrade Required
```

## Part 4: Update Environment Variables

### For Vercel/Production Deployment

Add to Vercel environment variables:

```env
WEBSOCKET_URL=wss://sam.netmtion.io/stream
NODE_ENV=production
```

In Vercel Dashboard:
1. Go to your project → Settings → Environment Variables
2. Add `WEBSOCKET_URL` = `wss://sam.netmtion.io/stream`
3. Redeploy your application

### For Local .env.local (when testing production)

```env
NODE_ENV=production
WEBSOCKET_URL=wss://sam.netmtion.io/stream
```

## Part 5: View Logs

To monitor your worker in real-time:

```bash
cd cloudflare-voice-bridge
npx wrangler tail
```

This streams live logs from your deployed worker.

## Troubleshooting

### Issue: Deployment fails with "Account ID required"

**Solution:** Set account ID in `wrangler.toml`:

```toml
account_id = "your-client-account-id"
```

Find account ID: Dashboard → Workers & Pages → right sidebar shows "Account ID"

### Issue: Custom domain shows "Error 1000"

**Solution:** 
- Ensure DNS record is **Proxied** (orange cloud)
- Wait 5-10 minutes for propagation
- Check SSL certificate status in dashboard

### Issue: Twilio can't connect to WebSocket

**Solution:**
- Verify custom domain is active: `curl https://sam.netmtion.io/health`
- Check SSL certificate is valid
- Ensure Twilio webhook uses `wss://` not `ws://`
- Check Cloudflare Worker logs: `npx wrangler tail`

### Issue: "Wrong account" when deploying

**Solution:**
- Run `npx wrangler logout`
- Run `npx wrangler login`
- Authenticate with correct account
- Verify with `npx wrangler whoami`

## Next Steps

After deployment:
1. ✅ Test custom domain health check
2. ✅ Update Vercel environment variables
3. ✅ Test a real Twilio call
4. ✅ Monitor logs with `wrangler tail`
5. ✅ Update voice-agent to use production URL

## Reference

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Custom Domains for Workers](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)


